# Nomo AI Credits 与 Stripe 权威设计

> 本文是 Nomo AI 识别计量、credit 发放/扣减、Stripe 支付和相关 UI 的唯一权威设计。任何相关实现变更必须先同步本文。

## 1. 商业决策

- 不提供 AI 订阅、会员、月付或自动续费。
- AI 识别仅消耗用户预付 credits；任何登录用户都可一次性购买。
- `1 张提交分析的装箱照片 = 1 credit`。未提交的草稿不消耗。
- Stripe 只负责一次性收款和退款；Nomo Postgres 是 credit 余额、预留和消费的实时权威。
- 已购 credits 默认长期有效。只有促销/补偿 credits 可通过 `expires_at` 设置期限。
- `202608110002_growth_launch_credits.sql` 部署后新创建的每个账号会获得一次 `10` 个 promotional Credits；`effective_at` 起 30 天后过期。该 signup grant 的来源标识固定为 `signup:<user-id>:growth-launch-v1`，对应流水为 `grant:promotional:signup:<user-id>:growth-launch-v1`。
- 该 migration 只影响部署后创建的用户。更早的 seed 用户如需补发，必须由 service role 明确执行受控发放操作，并记录独立、可追溯的 `source_reference`；不得把历史补发伪装成新的 signup grant。
- 所有 credit 页面和拦截 Sheet 沿用 Apple App 设计语言：内容优先、克制色彩、大圆角、毛玻璃遮罩、44px 以上触控区、安全区与明确反馈。

## 2. 为什么按照片计费

当前链路每 16 张照片生成一张 Atlas，内部还会执行 Atlas 观察、可选高清复核、跨 Atlas 聚合、逐项定位和裁剪验证。设 `N` 为照片数、`A = ceil(N/16)` 为 Atlas 数、`R <= A` 为复核数、`I` 为检测项数，模型调用约为 `A + R + 1 + 2I`。

模型调用数不稳定且用户无法预测，因此产品始终按 `N credits` 计费，不因内部拆项、少识别或系统重试改变。单次会话 1～100 张，即 1～100 credits。

## 3. 售卖方式

首发支持四个 Stripe 一次性 Price，商店和 Stripe 必须保持一致：

- 20 credits：`US$2.99`，轻量整理；
- 100 credits：`US$9.99`，整屋收纳；
- 500 credits：`US$34.99`，大量整理；
- Founding Lifetime：`US$9 one-time`，无限箱子、20 个永久有效的赠送 AI Credits，不订阅。

前端显示上述含税前标价，但不传 Price ID，只传 `credits_20|credits_100|credits_500|boxes_unlimited`。Edge Function 使用现有环境变量 allowlist（`STRIPE_CREDIT_20_PRICE_ID`、`STRIPE_CREDIT_100_PRICE_ID`、`STRIPE_CREDIT_500_PRICE_ID`、`STRIPE_BOXES_UNLIMITED_PRICE_ID`）映射 Stripe Price，Checkout 始终为 `mode=payment`。每个环境都必须分别创建四个 Test 和四个 Live 的 one-time Price 对象，绝不跨 Mode 复用 Price ID 或更改这些环境变量名称。税费、换汇和当地支付方式可在 Checkout 最终确认；任何调价必须在同一发布中同步本文、前端和 Stripe Price。

### 3.1 Founding Lifetime 名额运营

首发不自动保留名额。运营人员只读查询成功且仍 active 的 Stripe 无限箱子权益：

```sql
select count(*) as active_founding_lifetime_entitlements
from public.account_entitlements
where source_provider = 'stripe'
  and source_reference like 'checkout:%'
  and entitlement_code = 'boxes_unlimited_lifetime'
  and status = 'active';
```

计数达到 `80` 时复核活动；达到 `90` 时准备 `US$19` 的 one-time Price；达到 `100` 时停止面向新用户展示或销售 `US$9` 首发优惠。Phase One 不自动预留、锁定或分配名额。

### 3.2 成本与毛利基线

Qwen3-VL Plus 中国区在输入不超过 32K 时的官方原价为输入 `¥1/百万 Token`、输出 `¥10/百万 Token`。Qwen3-VL 图像约每 `32×32` 像素一个视觉 Token。根据当前 Atlas + 原图定位 + 裁剪验证链路，首发成本预算为：

- 常规场景：每 credit 约 `4,000～7,000` 输入 Token 和 `300～800` 输出 Token，模型费约 `¥0.007～¥0.015`；
- 加上高清复核、重试、Storage/Edge 与余量，目标实际变动成本不高于 `¥0.10/credit`；
- 任一 30 天窗口的 P95 实际成本超过 `¥0.10/credit` 时，必须暂停促销并复核模型分路、图片分辨率或新价格；
- 实际成本以 `ai_model_usage_events` 和账单为准，上线前用 10/30/50/100 张真实会话重新校准。

## 4. Credit 状态机

```text
purchase / promotion / refund
  └─ available
       ├─ reserve(session, revision)
       │    ├─ consume → 发布可用结果
       │    └─ release → 终态失败且无可用结果
       ├─ revoke → 全额退款后收回未使用额度
       └─ expire → 仅有明确期限的促销额度
```

- 完成会话时，数据库锁定会话和 grants，按照片数原子预留；余额不足则整个事务回滚。
- 发布至少一个可用检测项后结算 `consume`；完全无结果则 `release`。
- Worker 自动重试、JSON 重试、定位重试和裁剪验证沿用原 reservation，不重复收费。
- 用户主动“重新分析”创建新 revision，并按原照片数再次预留。
- 消耗顺序为最早过期优先，无过期时间的购买 grant 最后消耗。

## 5. 数据与 API

- `billing_customers`：Supabase User 与 Stripe Customer 映射。
- `credit_grants`：购买、促销或退款额度。
- `credit_reservations` / `credit_reservation_allocations`：按会话 revision 预留并从多个 grants 分配。
- `credit_transactions`：append-only 的 grant/reserve/consume/release/refund/revoke 流水。
- `stripe_webhook_events`：Webhook 幂等收件箱。
- `ai_model_usage_events`：模型、操作、Token、时长、会话、任务与 provider request ID。

客户端只能调用 `get_credit_summary()` 和 `list_credit_transactions(limit)`。credit 写操作由 service role RPC 执行：`upsert_billing_customer`、`grant_credits`、`revoke_unused_credits`、`release_packing_credit_reservation`。核心错误码为 `insufficient_credits` 和 `credit_reservation_conflict`。

## 6. Stripe 边界

- `billing-checkout`：验证用户，确保 Stripe Customer，根据受控 action 创建一次性 Checkout Session。
- `stripe-webhook`：使用原始请求体校验签名，处理 `checkout.session.completed` 和 `charge.refunded`。
- 付款成功后以 Checkout Session ID 作为幂等源发放长期有效 purchased grant。Founding Lifetime 还必须同时携带受控 `offer_code='founding_lifetime_v1'`，并以 `founding-lifetime-bonus:<checkout-session-id>` 幂等发放 20 个永不过期 promotional Credits；重复活跃权益同样执行该幂等 bonus grant，已退款 tombstone 则不发放。
- 全额退款收回该订单尚未使用的 credits；Founding Lifetime 全额退款还必须撤销权益并按相同 founder-bonus source 收回未使用的 promotional Credits。已消耗额度不会生成负余额。部分退款首发不自动按比例收回，需人工审核。
- 不部署 Customer Portal，不订阅 invoice 或 `customer.subscription.*` 事件。

## 7. Apple App UI 规范

- “我的”页显示 `AI Credits` 卡片和实时余额，点击进入 `/app/me/credits`。
- 桌面端没有“我的”底部导航，因此侧边栏账户区必须常驻显示实时余额；账户菜单首项必须是可进入 `/app/me/credits` 的 Credits 钱包卡，不能把商店入口藏在账户资料弹窗中。
- Credit 页在移动端使用 iOS Settings 层级：顶部返回导航、大号余额 Hero、分组购买行、最近流水和明确的“不自动续费”说明。桌面端依赖全局侧边栏，不显示返回 `/app/me` 的页面级导航，只保留标题，并在首屏将余额 Hero 与购买区并排。
- 余额为 0 时点击 AI 入口，不进入拍摄，展示 Apple 风格底部 Sheet；完成时余额不足也使用同一 Sheet 并显示本次所需 credits。
- 拍摄页持续显示照片数，完成前显示“将使用 N credits”。不使用原生 alert、密集价格表、霓虹渐变或 SaaS 侧边栏。
- 按钮至少 44px；Sheet 支持 Escape、焦点恢复、滚动锁定、安全区和 `prefers-reduced-motion`。

## 8. 安全、可观测性与上线门槛

- Stripe Secret Key、Webhook Secret 和 Price allowlist 只存在 Edge Function Secrets；return URL 只使用 `PUBLIC_APP_ORIGIN` 生成。CORS 使用精确匹配的 `PUBLIC_APP_ORIGIN` 与逗号分隔 `PUBLIC_APP_ALLOWED_ORIGINS`，不允许通配符。
- 所有 credit 写操作使用行锁、唯一幂等键和受控 `search_path`。日志不记录支付方式或家庭照片内容。
- 核心指标：购买转化、额度不足、grant/reserve/consume/release/revoke、每 credit 真实模型成本、Webhook 延迟/失败/重放。
- 上线前必须验证：余额不足原子回滚；并发不透支；重复完成、publish 和 Webhook 不重复扣发；无结果失败退回；一次性付款、全额退款与签名校验在 Stripe test mode 闭环。

## 9. 实施顺序

1. 数据库 credit 账本、预留结算、AI 门禁和 pgTAP；
2. Stripe 一次性 Checkout、Webhook 和退款；
3. Credit 余额、购买页和 AI 拦截 Sheet；
4. Worker usage event 与失败释放；
5. Stripe test mode E2E 和 10/30/50/100 张会话成本校准；
6. 正式 Price、税务与条款确认后灰度。
