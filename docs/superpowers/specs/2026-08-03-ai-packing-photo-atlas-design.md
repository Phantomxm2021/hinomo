# AI 装箱照片 Atlas 设计与实施方案

> 本文是 AI 装箱功能的唯一权威设计。实现改变数据语义、状态机、媒体生命周期或模型编排时，必须先同步更新本文。当前仓库已落地会话上传、Atlas Worker、Qwen 结构化推理、实例清单、原图定位裁剪、revision 发布、结果审核、搜索和异步转正式物品；生产放量仍受第 18、20 节真实数据评测与上线门槛约束。

## 1. 决策摘要

Nomo 新增“AI 装箱”能力。用户扫描或打开箱子后开始一次装箱会话，每放入一批物品只拍一张照片，不填写名称、分类、数量或备注。用户点击“装箱完成”后，后台异步处理全部照片：

1. 保存并校验原始照片；
2. 按拍摄顺序生成固定网格的故事板 Atlas；
3. 使用 `qwen3-vl-plus` 分组分析照片变化；
4. 跨 Atlas 追踪物理实例、合并同一实例并聚合同类物品；
5. 为每个最终清单项回到高清原图完成定位和单项裁剪；
6. 生成带独立图片、数量表达和原图证据的可搜索 AI 清单。

本方案的核心约束是：

- 用户端的必需动作只有拍照和结束装箱。
- Atlas 是低成本的全局索引，不是唯一证据；原图必须保留。
- 每个标记为清晰且进入 `ready` 的 AI 清单项必须拥有可追溯到原图的单项裁剪图片；无法可靠裁剪的项目只能进入 `needs_review`。
- 不透明袋、严重遮挡和不可见内容不得由模型猜测。
- AI 输出先进入独立的“检测清单”，不直接成为可取出、归还或移动的正式 `items` 库存。
- 所有处理必须异步、幂等、可重试，并允许用户关闭页面后继续运行。

## 2. 目标与非目标

### 2.1 目标

- 将单件物品的多字段表单录入，替换为一次装箱会话中的连续拍照。
- 支持常见的 3～50 张照片；系统设计上允许单次会话最多 100 张。
- 自动生成名称、分类、数量表达、描述和照片证据。
- 自动从最佳证据原图中定位物品并生成单项列表图片。
- 对相邻照片中重复出现的物品进行跨图去重。
- 区分“同一物理实例持续出现”和“新增一件外观相同的物品”。
- 让用户可以通过物品名称、同义词、包装文字和描述找到对应箱子。
- 对不确定结果使用保守表达，并允许稍后修正或转为正式物品。
- 控制模型成本，避免默认把 50 张高清原图一次性送入模型。

### 2.2 非目标

- 不保证仅凭照片识别不透明袋内部内容。
- 不把 AI 推测数量用于现有物品流转事务。
- 第一期不做实时视频分析、语音录入、商品数据库匹配或模型微调。
- 第一期不做传统全景拼接；装箱前后画面内容变化，不满足全景拼接假设。
- 第一期不删除原图，也不使用相似度规则自动丢弃可能包含短暂可见物品的照片。

## 3. 现实环境约束

方案必须以真实家庭装箱条件为基准，而不是以棚拍图片为基准：

- 箱壁、手机和人体会产生明显阴影。
- 透明塑料袋可能反光、扭曲和遮挡内容。
- 不透明袋只能识别为一个外部容器。
- 衣物、线材、小零件容易互相覆盖或外观相似。
- 同一物品会连续出现在多张照片中。
- 用户可能改变拍摄角度、缩放比例和手机方向。
- 网络可能中断，50 张照片不应要求一次上传成功。
- 一张严重模糊的照片不应使整次会话失败。

因此模型输出必须区分“明确可见”“部分可见”“不透明容器”和“未知”，数量必须区分精确、至少、估计和未知。

## 4. 用户体验

### 4.1 入口

箱子所有者在箱子详情页看到主操作“AI 装箱”。进入后创建一次新的装箱会话。

现有“新增物品”表单继续保留，适用于贵重物品、设备和需要精确流转的库存。

### 4.2 拍摄页

拍摄页只保留以下主要内容：

- 箱子名称和编号；
- 已拍照片数量；
- 最近一张照片缩略图；
- 拍照按钮；
- “装箱完成”按钮；
- 非阻塞的上传状态。

每次拍照后立即回到取景状态，不显示名称、分类和数量表单。照片在本地先写入 IndexedDB，再以最多两个并发请求上传，避免页面刷新、弱网或短暂离线造成整次会话丢失。

### 4.3 拍照质量提示

客户端只对严重问题打断用户：

- 图片无法解码；
- 近乎全黑；
- 严重失焦；
- 上传文件超过硬限制。

一般阴影、轻微倾斜和塑料袋反光只记录为质量信号，不要求重拍。用户始终可以选择“仍然保留”。

### 4.4 完成装箱

用户点击“装箱完成”时：

1. 客户端等待本地照片全部确认上传；
2. 调用完成会话 RPC；
3. 服务端冻结照片顺序并创建分析任务；
4. 页面显示“正在生成清单，可先离开”；
5. 用户可以关闭页面，稍后从箱子详情查看进度和结果。

已经完成的会话不可继续追加照片。确需补拍时创建一次“补充识别”会话，避免正在推理的数据集发生变化。

### 4.5 结果页

结果按三组展示：

- 清晰识别：名称和数量证据明确；
- 需要确认：数量、重复关系或名称不确定；
- 未知容器：只能确认袋子或容器存在，不能确认内容。

用户无需立即审核。AI 清单可以参与搜索，但必须带“AI 识别”标识。用户可以：

- 修改名称、分类或数量表达；
- 合并重复项；
- 删除错误项；
- 查看单项裁剪图片，并打开对应原图中的高亮位置；
- 将某项转为正式物品。

AI 项目和正式物品在箱子详情中使用同一套清单行视觉结构；差异只体现在“AI 识别”状态、数量精度和可用操作上，不把 AI 结果藏在独立的次级页面。

## 5. 总体架构

现有架构是 React PWA + Supabase + 私有 Cloudflare R2，生产前端为静态部署。Atlas 合成、图片预处理和长时间模型调用不应在浏览器或同步数据库 RPC 内执行，因此新增独立异步 Worker。

```text
React PWA
  │  创建会话、获取签名 URL、上传照片
  ▼
Supabase Postgres / RPC
  │  保存元数据、RLS、任务状态、认领任务
  ▼
Packing Worker（Node 22）
  ├── 从私有 R2 读取原图
  ├── 使用 Sharp 规范化并生成 Atlas
  ├── 调用 Qwen3-VL-Plus
  ├── 追踪物理实例并合并结构化结果
  ├── 回到原图定位、裁剪并验证单项图片
  └── 写回检测清单和处理状态
  │
  ├── Cloudflare R2：原图、规范图、Atlas、单项裁剪图
  └── Qwen OpenAI 兼容端点：视觉推理
```

建议新增 `apps/packing-worker`：

- Node.js 22；
- `sharp` 负责方向修正、缩放、留白、Atlas 合成、物品裁剪和基础质量统计；
- Supabase service role 仅存在于 Worker 密钥环境；
- Worker 使用官方 `openai` Node.js SDK 的 `OpenAI({ apiKey, baseURL })` 连接 Qwen 的 OpenAI 兼容端点，不手写 HTTP 请求，也不引入厂商专有 SDK；
- R2 S3 凭据和 `QWEN_API_KEY` 仅存在于 Worker 密钥环境；
- 不创建任何 `VITE_` 前缀的服务端秘密；
- Docker 部署增加独立服务，Cloudflare 静态前端部署方式不变。

任务队列第一期使用 Postgres 表加 `for update skip locked` 的认领 RPC，避免在 MVP 同时引入新的队列产品。吞吐量增长后可迁移至 Cloudflare Queues，数据库仍是最终状态来源。

## 6. 媒体上传与存储

### 6.1 不复用现有物品图片上传语义

当前 `media_kind` 只有 `cover` 和 `item`，确认上传后会直接写入箱子封面或物品图片。装箱照片是一对多会话媒体，不应强行扩展现有确认逻辑。

新增独立的：

- `create_packing_photo_upload(session_id, sequence_no, mime_type, size_bytes)`；
- `confirm_packing_photo_upload(photo_id)`；
- `create_packing_photo_download(photo_id)`。

浏览器只能为自己拥有的箱子创建和确认照片。照片顺序使用服务端约束的 `sequence_no`，客户端时间仅作为辅助信息。

### 6.2 R2 对象路径

```text
users/{owner_id}/boxes/{box_id}/packing/{session_id}/original/{photo_id}.webp
users/{owner_id}/boxes/{box_id}/packing/{session_id}/normalized/{photo_id}.webp
users/{owner_id}/boxes/{box_id}/packing/{session_id}/atlas/{atlas_no}.webp
users/{owner_id}/boxes/{box_id}/packing/{session_id}/items/{detected_item_id}.webp
```

规范图、Atlas 和单项裁剪图都可以从原图重新生成，但第一期仍保留，方便局部重试和问题排查。删除会话或箱子时，将未被正式物品引用的关联对象加入现有异步媒体清理机制。已经提升为正式物品的图片必须先复制到独立的正式物品路径，不能继续依赖会话目录。

### 6.3 客户端压缩

- 自动修正方向；
- 最长边默认 2560 px；
- 优先 WebP，质量 85～90；
- 单张硬限制 8 MB，低于模型 URL 输入的 10 MB 限制；
- 不覆盖本地待上传文件，确认上传前保留 IndexedDB 副本；
- 使用 `session_id + sequence_no` 保证重试幂等。

## 7. Atlas 规范

### 7.1 分组

- 每张 Atlas 最多 16 张照片；
- 默认 `4 × 4` 网格；
- 50 张照片生成 4 张 Atlas：1～16、17～32、33～48、49～50；
- 最后一张 Atlas 使用最小可容纳网格，不生成大量空白格；
- 每组必须保留连续时间顺序，不能按相似度重排。

### 7.2 单元格

- 内容区域目标 `512 × 512`；
- 保持照片宽高比，使用深灰或中性背景留白；
- 禁止中心裁剪、旋转排布或紧密不规则打包；
- 编号放在独立标题条中，例如 `P017`，不得覆盖照片；
- 单元格之间至少 8 px 边界；
- Atlas 中写入版本号和照片范围，但不要写用户隐私信息。

### 7.3 输出

- WebP，质量 88；
- 每张 Atlas 独立保存 object key、宽高、字节数和 SHA-256；
- 数据库记录 Atlas 与照片的映射；
- 每个检测结果引用逻辑 `photo_id`，不能只引用 Atlas 坐标。

### 7.4 Atlas 的角色

Atlas 用于：

- 理解装箱时间顺序；
- 判断相邻照片的大范围变化；
- 低成本提取初步物品候选；
- 快速定位需要回查的原图。

Atlas 不用于：

- 读取极小包装文字；
- 对遮挡物品进行精确计数；
- 作为用户原始证据；
- 替代高清原图的疑难复核。

## 8. 图片预处理

Worker 对每张照片执行确定性处理，并记录参数和版本：

1. 解码和 EXIF 方向修正；
2. 限制最大尺寸，避免无意义超高分辨率；
3. 生成保留原始构图的规范图；
4. 计算亮度、清晰度、过曝比例和感知哈希；
5. 标记完全重复或连拍重复；
6. 生成 Atlas 单元格。

只能自动忽略字节完全相同或可以证明为同一连拍副本的照片。不得仅因 SSIM、感知哈希或全图 embedding 相似而删除照片，因为一件随后被覆盖的小物品可能只在某一张高相似照片中出现。

影像增强保持保守：允许轻度阴影提升、白平衡和锐化，不使用生成式补全，不修改物品形状，不消除反光后虚构纹理。

## 9. Qwen3-VL-Plus 推理编排

传输层统一使用官方 `openai` Node.js SDK 的 Chat Completions 客户端。`QWEN_OPENAI_BASE_URL` 与 `QWEN_API_KEY` 由部署环境注入，因此推理编排不依赖 DashScope SDK；切换兼容供应端点时不改变业务 Schema、任务状态机或图片流水线。Qwen 的 `enable_thinking` 作为兼容端点扩展参数，通过 SDK request options 的额外 body 字段发送。SDK 自身重试关闭，由第 9.6 节任务队列统一控制总尝试次数和退避。

### 9.1 模型版本

生产环境固定快照版本，不直接依赖会变化的动态别名：

```text
qwen3-vl-plus-2025-12-19
```

模型版本、提示词版本、Atlas 版本和输出 Schema 版本都写入分析任务，保证结果可追溯和可重放。

### 9.2 第一阶段：Atlas 观察

每张 Atlas 独立调用一次模型，默认使用非思考模式和 JSON Mode。输入包括：

- 当前 Atlas；
- 必要时附上上一张 Atlas 的最后一张缩略图，保持边界连续性；
- 照片编号和顺序说明；
- 严格输出 Schema；
- 禁止推断不可见内容的规则。

本阶段输出“观察事件”，不直接输出最终库存。每个事件描述某张照片相对前序照片中新增、移除、持续可见或不确定的对象。

### 9.3 第二阶段：疑难项高清回查

满足以下任一条件时，Worker 自动把对应原图或局部裁剪送入第二次推理：

- Atlas 中包装文字或小物件过小；
- 相邻图片对同一物品的数量判断冲突；
- 可能将持续出现的物品误判为新增；
- 模型标记为部分遮挡、强反光或名称不确定；
- 输出缺少证据图片；
- 业务 Schema 校验通过但证据规则不通过。

回查应限制在相关的 2～4 张原图，不能重新发送全部 50 张。

### 9.4 第三阶段：物理实例追踪与跨 Atlas 汇总

汇总请求主要输入各 Atlas 的结构化观察，不再重复发送全部高清照片。必要时附加四张 Atlas 作为视觉上下文。

汇总任务负责：

- 为每个真实物体建立稳定的物理实例；
- 合并同一物理实例在连续照片中的持续出现；
- 区分新增第二件物品与同一件物品再次出现；
- 聚合数量证据；
- 将多个同类物理实例聚合为一个带数量的清单项；
- 生成保守、可搜索的中文名称；
- 保留所有证据照片 ID；
- 将不可见袋子记录为外部容器，不生成袋内物品。

实例追踪不能只依靠名称。至少综合拍摄顺序、首次出现时间、外观特征、相对位置、遮挡关系和后续是否持续可见。模型无法确认时宁可保留两个待合并实例，也不能无证据地把两件相同物品合成一件。

### 9.5 第四阶段：强制原图定位与单项裁剪

跨图汇总完成后，每个最终清单项都必须执行一次原图定位，这不是只针对疑难项的可选回查：

1. 从实例证据中选择清晰度高、可见面积大、遮挡少的最佳照片；
2. 将最佳照片和目标实例描述发送给模型；
3. 获取归一化 `bbox`，并验证坐标合法且目标确实位于框内；
4. 使用 Sharp 按原图尺寸裁剪，并在目标框四周增加 10%～18% 上下文边距；
5. 输出独立 WebP 单项图片；
6. 对裁剪结果执行一次低成本视觉验证，确认主体没有被截断或定位到错误对象；
7. 验证失败时尝试下一张证据照片，最多尝试 3 张。

多个同类实例聚合为一条清单时，优先选择能同时展示多个实例的照片和联合框；不存在合适合照时，使用最清晰实例作为代表图，并通过数量文字表达总数。

定位输出使用独立 Schema：

```json
{
  "schema_version": "1",
  "photo_id": "P012",
  "instance_id": "instance-003",
  "bbox": [0.18, 0.32, 0.62, 0.81],
  "visible_fraction": "mostly_visible",
  "crop_suitable": true,
  "reason": null
}
```

`bbox` 固定为 `[x_min, y_min, x_max, y_max]`，所有值归一化到 `0～1`。业务代码必须检查坐标顺序、面积下限、边界和长宽比；非法坐标不能进入 Sharp。

如果三张证据照片都无法生成可靠裁剪，项目进入 `needs_review`，展示明确占位图和最佳原图入口，不得用无关区域充当物品图片。达到 `ready` 的清晰识别项目必须拥有有效裁剪图。

### 9.6 失败恢复

- 单个 Atlas 失败只重试该 Atlas；
- JSON 无效时先以相同请求重试一次；
- 第二次仍无效时使用非思考模式进行 JSON 修复，但不得加入新事实；
- 模型 429、5xx 和网络错误指数退避并加入随机抖动；
- 单阶段最多 5 次尝试，之后标记 `partial_failed`；
- 已成功的 Atlas 结果不因其他分组失败而丢弃；
- 单个物品定位或裁剪失败只重试该物品，不重新执行整个会话；
- 用户可以对失败会话点击“重新分析”。

## 10. 输出 Schema

模型输出的最小结构如下，生产代码使用 JSON Schema 或 Zod/Ajv 进行严格校验：

```json
{
  "schema_version": "1",
  "atlas_id": "atlas-01",
  "observations": [
    {
      "observation_id": "obs-003-01",
      "photo_id": "P003",
      "object_local_id": "P003-O01",
      "action": "appeared",
      "label": "白色 USB-C 充电器",
      "category": "电子配件",
      "quantity": {
        "kind": "exact",
        "value": 1
      },
      "visibility": "clear",
      "container_label": null,
      "evidence_photo_ids": ["P003", "P004"],
      "best_crop_candidate_photo_id": "P003",
      "requires_original_review": false,
      "review_reason": null
    },
    {
      "observation_id": "obs-005-01",
      "photo_id": "P005",
      "object_local_id": "P005-O01",
      "action": "appeared",
      "label": "黑色收纳袋",
      "category": "袋装物品",
      "quantity": {
        "kind": "exact",
        "value": 1
      },
      "visibility": "opaque_container",
      "container_label": null,
      "evidence_photo_ids": ["P005"],
      "best_crop_candidate_photo_id": "P005",
      "requires_original_review": false,
      "review_reason": "内容不可见，只记录外部容器"
    }
  ]
}
```

枚举固定为：

- `action`: `appeared | persisted | disappeared | uncertain`；
- `quantity.kind`: `exact | at_least | approximate | unknown`；
- `visibility`: `clear | partial | occluded | reflective | opaque_container | unknown`。

模型不得输出主观的 `0.93` 概率作为产品置信度。产品确定性由可验证规则派生，例如是否清晰可见、是否有多张证据、是否回查原图、数量是否可逐个数清，以及多次推理是否一致。

## 11. 数据模型

以下为逻辑模型；实施时通过增量迁移创建枚举、表、索引、RLS、RPC 和清理触发器。

### 11.1 `packing_sessions`

| 字段 | 说明 |
| --- | --- |
| `id` | 会话 ID |
| `box_id` | 所属箱子 |
| `owner_id` | 冗余所有者，用于 RLS 和任务索引 |
| `status` | `capturing / uploading / queued / processing / ready / partial_failed / failed / canceled` |
| `photo_count` | 冻结后的照片数量 |
| `model_id` | 实际模型快照 |
| `prompt_version` | 提示词版本 |
| `schema_version` | 输出 Schema 版本 |
| `started_at` | 开始时间 |
| `completed_at` | 用户完成时间 |
| `processed_at` | 后台完成时间 |
| `last_error_code` | 脱敏错误码，不存签名 URL 或模型密钥 |

### 11.2 `packing_photos`

| 字段 | 说明 |
| --- | --- |
| `id` | 照片 ID |
| `session_id` | 装箱会话 |
| `sequence_no` | 从 1 开始，单会话唯一 |
| `object_key` | 原图 R2 key |
| `normalized_object_key` | 规范图 R2 key |
| `mime_type / size_bytes / width / height` | 媒体元数据 |
| `sha256 / perceptual_hash` | 幂等和质量辅助 |
| `quality_flags` | 模糊、过暗、过曝、反光等标记 |
| `upload_status` | 上传状态 |
| `created_at` | 创建时间 |

唯一约束：`(session_id, sequence_no)` 和 `object_key`。

### 11.3 `packing_atlases`

| 字段 | 说明 |
| --- | --- |
| `id` | Atlas ID |
| `session_id` | 装箱会话 |
| `atlas_no` | 会话内序号 |
| `first_sequence_no / last_sequence_no` | 覆盖的照片范围 |
| `object_key` | Atlas R2 key |
| `layout_version` | 例如 `grid-4x4-v1` |
| `width / height / size_bytes / sha256` | 输出元数据 |

唯一约束：`(session_id, atlas_no, layout_version)`。

### 11.4 `packing_analysis_jobs`

| 字段 | 说明 |
| --- | --- |
| `id` | 任务 ID |
| `session_id` | 装箱会话 |
| `stage` | `normalize / atlas / observe / verify / track_instances / consolidate / localize / crop / validate_crops / publish` |
| `scope_key` | Atlas 或照片范围，支持局部重试 |
| `status` | `pending / processing / completed / failed` |
| `attempts` | 尝试次数 |
| `next_attempt_at` | 下次执行时间 |
| `lease_expires_at` | Worker 崩溃后的任务回收时间 |
| `input_fingerprint` | 输入和版本的稳定摘要 |
| `result` | 当前阶段经过 Schema 校验的结构化结果；只对 Worker 可见 |
| `input_tokens / output_tokens / duration_ms` | 模型成本和延迟指标 |
| `last_error_code` | 脱敏错误码 |

唯一约束：`(session_id, stage, scope_key, input_fingerprint)`，保证重复完成请求不会创建重复任务。

### 11.5 `packing_detected_instances`

该表描述真实世界中的一个物理实例，用于区分“同一件物品连续出现”和“新增一件相同物品”。同一个实例可以出现在多张照片中，多个同类实例可以聚合成一个最终清单项。

| 字段 | 说明 |
| --- | --- |
| `id` | 物理实例 ID |
| `session_id` | 来源会话 |
| `detected_item_id` | 汇总后所属清单项，汇总前可为空 |
| `provisional_name` | 观察阶段的临时名称 |
| `tracking_status` | `provisional / tracked / ambiguous / merged / dismissed` |
| `first_seen_photo_id / last_seen_photo_id` | 时间边界 |
| `representative_photo_id` | 最佳代表照片 |
| `appearance_fingerprint` | 仅用于辅助追踪的稳定摘要，不作为唯一判断依据 |
| `created_at / updated_at` | 时间 |

### 11.6 `packing_detected_items`

该表是 AI 清单，不是正式库存。

| 字段 | 说明 |
| --- | --- |
| `id` | 检测项 ID |
| `session_id / box_id` | 来源会话和箱子 |
| `name / category / description` | 自动生成的可搜索内容 |
| `quantity_kind` | `exact / at_least / approximate / unknown` |
| `quantity_value` | 可为空 |
| `visibility` | 可见性枚举 |
| `review_status` | `unreviewed / needs_review / confirmed / corrected / dismissed / promoted` |
| `first_seen_photo_id` | 首次出现证据 |
| `representative_instance_id` | 用于列表图片的代表实例 |
| `cover_object_key` | 单项裁剪图 R2 key；`needs_review` 项可为空 |
| `cover_mime_type / cover_size_bytes / cover_width / cover_height` | 裁剪图媒体元数据 |
| `crop_source_photo_id` | 裁剪来源原图 |
| `crop_bbox` | 来源原图中的归一化定位框 |
| `crop_version` | 定位提示词与裁剪算法版本 |
| `crop_status` | `pending / ready / needs_review / failed` |
| `model_id / prompt_version` | 生成版本 |
| `published_at` | 当前 revision 完整完成后的原子发布时间；为空时用户不可见 |
| `created_at / updated_at` | 时间 |

清晰识别项发布为 `ready` 前，`cover_object_key`、`crop_source_photo_id` 和 `crop_bbox` 必须同时存在。无法可靠裁剪的项目必须进入 `needs_review`，不能伪造完整媒体元数据。

### 11.7 `packing_detected_instance_evidence`

多对多连接物理实例和照片，包含：

- `detected_instance_id`；
- `photo_id`；
- `evidence_kind`：`first_seen / supporting / conflict / verification`；
- 归一化框坐标 `bbox`；对用于裁剪的 `verification` 证据为必填，其他证据可为空；
- `visibility` 和 `crop_suitable`。

定位框用于原图高亮和裁剪，但不作为物品是否存在的唯一证据。最终清单项通过所属实例间接获得全部照片证据。

### 11.8 `packing_item_promotions`

转正式物品是独立的异步工作流，不能在浏览器中复制私有 R2 对象：

- 用户 RPC 校验检测项属于当前用户、当前 revision、数量为精确值且裁剪图已就绪；
- 预先生成稳定的 `target_item_id` 和正式物品 `target_object_key`，重复请求返回同一个 promotion；
- Worker 把会话裁剪图复制到 `users/{owner_id}/boxes/{box_id}/item/{target_item_id}.webp`；
- service-role RPC 在一个数据库事务内创建正式 `items`、写入独立媒体元数据、标记检测项 `promoted` 并完成 promotion；
- 复制或事务失败可以重试；未完成 promotion 的目标对象在删除会话时进入媒体清理，已完成的正式图片不随会话删除。

## 12. AI 清单与正式物品的边界

现有 `items.quantity` 和 `stored_quantity` 是精确库存语义，并参与取出、归还和移动 RPC。AI 的“至少 2 件”或“若干”不能安全写入该模型。

因此：

- `packing_detected_items` 可以立即显示和参与搜索；
- 只有 `quantity_kind = exact` 且用户确认，或用户显式执行“设为正式物品”后，才创建 `items`；
- 转换操作在数据库事务内完成，并把检测项标记为 `promoted`；
- 转换时将 AI 单项裁剪图复制到正式物品的独立媒体路径，并把新的媒体元数据写入 `items`；
- 正式物品不得引用可能随装箱会话删除的原图、Atlas 或会话裁剪路径；
- AI 清单不能执行取出、归还或移动；用户首次执行这些操作时先完成转换。

这样既满足“拍完即可搜索”，又不会让模型估计破坏现有精确流转数据。

## 13. 搜索与公开访问

搜索 RPC 扩展为同时返回：

- 正式 `items`；
- 未驳回的 `packing_detected_items`。

排序优先级：

1. 用户确认的正式物品；
2. 用户修正或确认的 AI 检测项；
3. 清晰且有多张证据的 AI 检测项；
4. 需要确认的模糊结果；
5. 未知容器。

原始装箱照片默认只允许箱子所有者访问，即使箱子是公开的也不直接公开整套家庭照片。公开箱子是否展示 AI 清单应作为单独产品开关；默认仅展示已确认或已转为正式物品的项目。

## 14. 权限、隐私与安全

- 所有会话、照片、Atlas、任务和检测项启用 RLS。
- 浏览器只能访问当前账号拥有的箱子会话。
- 任务表不向普通 authenticated 客户端开放写权限；只能通过受控 RPC 创建或查询状态。
- Worker 使用最小权限的 service role 和仅限目标 Bucket 的 R2 Token。
- Qwen 请求使用短效签名 GET URL，过期时间只覆盖本次推理。
- 不在模型提示词、日志或错误信息中包含用户 ID、签名查询参数和密钥。
- 记录模型供应区域、数据处理条款和保留策略，生产上线前完成隐私评审。
- 用户删除会话时同时删除 AI 结果并异步清理原图、规范图、Atlas 和未提升的单项裁剪图。
- 已提升为正式物品的图片位于独立路径，不随装箱会话删除。
- 原图默认保留作为证据；后续可以提供“只保留清单，删除装箱照片”的明确选项。

## 15. 状态机与一致性

```text
capturing
  └── uploading
        └── queued
              └── processing
                    ├── ready
                    ├── partial_failed
                    └── failed

capturing / uploading ──→ canceled
```

关键规则：

- `complete_packing_session` 使用行锁，冻结照片数和顺序，只能成功一次。
- 只有所有已声明照片都为 confirmed 才能进入 `queued`。
- Worker 使用有期限的 lease 认领任务，崩溃后任务可自动回收。
- 每个处理产物由输入指纹和版本决定，相同输入重复执行只能覆盖同一逻辑产物。
- 实例追踪、清单汇总、定位裁剪全部完成后，再在一个数据库事务中发布新 revision 的检测项。
- 重新分析创建新 analysis revision；新结果完整成功前，用户继续看到上一版结果。

## 16. 性能与成本策略

- 默认最多两个并发上传，避免移动端内存和网络抖动。
- Atlas 分组可以并行分析，但单会话默认并发不超过 2。
- 默认使用非思考模式；只对冲突和疑难项使用第二次推理。
- 不默认开启所有原图最高分辨率；小文字和小物件按需回查。
- 业务侧记录每次调用的输入、输出 Token、延迟、模型版本和重试次数。
- 为单会话设置模型预算；超过预算后发布部分结果并标记 `partial_failed`，不得无限回查。
- 50 张原图不一次性送入模型，避免接近上下文上限以及单次失败导致整体重跑。

建议初始限制：

- 软提醒：30 张；
- 常规支持：50 张；
- 硬限制：100 张；
- 每张 Atlas：16 张；
- 高清回查：每批最多 4 张；
- 单会话分析任务最大尝试：每阶段 5 次。

这些值必须通过真实数据评估后调整，不能仅依据模型的理论输入上限。

## 17. 可观测性

至少记录以下指标：

- 会话完成率；
- 每会话照片数和总字节数；
- 上传失败与恢复率；
- Atlas 生成耗时；
- 各模型阶段延迟和 Token；
- JSON 校验失败率；
- 高清回查比例；
- 物理实例误合并率和漏合并率；
- 原图定位成功率、裁剪验证失败率和平均局部重试次数；
- 单箱模型成本；
- `partial_failed` 和最终失败率；
- 用户删除、修改、合并和确认 AI 项目的比例；
- 正式评测集上的可见物品召回、虚构率、重复率和数量准确率。

日志只记录内部 ID、阶段、耗时和脱敏错误码，不记录照片 URL、模型完整响应或用户家庭物品文本。需要调试原始响应时使用受限、短期、明确开启的诊断机制。

## 18. 测试策略

### 18.1 评测数据集

开发模型集成前先收集至少 30～50 个真实装箱会话，覆盖：

- 3、10、30、50 张照片；
- 透明、半透明和不透明袋；
- 强阴影、反光、弱光和轻微模糊；
- 衣物、线材、图书、工具、小零件和电子产品；
- 同一物品连续出现；
- 新增两个外观相同的物品；
- 物品短暂出现后被完全覆盖；
- 改变角度和手机方向。

人工标注只标记照片中确实可见的事实，不把袋内已知但画面不可见的内容算作模型漏识别。

### 18.2 数据库测试

- 非所有者不能创建、完成、读取或删除会话。
- 照片顺序唯一，完成后不可追加。
- 重复完成请求不创建重复任务。
- 任务 lease、回收、退避和最大尝试正确。
- 会话/箱子删除能级联元数据并排队清理所有对象。
- AI 检测项不能直接调用物品流转 RPC。
- 转正式物品事务不会产生重复项目。
- 删除装箱会话不会删除已提升正式物品的独立图片。

### 18.3 Worker 测试

- EXIF 方向、横竖图和不同宽高比不被裁剪。
- 1～16 张生成正确网格；17、32、50、100 张正确分组。
- 最后一张 Atlas 使用最小网格。
- 照片编号不覆盖内容且映射准确。
- 重试保持相同对象 key 和输入指纹。
- 模型无效 JSON、429、5xx 和超时均按规则处理。
- 回查只发送目标原图，不意外发送整个会话。
- 同一实例跨图持续出现不会增加数量，新增相同实例会增加数量。
- 定位框坐标经过边界、面积、顺序和长宽比校验后才进入 Sharp。
- 单项裁剪包含规定上下文边距，不截断主体且不会越过原图边界。
- 单个裁剪失败可以切换证据照片并局部重试。
- 会话删除会清理未提升裁剪图，正式物品图片继续可访问。

### 18.4 前端测试

- 拍照后立即回到取景状态。
- 弱网时本地队列不会丢失或打乱顺序。
- 页面刷新后可以恢复未完成会话。
- 上传未完成时“装箱完成”显示明确进度。
- 用户离开页面后后台状态仍可恢复展示。
- 结果页能区分正式物品、AI 项目和未知容器。
- 清晰 AI 项目显示自己的单项裁剪图，不使用整张箱内照片作为缩略图。
- 点击证据可以打开正确原图。

## 19. 分阶段实施

### 阶段 0：真实数据验证

- 定义评测标注规范和核心指标。
- 收集 30～50 个真实装箱会话。
- 使用固定提示词手工运行 Qwen3-VL-Plus 原型。
- 对比“50 张原图一次输入”“4 张 Atlas”“Atlas + 原图回查”。
- 确认目标召回、虚构率、重复率、成本和延迟门槛。

退出条件：Atlas + 回查方案在可见物品召回和虚构率上达到可接受基线，并明确不能识别的场景。

### 阶段 1：会话与连续拍照

- 创建数据库表、RLS 和上传 RPC。
- 实现拍摄页、IndexedDB 本地队列和并发上传。
- 实现完成、取消和恢复会话。
- 在箱子详情展示装箱会话状态。
- 暂不接入 AI，只验证 50 张照片的端到端可靠上传。

退出条件：弱网、刷新和重复请求不会丢失、打乱或重复照片。

### 阶段 2：Atlas Worker

- 新增 `apps/packing-worker`。
- 实现任务认领、lease、退避和幂等。
- 使用 Sharp 生成规范图和 4 × 4 Atlas。
- 实现接收已校验 bbox 的确定性裁剪基础能力和单项图片对象路径。
- 实现 R2 派生对象清理。
- 建立 Atlas 可视化调试页，仅开发和测试环境使用。

退出条件：1～100 张照片均能生成顺序和映射正确的 Atlas，局部失败可重试。

### 阶段 3：Qwen 推理

- 固定模型快照、提示词和 JSON Schema。
- 实现逐 Atlas 观察。
- 实现 JSON 校验和模型错误重试。
- 实现高清原图回查。
- 实现物理实例追踪、跨 Atlas 汇总和同类实例聚合。
- 为每个最终项目实现强制原图定位、单项裁剪和裁剪验证。
- 实现检测项 revision 的原子发布。
- 记录 Token、延迟和单会话成本。

退出条件：真实评测集达到阶段 0 设定门槛；不透明容器不产生虚构内容；所有清晰识别项目都有经过验证、可追溯到原图的单项图片。

### 阶段 4：结果、搜索与转正式物品

- 箱子详情显示 AI 清单和证据。
- AI 项目与正式物品使用统一清单行，并显示单项裁剪图和 AI 状态。
- 支持修改、合并、驳回和重新分析。
- 搜索同时覆盖正式物品和 AI 清单。
- 实现检测项转正式物品事务。
- 为公开箱子落实默认不暴露原始装箱照片的策略。

退出条件：用户可以只拍照完成装箱，随后搜索到 AI 项目，并能安全转成支持流转的正式物品。

### 阶段 5：成本和质量优化

- 根据真实数据调整 Atlas 单元格尺寸和分组数。
- 对清晰简单场景评估更低成本模型，疑难场景继续使用 Plus。
- 增加面向模型输入的局部区域回查，减少发送整张高清原图。
- 根据真实纠错数据优化最佳证据照片选择和实例追踪规则。
- 优化同义词搜索、多模态 embedding 和结果排序。
- 根据用户纠错数据改进提示词，但不未经同意用于外部训练。

## 20. 上线门槛

上线前至少满足：

- 真实测试集包含 50 张照片、塑料袋、强阴影和遮挡场景。
- 不透明袋内部物品虚构率为零。
- 每个 AI 项目至少有一张有效证据照片。
- 每个清晰识别项目都有独立裁剪图、合法 bbox 和可访问的来源原图。
- 同一实例重复出现和多个相同实例的测试样本达到预设去重门槛。
- 重复完成、Worker 重启和模型重试不会重复发布清单。
- 用户关闭页面后任务继续，回到箱子可以看到最终状态。
- 非所有者不能访问原图、Atlas、检测项或任务详情。
- 删除箱子或会话后所有派生对象进入清理流程。
- 单箱成本和 P95 处理时间有监控和预算上限。
- AI 清单不能绕过确认进入现有精确流转操作。
- 隐私政策明确说明照片会发送给第三方视觉模型处理。

## 21. 建议的首版范围

首版只实现一条完整而保守的闭环：

```text
连续拍照
→ 可靠上传
→ 4 × 4 Atlas
→ Qwen3-VL-Plus 分组观察
→ 必要原图回查
→ 构建并追踪物理实例
→ 跨组去重并聚合同类实例
→ 为每个项目选择最佳证据原图
→ 强制定位、裁剪并验证单项图片
→ 生成带图片和原图证据的可搜索 AI 清单
→ 用户按需转为正式物品
```

首版不加入语音、视频、商品库和自动公开照片。成功标准不是让模型生成一份看似完整的漂亮清单，而是在真实装箱环境中做到：不增加用户输入负担、尽可能找到可见物品、明确表达不确定性，并让每个结论都能回到原始照片验证。

## 22. 外部技术参考

以下能力和限制在 2026-08-03 依据官方文档确认，正式实施前应再次检查模型快照、区域、限流和价格：

- [Qwen3-VL-Plus 模型信息](https://help.aliyun.com/zh/model-studio/qwen3-vl-plus)
- [视觉理解与多图输入](https://help.aliyun.com/zh/model-studio/vision)
- [千问结构化输出](https://help.aliyun.com/zh/model-studio/qwen-structured-output)
- [OpenAI 兼容接口](https://help.aliyun.com/en/model-studio/qwen-api-via-openai-chat-completions)
- [OpenAI 官方 Node.js SDK](https://github.com/openai/openai-node)
