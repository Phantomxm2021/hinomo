# Nomo 当前版本部署指南

> 只看这份主流程即可完成当前版本上线。历史迁移说明、专项配置和完整回滚 SQL 已移到[详细参考附录](./deployment-details-archive.md)。
>
> Three-Box Reset campaign promotion additionally requires the complete [Three-Box Reset launch runbook](./three-box-reset-launch.md). Its real-device, consent, Stripe, analytics, campaign-media, and launch-record gates are release requirements, not optional marketing checks.
>
> 当前版本包含：家庭共享场地、共享箱子/物品、活动记录、AI 装箱、AI Credits，以及免费用户最多 3 个箱子的付费解锁。

## 先判断：你属于哪一种部署

| 情况 | 从哪里开始 |
| --- | --- |
| 全新 Supabase 项目 | 从“0. 前置准备”开始 |
| 已有 Nomo 项目 | 先做“1. 查迁移进度”，只执行未完成的步骤 |
| 只发布前端 | 确认数据库和 Functions 已完成，再看“5. 发布前端” |
| 需要修复历史数据或回滚 | 不要临时改 SQL，先看[详细参考附录](./deployment-details-archive.md) |

**不要按文件名猜起点，也不要重复执行已完成的 migration。** 每次只由项目管理员在目标 Supabase 项目的 SQL Editor 执行 SQL；密钥只从密码管理器粘贴到平台控制台。

## 0. 前置准备

确认以下内容已经准备好：

- 测试 Supabase 项目和生产 Supabase 项目彼此独立。
- Cloudflare R2 bucket 为 private，R2 凭据已在 Supabase Vault 中配置。
- Cloudflare Pages 可以重新构建并发布前端。
- Stripe Test Mode 已创建 `US$2.99`、`US$9.99`、`US$34.99` 和 `US$9 one-time` 的四个 one-time Price；Live Mode 必须另建对应四个对象，不能复用。
- 你有权限访问 Supabase SQL Editor、Function Secrets、Stripe Webhook Endpoint 和 Cloudflare Pages。

如果是全新项目，AI 装箱、R2、Credits 的首次配置请按[详细参考附录](./deployment-details-archive.md)完成；当前主流程只负责本次版本的发布顺序。

## 1. 查迁移进度（每个环境都先做）

在目标 Supabase SQL Editor 运行只读查询：

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

记下最后一条已执行 migration。**已执行的不要重跑；缺失的按下面顺序补齐。** 如果这个表不存在，说明项目不是由本仓库迁移初始化的，先停止并让项目管理员确认数据库来源。

## 2. 执行数据库迁移

### 2.1 先补齐旧基础迁移

如果查询结果还没有到 `202608080001_onboarding_welcome.sql`，先按文件名顺序执行所有更早的 pending migrations。不要跳过中间文件。

### 2.2 当前版本的固定顺序

若本次同时发布所有新功能，按下面顺序执行；每一步成功后再做下一步：

```text
AI 装箱语言一致性（必须在 202608030006 之后执行）：
   202608050001_localized_ai_inventory_search.sql

A. 箱子权益兼容窗口：
   202608080002_box_entitlements.sql
   202608080004_box_entitlements_service_read.sql
   202608080005_account_entitlement_revocation_tombstones.sql

B. 家庭共享后端：
   202608090001_venue_family_sharing.sql
   202608090002_venue_shared_content.sql
   202608090003_venue_shared_workflows.sql
   202608090004_venue_shared_packing.sql
   202608090005_venue_activity.sql

C. 发布 Functions 和前端，等待旧缓存退出，最后执行：
   202608080003_box_entitlements_enforce.sql

D. Onboarding 完成状态与首发 Credits：
   202608110001_onboarding_completion.sql
   202608110002_growth_launch_credits.sql

E. AI 装箱 promotion 兼容修复：
   202608120001_fix_packing_promotion_finalize.sql
```

这两个顺序不能改：

- `202608080003` 必须最后执行，否则旧前端会突然失去直接创建箱子的兼容窗口。
- 家庭共享的 `001 → 005` 必须完整执行后再打开邀请入口。

每个 migration 完成后，在 Dashboard 确认 schema reload 成功。若 SQL 报错，不要跳过继续执行；记录错误并先修复。

`202608110002_growth_launch_credits.sql` 必须紧接在 `202608110001_onboarding_completion.sql` 之后执行。它只会给部署后新创建的账号发放一次 10 Credits、30 天有效的 promotional grant；不会回填既有用户。若受控 seed 用户需要补发，必须由 service role 显式操作并记录独立的 `source_reference`，不能使用 signup 来源标识。

部署后可只针对一个受控测试用户运行以下只读核验（将 UUID 替换为该用户，勿扩大查询范围）：

```sql
select
  grants.original_credits,
  grants.remaining_credits,
  grants.effective_at,
  grants.expires_at,
  grants.source_reference,
  transactions.idempotency_key,
  transactions.credit_amount
from public.credit_grants grants
left join public.credit_transactions transactions
  on transactions.grant_id = grants.id
  and transactions.kind = 'grant'
where grants.user_id = '<controlled-test-user-uuid>'::uuid
  and grants.kind = 'promotional'
  and grants.source_reference = 'signup:<controlled-test-user-uuid>:growth-launch-v1';
```

## 3. 配置服务端密钥

在测试环境先配置，生产环境使用对应的 Live Mode 值：

| 用途 | 必须配置 |
| --- | --- |
| 箱子解锁 | `STRIPE_BOXES_UNLIMITED_PRICE_ID`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`PUBLIC_APP_ORIGIN` |
| Stripe Webhook | `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed`、`charge.refunded` |
| AI Credits/装箱 | 保留或按[详细参考附录](./deployment-details-archive.md)配置现有 Credits、Qwen、R2、Vault 值 |

注意：

- `US$2.99`、`US$9.99`、`US$34.99` 和 `US$9 one-time` 都必须是 one-time Price，不创建 recurring Price。
- Test 和 Live 的每个 Price、Secret Key、Webhook Secret、Endpoint 完全分开；继续使用 `STRIPE_CREDIT_20_PRICE_ID`、`STRIPE_CREDIT_100_PRICE_ID`、`STRIPE_CREDIT_500_PRICE_ID`、`STRIPE_BOXES_UNLIMITED_PRICE_ID`，不改变量名。
- 任何 Stripe Secret、Supabase service-role key、R2 Secret 都不能放进 `apps/web/.env` 或任何 `VITE_` 变量。
- Webhook Endpoint 使用：`https://<project-ref>.supabase.co/functions/v1/stripe-webhook`。

部署 Functions：

```bash
npm run typecheck:billing
npm run typecheck:worker
npm run test:worker
supabase functions deploy billing-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy packing-worker --no-verify-jwt
```

## 4. 测试环境验收

先在 Test Mode 完成以下最小清单：

- 免费账号同时保有 3 个箱子后，创建第 4 个箱子显示 `US$9 one-time` 创始人付费墙（无限箱子 + 20 bonus AI Credits，无订阅）；已有箱子仍可使用。
- 取消 Checkout 后，箱子数、权益和 AI Credits 不变，并可再次购买。
- 完成付款后，Webhook 发放一条 active 无限箱子权益，确认到账后可创建第 4、5 个箱子。
- 延迟付款期间只显示“正在确认”，不提前显示已解锁；`async_payment_failed` 不发放权益或 Credits。
- 重放同一 Stripe Event/Checkout Session 不重复发放；全额退款撤销未来新增权限并收回未使用的 20 promotional bonus Credits，但已有箱子不删除、不锁定；部分退款人工审核。
- 创建一个场所所有者和成员：邀请过期/撤销/复用、最后席位并发、成员共享内容、成员 AI Credits、撤权后的缓存清理均符合预期。
- 将受控账号语言切换为 English，新建一次 AI 装箱会话，确认识别清单使用英文显示名；使用 `keyboard` 和 `键盘` 均能检索到同一物品。已存在的会话不会改写，需新建会话或重新分析。

运行仓库检查：

```bash
npm run typecheck
npm run typecheck:billing
npm run typecheck:worker
npm run lint
npm test -- --run
npm run build
npm run test:worker
npm run test:e2e
npm run test:venue-sharing-concurrency
npm run test:db
```

测试环境没有本地 Supabase/Postgres 时，`npm run test:db` 和并发脚本不能算通过；必须在 CI 或独立 Supabase 环境补跑。并发脚本会在缺少 `SUPABASE_URL` 时安全停止，不会创建测试数据。

## 5. 发布前端

Cloudflare Pages：

- Root directory：`/`
- Build command：`npm run build --workspace @nomo/web`
- Output directory：`apps/web/dist`
- 必要变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_PUBLIC_APP_ORIGIN`。
- 首次生产发布和回滚：`VITE_ENABLE_VENUE_INVITES=false`。

发布顺序：

1. 先发布包含 `create_box` RPC、箱子付费墙、共享场地和撤权清理的前端。
2. 等待 CDN/浏览器旧缓存退出；确认新建箱子走 `create_box`，不再直接 `INSERT public.boxes`。
3. 再执行 `202608080003_box_entitlements_enforce.sql`，并重新验证权限。
4. 在 staging/preview 将 `VITE_ENABLE_VENUE_INVITES=true` 做邀请冒烟；通过后重新构建生产并打开该变量。

## 6. 生产切换

只有测试清单全部通过后才切换 Live Mode：

1. 在 Stripe Live Mode 另建 `US$2.99`、`US$9.99`、`US$34.99` 和 `US$9 one-time` 四个 one-time Price。
2. 配置对应的 `sk_live_...`、Live Webhook Secret、Live Price ID 和生产 Origin。
3. 新建生产 Webhook Endpoint，并订阅上面四种事件；不要复用 Test Endpoint 或 Secret。
4. 按测试环境同样顺序执行迁移、Functions、前端和缓存等待。
5. 用受控生产账号做一次最小冒烟：Checkout 显示 `US$9 one-time`、权益只发放一次、发放 20 bonus AI Credits，重放不重复发放。

## 7. 出问题时怎么处理

- **只关闭家庭邀请**：将 `VITE_ENABLE_VENUE_INVITES=false`，重新构建并发布；已有邀请 token 的接受路由仍保留。
- **003 已执行但前端需回退**：不要部署仍依赖直接 INSERT 的旧前端；先由管理员审核 forward migration 临时恢复兼容权限，修复后再收口。具体 SQL 在[详细参考附录](./deployment-details-archive.md)。
- **任何迁移失败**：停止后续步骤，不要删除表、函数、权益记录、Webhook 历史或已有箱子。

## 8. 发布记录

记录以下内容，方便以后知道“从哪个版本开始”：

- 环境：Test / Live；Supabase project ref；Cloudflare Pages deployment ID。
- 执行前最后一个 migration 和本次执行的 migration 列表。
- Stripe Mode、Price ID、Webhook Endpoint、Checkout Session/Event ID（不要记录 Secret 或卡信息）。
- 测试结果、执行时间、执行人和未完成的环境阻塞。

完整 SQL、历史迁移、详细监控查询、退款人工处置、R2/AI 首次配置和 forward-only 回滚说明见[详细参考附录](./deployment-details-archive.md)。

## 9. Three-Box Reset campaign gate

当本次发布包含 `/3-box-reset`、渠道内容或创始人优惠时，在生产切换前完成并归档[Three-Box Reset launch runbook](./three-box-reset-launch.md)。该 runbook 定义了 Test Mode Stripe 观察、PostHog 同意边界与事件 allowlist、iPhone Safari/Android Chrome 实机、PWA/二维码/PDF/AI 以及生产 canary 的检查清单。没有通过 `npm run test:db` 的环境、缺失经批准真实 demo MP4 的环境、或缺少实机记录的环境不得提升。

最后更新：2026-08-09（当前版本：家庭共享 + 箱子权益 + AI 装箱/Credits）。
