# Nomo 3-Box Reset：38 秒 H3 视频包

这个目录包含生成 16:9、38 秒 Nomo 产品视频所需的完整参考图、真实产品界面截图、11 段 MiniMax H3 Ref2VA 提示词和总剪辑单。视频按短镜头分别生成，再在剪辑软件中按固定时间线组合；不要尝试一次生成 38 秒。

## 目录

- `manifest.json`：尺寸、时长、参考图索引和每段镜头映射的唯一清单。
- `references/`：上传给 ComfyUI 的 12 张 1920 × 1080 参考图。
- `prompts/clip-01.md`–`clip-11.md`：可直接使用的 H3 英文提示词。
- `prompts/master-edit.md`：精确到秒的画面、字幕/旁白、声音和剪辑规则。
- `source/ui/`：从 Nomo 受控网页状态导出的 5 张真实移动端界面截图。
- `source/generated/`：ImageGen 生成并通过连续性检查的物理场景母图。
- `scripts/`：界面捕获、参考图合成和完整性校验工具。

## 1. ComfyUI 上传顺序（必须从 0 开始）

ComfyUI 中第一张图就是 `<Picture 0>`，不是 `<Picture 1>`。严格按下面顺序上传，不要依赖文件选择器的临时排序：

| ComfyUI 索引 | 文件 | 用途 |
| --- | --- | --- |
| `<Picture 0>` | `00-three-open-boxes.png` | 三个打开的空箱 |
| `<Picture 1>` | `01-box-1-open-empty.png` | Box 1 空箱近景 |
| `<Picture 2>` | `02-box-1-open-packed.png` | Box 1 已装入三件物品 |
| `<Picture 3>` | `03-iphone-capturing-box.png` | Nomo AI packing 实际界面 |
| `<Picture 4>` | `04-iphone-ai-results-before.png` | Add to list 前 |
| `<Picture 5>` | `05-iphone-ai-results-after.png` | HDMI 行消失后 |
| `<Picture 6>` | `06-iphone-box-1-inventory.png` | Box 1 三件物品库存 |
| `<Picture 7>` | `07-box-1-closed-unlabeled.png` | 已合箱、无二维码 |
| `<Picture 8>` | `08-box-1-closed-labeled.png` | 第一次出现唯一二维码 |
| `<Picture 9>` | `09-iphone-scanner.png` | Nomo Scan to view 界面 |
| `<Picture 10>` | `10-iphone-scanning-label.png` | 扫描器与同一个二维码 |
| `<Picture 11>` | `11-nomo-cta.png` | 最终 CTA |

上传后先目视核对第一张节点输入显示为索引 0，最后一张显示为索引 11。如果工作流会自动重新排序，改为逐张连接或显式写入索引。

## 2. 分段生成映射

每一段单独生成，画幅固定 16:9。时长直接采用清单，不要让任何单段超过 5 秒。

| Clip | 时长 | 参考方式 | 参考图 |
| --- | ---: | --- | --- |
| 01 | 3s | 单锚点（I2VA-like） | 0 |
| 02 | 4s | 首尾帧（FL2VA-like） | 1 → 2 |
| 03 | 4s | 单锚点（I2VA-like） | 3 |
| 04 | 4s | 单锚点（I2VA-like） | 4 |
| 05 | 4s | 首尾帧（FL2VA-like） | 4 → 5 |
| 06 | 3s | 单锚点（I2VA-like） | 6 |
| 07 | 4s | 首尾帧（FL2VA-like） | 2 → 7 |
| 08 | 4s | 首尾帧（FL2VA-like） | 7 → 8 |
| 09 | 4s | 首尾帧（FL2VA-like） | 9 → 10 |
| 10 | 2s | 首尾帧（FL2VA-like） | 10 → 6 |
| 11 | 2s | 单锚点（I2VA-like） | 11 |

`I2VA-like` 和 `FL2VA-like` 描述的是参考图使用方式；实际节点仍使用你的 H3 Ref2VA 工作流。把对应 `clip-XX.md` 中从 `subject_definitions:` 到 `non_diegetic_music:` 的完整内容粘贴为该段提示词。

## 3. 生成顺序

1. 先生成 Clip 01、02、07、08，检查物理动作：物品由手放入；短箱盖先合、长箱盖后合；二维码只在 Clip 08 被贴一次。
2. 再生成 Clip 03–06，检查银色 iPhone 17 Pro Max 机身和 Nomo UI：不允许模型重写文字或发明控件。
3. 生成 Clip 09、10，检查二维码始终是同一张、同一位置、同一像素图案；扫描后直接切到 Box 1。
4. 最后生成 Clip 11。CTA 只能做 2% 推镜，文字不得动画或重排。
5. 将合格片段按 `prompts/master-edit.md` 的顺序直接剪切组合，最终时长必须为 38.00 秒。

## 4. UI 与二维码锁层

H3 负责生成运动，不负责重新设计 Nomo 界面或二维码。如果模型发生文字漂移、图标变形或二维码变化，必须在剪辑阶段重新合成受保护层：

- Picture 3 的手机屏幕起始区域：`x=1260, y=40, w=480, h=1000`。
- Picture 4、5、6、9 的手机屏幕区域：`x=720, y=40, w=480, h=1000`。
- Picture 10 的手机屏幕区域：`x=200, y=40, w=480, h=1000`。
- Picture 8、10 的二维码标签：`x=1110, y=570, w=150, h=150`。

若手机发生轻微位移，用四角跟踪或 corner pin 把 `source/ui/` 对应截图重新贴回屏幕；若手机保持锁定，可直接覆盖。二维码使用 Picture 8 的固定 150 × 150 标签层跟踪覆盖。重新合成这些层不增加新的 Picture 索引。

## 5. 固定叙事逻辑

正确流程只有一条：把物品放入打开的 Box 1 → 用 Nomo 拍摄 → AI 得到三件物品 → 点击真实 `Add to list`，HDMI 行消失 → Box 1 显示三件已保存 → 人手按正确方向合箱 → 第一次贴一个二维码 → 打开真实扫描器 → 扫同一个二维码 → 直接显示 Box 1 库存。

视频中没有搜索步骤、没有虚构的查看按钮、没有自动合箱、没有预先存在的二维码，也没有第二次贴码。

## 6. 重新生成本地素材

重新导出 UI 前，在一个终端启动受控页面：

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=capture-anon-key \
VITE_PUBLIC_APP_ORIGIN=http://127.0.0.1:4173 \
VITE_PUBLIC_SUPPORT_EMAIL=capture-support@example.com \
npm run dev --workspace=@nomo/web -- --host 127.0.0.1 --port 4173
```

另一个终端运行：

```bash
node creative/three-box-reset-38s/scripts/capture-ui.mjs
node creative/three-box-reset-38s/scripts/compose-references.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs
```

## 7. 交付前 QA

```bash
npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx
npm run typecheck --workspace=@nomo/web
npm run lint --workspace=@nomo/web
node --test creative/three-box-reset-38s/scripts/verify-package.test.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs
git diff --check
```

人工检查五项：UI 文字可读；Box 1 始终是同一个箱子；三件物品身份一致；合箱方向符合物理；二维码从 00:26 起只出现一个且扫描前后像素不变。

## 范围说明

此包已经提供 H3 生成所需的全部本地参考素材和可复制提示词。最终 H3 MP4 需要在用户的 ComfyUI / MiniMax H3 工作流中渲染；当前仓库没有可调用的 H3 推理端点，因此不伪造一个未生成的成片。
