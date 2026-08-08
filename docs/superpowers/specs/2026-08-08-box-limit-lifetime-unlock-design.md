# 免费箱子上限与永久解锁设计

## 1. 背景与目标

Nomo 当前允许登录用户直接创建任意数量的箱子，并已具备 Stripe 一次性 Checkout、Webhook 幂等收件箱和本地 AI Credits 账本。本功能在不改变 AI Credits 商业模式的前提下，为箱子数量增加免费额度与一次性永久解锁权益。

目标规则如下：

- 免费账号可同时保有最多 3 个未删除箱子；
- 删除箱子后立即释放一个免费名额；
- HK$38 一次性购买后，永久解锁该 Nomo 账号的箱子数量；
- 箱子永久权益与 AI Credits 完全独立，购买权益不赠送或免除 AI Credits；
- 老用户上线时已有超过 3 个箱子的，全部数据和功能继续可用，但购买权益或将箱子数降至 3 个以下之前不能新增；
- 全额退款会撤销永久权益，但不会删除、锁定或降级已有箱子。

这里的“永久”表示权益在该 Nomo 账号及 Nomo 服务存续期间持续有效，不表示承诺服务永久运营。

## 2. 范围与非目标

### 2.1 本期范围

- 账号级箱子权益数据；
- 数据库强制执行的免费箱子上限；
- Stripe HK$38 一次性购买、到账、恢复显示和全额退款撤销；
- 箱子页额度状态、响应式付费墙和支付确认状态；
- 中英文文案、无障碍、测试、监控及发布迁移。

### 2.2 非目标

- 不提供订阅、自动续费、试用期、家庭共享或权益转让；
- 不限制空间、场地、物品、二维码或已有箱子的使用；
- 不改变 AI Credits 的价格、余额或消耗规则；
- 不自动处理部分退款；部分退款继续进入人工审核；
- 不删除或自动归档老用户、退款用户的超额箱子。

## 3. 方案选择

采用“独立权益表 + 数据库原子创建 RPC”。前端只提供及时、友好的额度提示，数据库是是否允许创建箱子的最终权威。

没有采用以下方案：

- `profiles.unlimited_boxes` 布尔值无法完整记录购买来源、退款撤销和未来其他权益；
- 创建时实时查询 Stripe 会让核心操作依赖外部网络，延迟和可用性均不可控；
- 仅在前端检查箱子数量可被直接 API 调用绕过，也无法防止多标签页并发创建第 4 个箱子。

## 4. 数据设计

### 4.1 账号权益

新增 `public.account_entitlements`：

| 字段 | 规则 |
| --- | --- |
| `id` | UUID 主键 |
| `user_id` | 引用 `auth.users(id)`，账号删除时级联删除 |
| `entitlement_code` | 本期固定为 `boxes_unlimited_lifetime` |
| `status` | `active` 或 `revoked` |
| `source_provider` | 本期为 `stripe`，保留人工补发能力 |
| `source_reference` | Stripe 来源使用 `checkout:<session_id>` |
| `granted_at` | 权益首次发放时间 |
| `revoked_at` | 未撤销时为空 |
| `created_at` / `updated_at` | 审计时间 |

约束：

- `(user_id, entitlement_code)` 在 `status = active` 时使用部分唯一索引，保证一个账号同类权益同时只有一条有效记录；
- `(source_provider, source_reference)` 唯一，防止同一订单重复发放；
- `active` 时 `revoked_at` 必须为空，`revoked` 时必须有撤销时间；
- 客户端不能直接读写表，只能通过受控 RPC 获取摘要；service role 通过受控 RPC 发放或撤销。

本期保留被撤销的权益记录，不物理删除，以支持退款审计。退款后重新购买时，由新的 Checkout 来源创建一条新的有效记录，历史订单及其撤销状态不被覆盖。

### 4.2 Stripe Webhook 收件箱

复用 `stripe_webhook_events` 作为事件级幂等收件箱。`account_entitlements` 的唯一约束提供业务级第二层幂等保护。

## 5. 数据库 API 与并发控制

### 5.1 `get_box_plan_summary()`

登录用户可调用，返回单行：

- `box_count`：当前账号未删除箱子数；
- `free_limit`：固定为 `3`；
- `unlimited_boxes`：是否持有有效的 `boxes_unlimited_lifetime`；
- `can_create`：`unlimited_boxes OR box_count < free_limit`。

该摘要用于页面展示和提前打开付费墙，但不替代创建时的数据库校验。

### 5.2 `create_box(...)`

新增 `security definer` RPC，接收现有箱子创建字段并返回 `id`、`public_id`、`box_code` 和 `name`。函数固定安全 `search_path`，并按以下顺序执行：

1. 验证 `auth.uid()` 存在；
2. 使用以用户 UUID 派生的事务级 advisory lock 串行化该账号的箱子创建；
3. 验证目标空间属于当前用户；
4. 查询有效永久权益；
5. 未解锁时统计当前箱子数；
6. 数量达到或超过 3 时抛出稳定业务错误 `box_limit_reached`；
7. 写入箱子并返回已创建记录。

事务级用户锁用于防止以下竞争：用户已有 2 个箱子，两个标签页同时创建时，只有第一个能成功，第二个在获得锁后看到数量已是 3 并失败。

迁移同时撤销 `authenticated` 对 `boxes` 的直接 `INSERT` 权限。现有 `UPDATE`、`DELETE` 和读取能力保持不变，创建统一经过 RPC。RLS 继续作为纵深防御，RPC 内再次验证空间所有权。

## 6. 支付与权益生命周期

### 6.1 Checkout

在现有 `billing-checkout` 增加受控 action：

- action：`boxes_unlimited`；
- Stripe Price 环境变量：`STRIPE_BOXES_UNLIMITED_PRICE_ID`；
- 模式：`payment`；
- 展示价格：HK$38；
- success URL：`/app/boxes?purchase=success`；
- cancel URL：`/app/boxes?purchase=canceled`；
- metadata：`supabase_user_id`、`checkout_action=boxes_unlimited`、`entitlement_code=boxes_unlimited_lifetime`。

客户端永远不提交金额或 Price ID。Edge Function 从服务端 allowlist 读取 Price ID。创建 Checkout 前先查询本地权益；已有有效权益时返回 `entitlement_already_owned`，避免常规重复购买。客户端在请求进行中禁用购买按钮。

### 6.2 付款成功

`stripe-webhook` 收到 `checkout.session.completed` 后，只有在以下条件全部满足时才发放：

- `session.mode = payment`；
- `session.payment_status = paid`；
- 用户身份、Customer 和受控 metadata 完整；
- action 与 entitlement code 是服务端支持的固定组合。

Webhook 调用 service-role-only 的 `grant_account_entitlement(...)`。Checkout Session ID 作为来源引用；重复事件、Webhook 重放或函数重试不会重复发放。

客户端禁用重复提交、Checkout 创建前检查有效权益，两者覆盖正常重复购买路径。如果极小概率下两个 Checkout 在权益到账前均完成付款，第一笔发放有效权益，第二笔不会创建第二份有效权益；Webhook 记录 `duplicate_paid_entitlement` 告警并进入人工退款处理，不能反复重试发放。

现有 Credits Checkout 分支保持原行为，箱子权益订单不创建 credit grant。

### 6.3 支付返回与确认延迟

返回 `purchase=success` 不等于权益已到账。箱子页进入“正在确认购买”状态，立即刷新摘要并进行有限次数的退避轮询。确认期间不显示新的购买按钮，避免用户重复下单。

权益到账后：

1. 失效并刷新箱子权益查询；
2. 提示“无限箱子已解锁”；
3. 清理 URL 中的购买状态；
4. 自动打开创建箱子表单。

达到轮询时限仍未到账时，页面不声称失败，而是显示“付款正在确认”，提供“重新检查”和联系支持的入口。支持信息应包含可安全提供的 Checkout 结果标识，不展示支付方式等敏感信息。

### 6.4 退款与重新购买

`charge.refunded` 只在全额退款时自动处理。Webhook 根据关联 Checkout 的 `checkout_action` 分流：

- Credits 订单沿用 `revoke_unused_credits`；
- 箱子权益订单调用 `revoke_account_entitlement(...)`；
- 部分退款记录事件但不自动撤销权益，交由人工审核。

撤销权益不修改任何箱子。退款后：

- 箱子数少于 3 时，可继续创建到 3 个；
- 箱子数等于或超过 3 时，不可新增；
- 所有已有箱子仍可查看、编辑、删除和管理物品；
- 用户可再次以当前公开价格购买并重新激活权益。

## 7. 前端体验

### 7.1 箱子页状态

箱子页查询 `get_box_plan_summary()` 并展示：

- 免费且未满：`2 / 3 个免费箱子`；
- 免费且已满：`3 / 3 · 已达免费上限`；
- 已永久解锁：`无限箱子 · 已永久解锁`；
- 老用户或退款后超额：`已有 5 个箱子 · 免费上限 3 个`。

摘要加载失败不阻止用户点击创建；创建 RPC 仍会给出权威结果。页面可以显示非阻塞的刷新错误。

### 7.2 创建入口与付费墙

- `can_create=true`：点击创建按钮正常打开现有创建表单；
- `can_create=false`：直接展示付费墙，不先打开表单；
- 如果摘要过期、另一标签页刚创建第 3 个箱子，表单提交收到 `box_limit_reached` 后保留表单内容并展示付费墙；
- 解锁到账后关闭付费墙并继续创建流程。

付费墙沿用当前响应式 Apple App 设计语言：移动端为底部 Sheet，桌面端为居中弹窗；支持 Escape、焦点恢复、滚动锁定、安全区、44px 触控目标和 `prefers-reduced-motion`。

核心内容：

- 标题：`免费版最多可保有 3 个箱子`；
- 说明：`一次购买，永久解锁无限箱子。已有箱子和物品不会受影响。`；
- 边界说明：`AI 图片识别 Credits 需单独购买`；
- 主按钮：`HK$38 永久解锁`；
- 次按钮：`暂不需要`；
- 辅助说明：`一次性付款，不订阅、不自动续费`。

中英文文案必须同时提供，不在 JSX 内硬编码用户可见字符串。

### 7.3 支付结果

- `purchase=canceled`：保持原数据，显示克制的取消提示并清理 URL；
- Webhook 已确认：显示成功反馈并自动打开创建表单；
- Webhook 延迟：显示确认状态，不允许重复购买；
- `entitlement_already_owned`：刷新摘要并继续创建，不显示付款失败；
- `billing_unavailable`：显示支付服务暂不可用，允许稍后重试，已有功能不受影响。

## 8. 错误契约

| 错误码 | 含义 | 客户端处理 |
| --- | --- | --- |
| `box_limit_reached` | 免费账号当前箱子数已达到 3 | 保留表单内容并展示付费墙 |
| `entitlement_already_owned` | 当前账号已有有效权益 | 刷新摘要后继续创建 |
| `invalid_checkout_action` | Checkout action 不受支持 | 通用支付错误，不重试同一请求 |
| `billing_unavailable` | 支付服务暂不可用 | 非破坏性错误，允许稍后重试 |
| `authentication is required` | 未登录或会话过期 | 引导重新登录 |
| `space is not accessible` | 空间不属于当前用户 | 保留输入并要求重新选择空间 |

业务错误必须保持稳定，不通过匹配完整数据库错误文案判断。

## 9. 安全与隐私

- 免费上限在数据库强制执行，不能只依赖客户端；
- `create_box` 使用事务锁，避免并发突破配额；
- 权益写 RPC 只授予 service role，客户端只可读取自己的摘要；
- Stripe Secret、Webhook Secret 和 Price ID 只存在 Edge Function Secrets；
- Checkout return URL 继续使用服务端 `PUBLIC_APP_ORIGIN` allowlist；
- Webhook 继续使用原始请求体校验 Stripe 签名；
- 日志记录用户 ID、事件 ID、action、结果和稳定错误码，不记录支付方式、家庭物品或图片内容；
- 条款增加一次性数字权益、退款后撤销和“永久”的服务存续边界。

## 10. 测试与验收

### 10.1 数据库测试

- 免费用户可创建第 1、2、3 个箱子；
- 第 4 个箱子返回 `box_limit_reached` 且没有插入记录；
- 删除一个箱子后可再创建一个；
- 有效权益用户超过 3 个后仍可创建；
- 被撤销权益按免费规则判断；
- 老用户已有超过 3 个箱子时数据不变，新增被拒绝；
- 已有 2 个箱子时并发创建两次，只成功一次；
- 用户不能在他人的空间中创建箱子；
- 客户端直接插入 `boxes` 被权限拒绝；
- 权益发放、撤销和重新激活均保持约束与幂等。

### 10.2 Edge Function 测试

- `boxes_unlimited` 只映射服务端 Price allowlist；
- 已解锁账号不能再次创建常规 Checkout；
- 付款未完成不发放权益；
- 合法付款发放一次，重复 Webhook 不重复发放；
- Credits 与箱子权益事件正确分流；
- 全额退款撤销权益，部分退款不自动撤销；
- 无效签名、身份不一致或受控 metadata 不匹配时拒绝处理并留下可重试记录。

### 10.3 前端与 E2E 测试

- 额度标签覆盖免费未满、免费已满、老用户超额和已解锁状态；
- 已满时创建按钮打开响应式付费墙；
- 服务端竞态返回时保留表单内容；
- 购买、取消、到账延迟、成功和重复购买保护流程正确；
- 成功到账后自动打开创建表单；
- 退款后已有箱子仍可操作；
- 中英文文案齐全；
- Sheet/弹窗的 Escape、焦点陷阱、焦点恢复、滚动锁定和移动安全区通过测试。

## 11. 可观测性

记录以下产品事件：

- `box_limit_paywall_viewed`；
- `box_unlimited_checkout_started`；
- `box_unlimited_purchase_confirmed`；
- `box_unlimited_purchase_confirmation_delayed`；
- `box_created_after_unlock`。

服务端指标包括 `box_limit_reached` 次数、Checkout 创建失败率、Webhook 处理延迟/失败/重放、权益发放/撤销数量和重复购买拦截次数。按漏斗观察“达到上限 → 看到付费墙 → 发起 Checkout → 权益到账 → 解锁后创建”的转化。

## 12. 发布顺序与回滚

1. 配置 Stripe HK$38 一次性 Price 与 `STRIPE_BOXES_UNLIMITED_PRICE_ID`；
2. 以加法迁移部署权益表、摘要 RPC、创建 RPC 和 pgTAP 测试，暂时保留旧版前端所需的直接 `INSERT` 权限；
3. 部署 Checkout/Webhook 分流和函数测试；
4. 部署改用 `create_box` RPC 的前端、额度摘要、付费墙、支付确认和中英文文案；
5. 等待旧静态资源和缓存版本退出后，再以收口迁移撤销客户端对 `boxes` 的直接 `INSERT` 权限；此步骤完成前功能不视为已正式强制生效；
6. 在 Stripe test mode 完成购买、延迟 Webhook、重复事件、全额退款和重新购买闭环；
7. 灰度开启付费墙并观察错误率与转化，再全量发布。

数据库迁移不修改或删除现有箱子。紧急回滚时，回退前端付费墙，并通过经过审核的向前迁移临时恢复原有箱子创建权限；已经购买的权益记录必须保留，不能因回滚丢失。修复后再重新执行权限收口，不删除权益表或已购数据。

## 13. 完成标准

当以下条件全部满足时，本功能完成：

- 数据库在正常请求、直接 API 和并发请求下都无法让免费用户突破 3 个箱子；
- 老用户和退款用户的已有箱子始终安全可用；
- HK$38 一次性购买可在 Stripe test mode 完成发放、幂等、全额退款撤销和重新购买；
- 箱子权益不会改变 AI Credits；
- 移动端、桌面端、中英文和无障碍流程通过自动化测试；
- 付费与额度关键指标可观察，条款已同步。
