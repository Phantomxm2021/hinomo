# 免费箱子上限与永久解锁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Nomo 增加“免费账号同时最多 3 个箱子”和 HK$38 一次性永久解锁无限箱子的完整数据库、Stripe、前端和测试实现。

**Architecture:** 使用 Supabase Postgres 的账号权益记录作为箱子权益权威来源。所有创建请求进入 `create_box(...)` security-definer RPC，并使用用户级事务 advisory lock 原子检查箱子数量；Stripe Checkout/Webhook 只负责收款和发放/撤销权益。React 端通过权益摘要提前展示额度和付费墙，但不承担最终安全校验。

**Tech Stack:** Supabase Postgres/PLpgSQL/RLS/pgTAP、Supabase Edge Functions（Deno + Stripe SDK）、React + TypeScript、TanStack Query、React Hook Form、Vitest/Testing Library、Playwright、现有 Nomo i18n 与响应式弹窗组件。

## Global Constraints

- 免费账号可同时保有最多 3 个未删除箱子；删除箱子后立即释放名额。
- HK$38 是一次性 `mode=payment` 购买，不订阅、不自动续费、不赠送 AI Credits。
- 老用户已有超过 3 个箱子时，已有数据和功能不受影响，但免费状态不能新增箱子。
- 全额退款撤销箱子无限权益，但不删除、锁定或降级已有箱子；部分退款不自动撤销。
- 数据库 RPC 是创建权限最终权威；最终收口后客户端不能直接 `INSERT` `public.boxes`。
- 创建并发控制使用 `pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0))`，不能仅依赖前端计数。
- 账号权益每次购买保留一条来源记录；同一账号同一权益在同一时间最多一条 `active` 记录。
- Stripe Secret、Webhook Secret 和 Price ID 只存在 Edge Function Secrets；客户端不能提交金额或 Price ID。
- 所有用户可见文案必须同时加入 `zh-CN` 和 `en-US`；不得在组件 JSX 中硬编码文案。
- 先部署可兼容的新增迁移和新前端，再执行撤销旧直接插入权限的收口迁移。
- 不修改现有 AI Credits 账本、价格、余额、预留、结算或退款行为。

---

## 文件地图

### 数据库与类型

- Create: `supabase/migrations/202608080002_box_entitlements.sql` — 权益表、索引、摘要/创建/发放/撤销 RPC；保持旧直接插入权限以支持兼容部署。
- Create: `supabase/migrations/202608080003_box_entitlements_enforce.sql` — 撤销 `authenticated` 对箱子直接插入的表级和列级权限。
- Create: `supabase/tests/database/018_box_entitlements.test.sql` — 额度、权益、老用户、退款后的 pgTAP 测试。
- Modify: `supabase/tests/database/007_api_privileges.test.sql` — 最终验证 authenticated 没有 `boxes` INSERT 权限。
- Modify: `apps/web/src/lib/database.types.ts` — 新表、枚举和 RPC 的手工类型快照。
- Modify: `apps/web/src/lib/database.types.test-d.ts` — 编译期验证新 RPC 参数和返回结构。

### Web API、Stripe 与 UI

- Create: `apps/web/src/features/boxes/box-entitlements.api.ts` — 箱子权益摘要、购买 Checkout、稳定错误码识别和支付确认辅助函数。
- Create: `apps/web/src/features/boxes/box-entitlements.api.test.ts` — 摘要、Checkout、错误码测试。
- Modify: `apps/web/src/features/boxes/boxes.api.ts` — 将 `createBox` 从 `.insert()` 切换到 `create_box` RPC。
- Modify: `apps/web/src/features/boxes/boxes.api.test.ts` — 验证 RPC 参数和错误传递。
- Create: `apps/web/src/features/boxes/BoxLimitPaywall.tsx` — 响应式无限箱子付费墙，作为创建表单上层系统弹窗。
- Create: `apps/web/src/features/boxes/BoxLimitPaywall.test.tsx` — 文案、购买、取消、焦点、busy 状态测试。
- Modify: `apps/web/src/features/boxes/BoxForm.tsx` — 接收 `onLimitReached`，在 `box_limit_reached` 时保留表单并打开付费墙。
- Modify: `apps/web/src/features/boxes/CreateBoxModal.tsx` — 将限额回调传入 `BoxForm`。
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx` — 查询计划摘要、显示额度状态、拦截创建、处理购买返回和刷新箱子列表。
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx` — 覆盖未满、已满、老用户超额、竞态错误和支付成功返回。
- Modify: `apps/web/src/i18n/messages.ts` — 箱子计划、付费墙、支付确认和稳定错误文案中英文。
- Modify: `supabase/functions/billing-checkout/index.ts` — 增加 `boxes_unlimited` action、服务端权益检查和 HK$38 Price 映射。
- Modify: `supabase/functions/stripe-webhook/index.ts` — 箱子权益发放、全额退款撤销和重复付费告警分流。
- Modify: `supabase/functions/billing-checkout/index_test.ts` — 验证 action、Price allowlist 和不发送 unsupported payment method。
- Create: `supabase/functions/stripe-webhook/index_test.ts` — 验证箱子订单不创建 Credits、Webhook 幂等和退款分流；沿用当前读取源码/纯函数测试模式。

### 条款与发布

- Modify: `apps/web/src/content/legal/terms.zh-CN.md` — 一次性数字权益、退款撤销和永久期限说明。
- Modify: `apps/web/src/content/legal/terms.en-US.md` — 对应英文条款。
- Modify: `docs/runbooks/deployment.md` — 迁移顺序、Secret、Stripe Price/Webhook 和灰度检查清单。

---

## Task 1: 先写数据库权限与行为失败测试

**Files:**

- Create: `supabase/tests/database/018_box_entitlements.test.sql`
- Modify: `supabase/tests/database/007_api_privileges.test.sql`

**Interfaces:**

- Consumes: 现有 `tests.create_supabase_user`、`tests.authenticate_as`、venues/spaces/boxes schema。
- Produces: 18 号数据库测试契约，后续迁移必须使其通过。

- [ ] **Step 1: 建立 pgTAP 测试用户和临时状态**

在测试文件开头建立事务、`select plan(...)`、`box-limit-owner`、`box-limit-empty`、`box-limit-other` 三个用户，并插入 owner 的 venue/space。临时状态表保存 owner、other、space、box UUID，所有固定 UUID 使用 `...-4000-8000-...` 格式。

- [ ] **Step 2: 写表、RPC 与权限的失败断言**

加入以下契约断言；迁移尚未存在时，运行会因对象缺失失败：

```sql
select has_table('public', 'account_entitlements', 'account entitlement ledger exists');
select has_function('public', 'get_box_plan_summary', array[]::text[], 'box plan summary exists');
select has_function('public', 'create_box',
  array['uuid', 'text', 'text', 'text', 'text', 'public.box_visibility'],
  'atomic box creation RPC exists');
select has_function('public', 'grant_account_entitlement',
  array['uuid', 'text', 'text', 'text', 'timestamptz'],
  'service-only entitlement grant exists');
select has_function('public', 'revoke_account_entitlement',
  array['text', 'text'], 'service-only entitlement revoke exists');
```

- [ ] **Step 3: 写免费额度、删除释放和老用户超额测试**

先以 authenticated 身份调用 `get_box_plan_summary()`，断言初始 `box_count=0`、`free_limit=3`、`unlimited_boxes=false`、`can_create=true`。通过 `create_box` 创建 3 个箱子，断言第 4 次抛出 `box_limit_reached` 且箱子总数仍为 3；删除一个后再次创建成功。另建 4 个箱子的老用户状态，断言摘要为 4、`can_create=false`，已有箱子仍可读取。

- [ ] **Step 4: 写权益、撤销和来源幂等测试**

以 service role 调用发放 RPC：发放 `boxes_unlimited_lifetime` 后，再以 owner 的 authenticated 身份读取摘要，应为 `unlimited_boxes=true`、`can_create=true`；重复相同 `source_reference` 返回 `created=false` 且不增加第二行；创建超过 3 个成功。撤销来源后摘要恢复免费规则；重复撤销不报错。用新来源重新发放时，撤销历史仍保留且只有一条 active 记录。

- [ ] **Step 5: 写 RLS 和空间所有权测试**

断言 other 用户不能为 owner 的空间创建箱子，anonymous 不能调用创建 RPC。直接 `INSERT` 权限的最终断言留到 Task 3，因为 Task 2 的兼容迁移仍暂时保留旧版前端所需的列级插入权限。

- [ ] **Step 6: 运行失败测试并记录缺失对象**

Run: `npm run test:db`

Expected: 018 测试在迁移实现前失败，失败原因是 `account_entitlements`/新 RPC 尚不存在；不要修改测试以绕过失败。

## Task 2: 实现数据库权益表、摘要 RPC 和原子创建 RPC

**Files:**

- Create: `supabase/migrations/202608080002_box_entitlements.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`

**Interfaces:**

- Consumes: Task 1 的 pgTAP 契约、现有 `boxes`/`spaces`/`stripe_webhook_events` schema。
- Produces: `account_entitlements`、`get_box_plan_summary()`、`create_box(...)`、`grant_account_entitlement(...)`、`revoke_account_entitlement(...)` 四个 RPC。

- [ ] **Step 1: 添加状态枚举、权益表和约束**

创建 `public.account_entitlement_status`（`active`、`revoked`）和 `public.account_entitlements`。字段至少包含 `id`、`user_id`、`entitlement_code`、`status`、`source_provider`、`source_reference`、`granted_at`、`revoked_at`、`created_at`、`updated_at`。添加：

```sql
create unique index account_entitlements_active_idx
on public.account_entitlements (user_id, entitlement_code)
where status = 'active';

create unique index account_entitlements_source_idx
on public.account_entitlements (source_provider, source_reference);
```

加入 active/revoked 时间一致性检查、用户级 RLS、`revoke all` 表权限；不向 authenticated 授予直接读写。

- [ ] **Step 2: 实现 `get_box_plan_summary()`**

使用 `auth.uid()` 返回单行 `{ box_count integer, free_limit integer, unlimited_boxes boolean, can_create boolean }`。`box_count` 统计 `public.boxes.owner_id = auth.uid()`；有效权益必须满足 `status='active'`、固定代码 `boxes_unlimited_lifetime`。匿名调用返回空结果或权限错误，authenticated 获得 execute 权限。

- [ ] **Step 3: 实现 `create_box(...)` 的用户锁和所有权校验**

使用固定签名：

```sql
public.create_box(
  p_space_id uuid,
  p_name text,
  p_category text,
  p_location text,
  p_description text,
  p_visibility public.box_visibility
) returns table(id uuid, public_id uuid, box_code text, name text)
```

函数为 `security definer set search_path = pg_catalog, public`。先验证 caller，再调用 `pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0))`；验证空间属于 caller；检查 active 无限权益；没有权益时在锁内统计箱子数，达到 3 使用 `raise exception using errcode='P0001', message='box_limit_reached'`；最后以 caller 为 owner 插入并返回四个字段。不要从参数接收 owner_id，不要让 caller 写 public_id/box_code。

- [ ] **Step 4: 实现发放 RPC 的来源幂等**

实现 service-role-only `grant_account_entitlement(p_user_id uuid, p_entitlement_code text, p_source_provider text, p_source_reference text, p_granted_at timestamptz)`，返回 `{ entitlement_id uuid, created boolean, duplicate_active boolean }`。固定只接受 `boxes_unlimited_lifetime`；相同 provider/reference 已存在时返回已有记录 ID、`created=false`、`duplicate_active=false`；已有其他 active 记录时返回已有 active ID、`created=false`、`duplicate_active=true`，由 Webhook 记录重复付费告警；新来源则插入 active 行并返回 `created=true`。用行锁/唯一索引保护重复调用。

- [ ] **Step 5: 实现撤销 RPC**

实现 service-role-only `revoke_account_entitlement(p_source_provider text, p_source_reference text)`。按来源锁定 active 行，更新为 revoked、写 `revoked_at`，无行或已撤销时返回 0，不删除历史记录。只允许 service role 执行。

- [ ] **Step 6: 增加可兼容权限和 RPC 授权**

本迁移先不撤销旧直接 `INSERT`，保证旧版前端仍能运行；只授予 authenticated 执行 `get_box_plan_summary` 与 `create_box`，service role 执行发放/撤销 RPC。最终权限收口放入 Task 3 的独立迁移。

- [ ] **Step 7: 更新手工数据库类型并加编译期断言**

在 `database.types.ts` 增加 `account_entitlement_status`、`account_entitlements` Table 和五个 RPC 的 Args/Returns。`create_box` 的返回类型必须是数组行类型；`get_box_plan_summary` 返回数组行类型；`grant_account_entitlement` 返回包含 `entitlement_id`、`created`、`duplicate_active` 的数组行类型。把 `CreatedBoxRpcArgs` 的 valid object 加到 `database.types.test-d.ts`，同时对不存在的 owner 参数保持 `@ts-expect-error` 约束。

- [ ] **Step 8: 运行数据库测试和类型检查**

Run: `npm run test:db`

Expected: 018 的额度、权益、退款、老用户和空间所有权测试通过；007 的既有权限断言继续通过，直接 `INSERT` 的最终撤销断言在 Task 3 后加入。

Run: `npm run typecheck`

Expected: 由于前端尚未切换 API，不出现新的 TypeScript 错误。

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/202608080002_box_entitlements.sql supabase/tests/database/018_box_entitlements.test.sql apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts
git commit -m "feat: add box entitlement database primitives"
```

## Task 3: 完成数据库权限收口

**Files:**

- Create: `supabase/migrations/202608080003_box_entitlements_enforce.sql`
- Modify: `supabase/tests/database/007_api_privileges.test.sql`

**Interfaces:**

- Consumes: Task 2 已部署的 `create_box` RPC；前端切换完成后执行。
- Produces: 认证客户端无法直接插入箱子，创建只能走 RPC。

- [ ] **Step 1: 写最终权限失败断言**

在 007 中先将 boxes `insert` 断言改为 `not has_table_privilege`，并保留 authenticated 的 select/delete 和 anon select 断言。

- [ ] **Step 2: 撤销表级及列级直接插入**

在 003 迁移中执行 `revoke insert on table public.boxes from public, anon, authenticated`，并显式撤销 `owner_id, space_id, name, category, location, description, visibility` 的列级 insert 权限。保留 sequence usage 不影响 security-definer RPC，但不再允许客户端利用它直接写表。

- [ ] **Step 3: 运行权限测试**

Run: `npm run test:db`

Expected: 007 的直接 insert 权限断言通过，018 的 `create_box` 仍可正常创建。

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202608080003_box_entitlements_enforce.sql supabase/tests/database/007_api_privileges.test.sql
git commit -m "fix: enforce box creation through entitlement rpc"
```

## Task 4: 实现箱子权益 Web API 和 RPC 创建适配

**Files:**

- Create: `apps/web/src/features/boxes/box-entitlements.api.ts`
- Create: `apps/web/src/features/boxes/box-entitlements.api.test.ts`
- Modify: `apps/web/src/features/boxes/boxes.api.ts`
- Modify: `apps/web/src/features/boxes/boxes.api.test.ts`

**Interfaces:**

- Consumes: Task 2 的 typed RPC；现有 `supabase.functions.invoke` 约定。
- Produces: `getBoxPlanSummary(): Promise<BoxPlanSummary>`、`startBoxUnlimitedCheckout(): Promise<never>`、`isBoxLimitReached(error: unknown): boolean`；`createBox(input)` 保持原有调用方输入和 `CreatedBox` 返回类型。

- [ ] **Step 1: 为新 API 写失败测试**

在 `box-entitlements.api.test.ts` mock `supabase.rpc` 和 `supabase.functions.invoke`，先写：

```ts
await expect(getBoxPlanSummary()).resolves.toEqual({
  box_count: 3,
  free_limit: 3,
  unlimited_boxes: false,
  can_create: false,
})
expect(mockRpc).toHaveBeenCalledWith('get_box_plan_summary')
```

再写 `startBoxUnlimitedCheckout()` 发送 `{ action: 'boxes_unlimited' }`、收到 URL 后调用 `window.location.assign`；`isBoxLimitReached` 只识别稳定错误码，不把普通错误误判为额度不足。

- [ ] **Step 2: 运行 API 失败测试**

Run: `npm test -- --run src/features/boxes/box-entitlements.api.test.ts`

Expected: 由于新模块和函数不存在而失败。

- [ ] **Step 3: 实现权益摘要 API**

调用 `supabase.rpc('get_box_plan_summary')`，取首行；无行时返回 `{ box_count: 0, free_limit: 3, unlimited_boxes: false, can_create: true }` 只作为未登录隔离测试的空值，不吞掉 RPC error。

- [ ] **Step 4: 实现箱子 Checkout API**

使用 `supabase.functions.invoke('billing-checkout', { method: 'POST', body: { action: 'boxes_unlimited' } })`。缺少 URL 或函数错误时抛出服务端返回的稳定错误；有 URL 时执行 `window.location.assign(url)` 并返回永不 resolve 的 Promise，与现有 Credits Checkout 行为一致。

- [ ] **Step 5: 将 `createBox` 切换到 RPC**

保留 `BoxInput` 类型和未登录检查；将 `.from('boxes').insert(...)` 替换为：

```ts
const { data, error } = await supabase.rpc('create_box', {
  p_space_id: input.space_id,
  p_name: input.name,
  p_category: input.category,
  p_location: input.location,
  p_description: input.description,
  p_visibility: input.visibility,
})
if (error) throw error
const created = data?.[0]
if (!created) throw new Error('box_creation_empty')
return created
```

RPC 不接收 owner_id，现有 `getSession` 仍可用于统一的客户端未登录错误。

- [ ] **Step 6: 更新 boxes API 测试**

把原来断言 `.insert` 的创建测试改为断言 RPC 六个参数、返回首行和错误透传；新增 `isBoxLimitReached` 的 `message='box_limit_reached'`、PostgREST `details` 包含稳定码、普通网络错误三种断言。

- [ ] **Step 7: 运行 Web API 测试和类型检查**

Run: `npm test -- --run src/features/boxes/box-entitlements.api.test.ts src/features/boxes/boxes.api.test.ts`

Expected: API tests pass。

Run: `npm run typecheck`

Expected: 新 RPC 参数和返回类型通过。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/boxes/box-entitlements.api.ts apps/web/src/features/boxes/box-entitlements.api.test.ts apps/web/src/features/boxes/boxes.api.ts apps/web/src/features/boxes/boxes.api.test.ts
git commit -m "feat: route box creation through entitlement api"
```

## Task 5: 实现箱子额度付费墙组件

**Files:**

- Create: `apps/web/src/features/boxes/BoxLimitPaywall.tsx`
- Create: `apps/web/src/features/boxes/BoxLimitPaywall.test.tsx`
- Modify: `apps/web/src/components/overlay-layers.ts` — 增加 `BOX_ENTITLEMENT_DIALOG_Z_INDEX = SYSTEM_DIALOG_Z_INDEX + 1`，保证付费墙覆盖创建表单。
- Modify: `apps/web/src/i18n/messages.ts`

**Interfaces:**

- Consumes: `startBoxUnlimitedCheckout`、现有 `useI18n`、`AppIcon` 和 overlay/focus 约定。
- Produces: `BoxLimitPaywall({ open, busy, onClose, onPurchase })`，移动端底部、桌面端居中，能覆盖仍打开的创建表单。

- [ ] **Step 1: 写组件行为失败测试**

测试以下行为：关闭时无 dialog；打开时存在 `role=dialog`/`aria-modal=true`；包含“HK$38 永久解锁”、一次性付款、不自动续费、AI Credits 单独计费文案；点击购买调用一次 `onPurchase`；busy 时按钮和关闭路径禁用；Escape/背景点击关闭；关闭后焦点回到打开前的提交按钮。

- [ ] **Step 2: 运行失败测试**

Run: `npm test -- --run src/features/boxes/BoxLimitPaywall.test.tsx`

Expected: 组件不存在而失败。

- [ ] **Step 3: 实现响应式 portal**

参考 `CreditGateSheet.tsx` 的 portal、焦点和滚动锁定逻辑，增加 `data-overlay-layer="box-limit-paywall"`，确保 `ResponsiveEditorDialog` 的 Escape 监听识别该层为 topmost；移动端使用圆角底部 Sheet，`lg:` 断点居中，加入 safe-area-bottom、`prefers-reduced-motion` 兼容的非动画基础状态。

- [ ] **Step 4: 添加中英文文案**

在 `boxes` message tree 中加入计划状态、付费墙、购买中、到账确认、延迟、取消和已拥有权益文案；英文 key 与中文逐 leaf 对齐。核心中文文案为：`免费版最多可保有 3 个箱子`、`一次购买，永久解锁无限箱子。已有箱子和物品不会受影响。`、`AI 图片识别 Credits 需单独购买`、`HK$38 永久解锁`、`一次性付款，不订阅、不自动续费`。

- [ ] **Step 5: 运行组件与 i18n 测试**

Run: `npm test -- --run src/features/boxes/BoxLimitPaywall.test.tsx src/i18n/messages.test.ts`

Expected: 付费墙交互和中英文 leaf key 测试通过。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/boxes/BoxLimitPaywall.tsx apps/web/src/features/boxes/BoxLimitPaywall.test.tsx apps/web/src/components/overlay-layers.ts apps/web/src/i18n/messages.ts
git commit -m "feat: add box limit paywall"
```

## Task 6: 将额度、付费墙和支付返回接入箱子页

**Files:**

- Modify: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/CreateBoxModal.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`

**Interfaces:**

- Consumes: Task 4 的摘要/Checkout API、Task 5 的 `BoxLimitPaywall`。
- Produces: 页面状态 `free_limit/box_count/unlimited`、创建限额拦截、竞态保留表单、购买确认后重新打开创建流程。

- [ ] **Step 1: 写 BoxForm 限额回调失败测试**

为 `BoxFormProps` 计划增加 `onLimitReached?: () => void`。测试 mock `createBox` 抛出 `message='box_limit_reached'` 时调用回调、不显示通用保存失败、不清空 react-hook-form 已填值；普通错误仍显示 `boxes.saveError`。

- [ ] **Step 2: 实现 BoxForm 和 CreateBoxModal 回调链**

在创建分支 catch 中先判断 `isBoxLimitReached(error)`；命中时调用 `onLimitReached?.()` 并直接 return。编辑分支不打开箱子额度付费墙。`CreateBoxModal` 新增同名 prop 并传入 `BoxForm`，不关闭表单，使填写内容保留在内存中。

- [ ] **Step 3: 写 BoxesPage 额度状态失败测试**

为 `getBoxPlanSummary` 增加 mock，覆盖：

```ts
{ box_count: 2, free_limit: 3, unlimited_boxes: false, can_create: true }
{ box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false }
{ box_count: 5, free_limit: 3, unlimited_boxes: false, can_create: false }
{ box_count: 5, free_limit: 3, unlimited_boxes: true, can_create: true }
```

断言额度状态文案、已满点击创建打开付费墙、已解锁直接打开创建表单、竞态提交后付费墙覆盖创建表单且原表单仍存在。

- [ ] **Step 4: 实现 BoxesPage 计划查询和创建拦截**

加入 `useQuery({ queryKey: ['box-plan'], queryFn: getBoxPlanSummary })`；在 header 显示状态文案。`openCreate` 在有摘要且 `can_create=false` 时设置 paywall open，不改 URL；摘要 pending 时允许打开表单，RPC 作为最终校验。创建完成、删除成功和购买确认后 invalidate `['boxes']` 和 `['box-plan']`。

- [ ] **Step 5: 实现支付返回确认状态机**

监听 `purchase=success|canceled`：canceled 清理 URL 并通知取消；success 进入 confirmation 状态，最多执行 8 次、每次 1500ms 的 `box-plan` refetch。确认 `unlimited_boxes=true` 后清理 URL、通知解锁、关闭付费墙并将 `create=1` 写入 search params；8 次仍未到账时停止轮询，显示“付款正在确认”和“重新检查”按钮，保持已有箱子可用。

- [ ] **Step 6: 连接 Checkout busy/error 状态**

点击付费墙主按钮调用 `startBoxUnlimitedCheckout()`，期间将 `busy=true`；`entitlement_already_owned` 触发摘要刷新并继续创建；`billing_unavailable` 显示可重试错误；任何错误都不删除表单内容。支付 URL 跳转前不要写“购买成功”。

- [ ] **Step 7: 运行 BoxesPage、BoxForm 和回归测试**

Run: `npm test -- --run src/features/boxes/BoxForm.test.tsx src/features/boxes/CreateBoxModal.test.tsx src/features/boxes/BoxesPage.test.tsx src/features/boxes/BoxLimitPaywall.test.tsx`

Expected: 新额度测试和既有创建、删除、编辑、焦点恢复测试全部通过。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/boxes/BoxForm.tsx apps/web/src/features/boxes/CreateBoxModal.tsx apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx
git commit -m "feat: gate box creation with plan limits"
```

## Task 7: 接入 Stripe 一次性箱子权益

**Files:**

- Modify: `supabase/functions/billing-checkout/index.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Modify: `supabase/functions/billing-checkout/index_test.ts`
- Create: `supabase/functions/stripe-webhook/index_test.ts`

**Interfaces:**

- Consumes: `grant_account_entitlement(...)`、`revoke_account_entitlement(...)`、现有 `serviceDatabase`/Stripe helper。
- Produces: `boxes_unlimited` Checkout action，HK$38 Price allowlist，到账/全额退款/重复事件行为。

- [ ] **Step 1: 写 Checkout source contract 测试**

在现有 checkout source test 增加断言：包含 `boxes_unlimited`、`STRIPE_BOXES_UNLIMITED_PRICE_ID` 和 `mode: 'payment'`；不出现客户端传入 Price ID 或 unsupported `payment_method_types`。Webhook source test 断言箱子 action 调用 entitlement RPC，而不是 `grant_credits`。

- [ ] **Step 2: 扩展 checkout action 映射**

将 `CheckoutAction` 扩展为 `'credits_20' | 'credits_100' | 'credits_500' | 'boxes_unlimited'`。映射项为 `{ env: 'STRIPE_BOXES_UNLIMITED_PRICE_ID', entitlementCode: 'boxes_unlimited_lifetime' }`；credits 项继续保留 `credits`。metadata 必须写 `checkout_action`、`entitlement_code` 和 `supabase_user_id`。

- [ ] **Step 3: 增加已拥有权益检查和稳定错误响应**

Checkout 创建前使用 service database 直接查询 `account_entitlements`（不能调用依赖 `auth.uid()` 的客户端摘要 RPC）：过滤 `user_id = user.id`、`entitlement_code = boxes_unlimited_lifetime`、`status = active`。有效权益存在时返回 HTTP 409 和 `{ error: 'entitlement_already_owned' }`。普通 Stripe/数据库错误继续经过 `safeBillingError` 转为 `billing_unavailable`。创建成功的 URL 仍使用 `PUBLIC_APP_ORIGIN` 生成的 `/app/boxes?purchase=success` 和 `/app/boxes?purchase=canceled`。

- [ ] **Step 4: 改造 Webhook 完成事件分流**

`checkout.session.completed` 验证 session 身份、customer、mode、payment_status 和受控 metadata。`boxes_unlimited` 调用 `grant_account_entitlement`，相同 session 重放不重复发放；credits action 沿用原 grant。若已存在其他 active 箱子权益，标记 `duplicate_paid_entitlement`，完成事件而不循环重试。

- [ ] **Step 5: 改造全额退款分流**

`charge.refunded` 找到 Checkout Session 后按 metadata action 分流。箱子权益调用 `revoke_account_entitlement('stripe', 'checkout:' || checkout.id)`；credits 调用既有 `revoke_unused_credits`；部分退款直接返回并保留人工审核可观测信息。

- [ ] **Step 6: 运行 Deno billing 测试和类型检查**

Run: `deno test --config supabase/functions/deno.json supabase/functions/billing-checkout/index_test.ts supabase/functions/stripe-webhook/index_test.ts`

Expected: action/Price、付款状态、Credits/箱子分流、退款和幂等 source contract tests pass。

Run: `npm run typecheck:billing`

Expected: 两个 Edge Function 和共享 billing helper 无类型错误。

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/billing-checkout/index.ts supabase/functions/billing-checkout/index_test.ts supabase/functions/stripe-webhook/index.ts supabase/functions/stripe-webhook/index_test.ts
git commit -m "feat: sell unlimited box entitlement through stripe"
```

## Task 8: 补齐条款、部署 Runbook 和配置检查

**Files:**

- Modify: `apps/web/src/content/legal/terms.zh-CN.md`
- Modify: `apps/web/src/content/legal/terms.en-US.md`
- Modify: `docs/runbooks/deployment.md`

**Interfaces:**

- Consumes: 已确认的 HK$38、永久边界、退款和 AI Credits 独立规则。
- Produces: 发布人员能按顺序配置和验证，不会把 Secret 放进 Vite 环境。

- [ ] **Step 1: 更新中英文付费条款**

在现有 paid features 段落增加：箱子权益为一次性数字权益、HK$38 以 Checkout 最终页面为准、不订阅不自动续费、AI Credits 另计、全额退款可撤销未来的新增权限但不删除已有箱子、永久以账号和服务存续边界解释。

- [ ] **Step 2: 更新部署顺序和 Secret 清单**

Runbook 写明：先创建 Stripe one-time Price HK$38，再设置 `STRIPE_BOXES_UNLIMITED_PRICE_ID`、`PUBLIC_APP_ORIGIN`、Webhook Secret；部署 002 → Edge Functions → 前端 → 等待旧缓存退出 → 003；不得将 Price ID、Secret 或 service role key 以 `VITE_` 前缀写入 `apps/web/.env`。

- [ ] **Step 3: 增加 test mode 验收清单**

明确测试：第 3 个免费箱子后点击付费墙、Checkout cancel、Checkout paid、延迟 Webhook、重复 event、全额 refund、refund 后保持旧箱子可用、重新购买恢复 active、AI Credits 余额不变化。

- [ ] **Step 4: 运行文档/i18n/类型检查**

Run: `npm test -- --run src/features/legal/LegalDocumentPage.test.tsx src/i18n/messages.test.ts`

Expected: 条款页面和中文/英文 leaf key 测试通过。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/content/legal/terms.zh-CN.md apps/web/src/content/legal/terms.en-US.md docs/runbooks/deployment.md
git commit -m "docs: document box entitlement billing rollout"
```

## Task 9: 添加端到端和发布前验证

**Files:**

- Modify: `apps/web/e2e/mock-backend.ts` — 增加 `boxPlan` 状态、`create_box` RPC、`boxes_unlimited` checkout mock 和 purchase success 状态。
- Modify: `apps/web/e2e/core-flow.spec.ts` — 免费三箱、付费墙、成功返回、老用户超额场景。
- Create: `apps/web/e2e/box-entitlement.spec.ts` — 独立的额度/支付流程，避免让 core-flow 继续膨胀。

**Interfaces:**

- Consumes: Task 6 的 query keys、URL 参数和稳定错误码。
- Produces: 不访问真实 Stripe/Supabase 的浏览器流程覆盖。

- [ ] **Step 1: 写 mock backend 状态转换**

让 mock 初始 `boxPlan={box_count:2, free_limit:3, unlimited_boxes:false, can_create:true}`；第 3 次 create 更新为 3；第 4 次返回 PostgREST 风格 `message='box_limit_reached'`；`boxes_unlimited` checkout 设置 `purchase=success`，测试可控制 Webhook 延迟和最终 `unlimited_boxes=true`。

- [ ] **Step 2: 写 Playwright 场景**

覆盖：免费用户能创建三个；第四次出现 HK$38 付费墙；取消不改箱子；付款确认延迟显示确认文案；权益到账后自动回到创建流程；老用户 5 个箱子可查看和删除但创建被拦截；已解锁用户可创建第 4、5 个；AI Credits 页面余额不受影响。

- [ ] **Step 3: 运行 E2E**

Run: `npm run test:e2e`

Expected: 新增箱子权益场景和既有 core/privacy 场景通过。

- [ ] **Step 4: 运行完整验证矩阵**

Run: `npm run lint`

Expected: 0 lint errors。

Run: `npm run typecheck && npm run typecheck:billing`

Expected: Web 和 Edge billing 类型检查退出码 0。

Run: `npm test -- --run`

Expected: Vitest 全套通过。

Run: `npm run test:db`

Expected: 001～018 数据库测试通过；若当前环境没有启动 Supabase，记录为环境阻塞并在隔离 CI/测试环境补跑，不把未执行误报为通过。

Run: `npm run build`

Expected: 生产构建成功。

- [ ] **Step 5: 手工检查并发和 Stripe test mode**

在两个已登录浏览器标签页中保持 2 个箱子，同时点击创建并提交两个不同箱子，确认只成功一次；在 Stripe test mode 完成 paid、重放 webhook、全额退款和退款后重新购买，核对 `account_entitlements` active/revoked 行和箱子数量不变。

- [ ] **Step 6: Commit**

```bash
git add apps/web/e2e/mock-backend.ts apps/web/e2e/core-flow.spec.ts apps/web/e2e/box-entitlement.spec.ts
git commit -m "test: cover box entitlement user flows"
```

## Self-Review Checklist

- [ ] 3 个免费箱子、删除释放、老用户超额、无限解锁、全额退款和 AI Credits 独立规则均有数据库/API/UI/测试任务。
- [ ] direct INSERT 权限只在兼容阶段保留，前端切换后由 003 收口；不会先部署迁移导致旧前端立即失效。
- [ ] 权益历史不会因退款后重新购买被覆盖；active 记录使用部分唯一索引。
- [ ] 并发创建在 RPC 内持有用户级 advisory lock；前端摘要只做预提示。
- [ ] `box_limit_reached`、`entitlement_already_owned` 和 `billing_unavailable` 的客户端行为明确。
- [ ] 没有未完成占位内容或未定义函数/类型的步骤。
- [ ] 完成最后一项验证后才声称实现完成；数据库测试未运行时必须明确说明。
