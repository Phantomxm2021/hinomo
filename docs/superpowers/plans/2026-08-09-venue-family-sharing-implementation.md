# 场所家庭共享与物品流转记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Nomo 增加场所级家庭共享，让所有者通过一次性邀请允许最多 4 位家人共同维护收纳内容，并记录可追溯的关键物品流转。

**Architecture:** 保留 `venues.owner_id` 作为唯一数据所有者，新增 `venue_members` 表表达额外访问权，所有跨账号授权由 Supabase RLS 和 security-definer RPC 强制执行。箱子配额继续归场所所有者，AI Credits 归实际操作者；React 端消费数据库返回的能力摘要，不自行推断权限。关键活动在业务事务内写入现有 `activity_logs` 的扩展字段，并按场所授权读取。

**Tech Stack:** Supabase Postgres/PLpgSQL/RLS/pgTAP、React 19 + TypeScript 6、TanStack Query、React Router、Vitest/Testing Library、Playwright、`qrcode`、现有 R2 签名与 AI packing/credits 系统、Nomo 中英文 i18n。

## Global Constraints

- 共享边界固定为单个场所；成员不能访问所有者未共享的其他场所。
- 每个场所最多 5 人：1 位所有者和最多 4 位成员；所有者不写入 `venue_members`。
- 邀请令牌单次使用、创建后 24 小时过期、所有者可撤销；数据库只保存 SHA-256 摘要。
- 加入链接使用 `/join/venue#token=<token>`；原始令牌不得进入服务器访问日志、错误日志、分析事件或持久缓存。
- 成员可查看/搜索/扫码，可创建和编辑空间、箱子、物品，可删除物品；不能删除空间、箱子或场所，不能修改箱子公开状态。
- 成员创建箱子使用场所所有者账号的全局 3 箱免费额度或永久无限权益；成员不能管理该权益或账单。
- AI 识别和重新分析始终消耗实际操作者本人的 Credits，不回退扣场所所有者余额。
- 带 `owner_id` 的共享业务记录使用 `venues.owner_id`；`actor_id`/`created_by`/`requested_by` 记录实际操作者。
- 成员只能在同一共享场所内移动箱子或物品；所有者保留既有跨场所移动能力，跨场所日志不得泄露无权访问的目标名称。
- 移除成员或成员退出后，数据库访问立即失效；不删除业务数据或历史活动。
- 产品活动流只包含 `item_created`、`item_moved`、`item_quantity_changed`、`item_deleted`、`box_moved` 五类事件。
- 所有用户可见文案必须同时加入 `zh-CN` 和 `en-US`，不得在 JSX 中硬编码。
- 数据库迁移必须先于依赖它们的前端发布；回滚使用向前迁移或关闭入口，不删除成员、邀请、活动或共享业务数据。
- 每个任务遵循 TDD：先写失败测试并确认失败，再写最小实现，通过后提交。

---

## 文件地图

### 数据库与类型

- Create: `supabase/migrations/202608090001_venue_family_sharing.sql` — 成员、邀请、私有成员审计、访问帮助函数、邀请/成员/能力 RPC。
- Create: `supabase/migrations/202608090002_venue_shared_content.sql` — 场所/空间/布局/箱子/物品 RLS 与安全写 RPC、所有者箱子配额摘要。
- Create: `supabase/migrations/202608090003_venue_shared_workflows.sql` — 搜索、物品流转、普通媒体授权。
- Create: `supabase/migrations/202608090004_venue_shared_packing.sql` — packing 数据归属、共享访问与操作者 Credits。
- Create: `supabase/migrations/202608090005_venue_activity.sql` — 五类关键事件、快照、活动分页 RPC。
- Create: `supabase/tests/database/019_venue_family_sharing.test.sql` — 成员、邀请、席位和权限测试。
- Create: `supabase/tests/database/020_venue_shared_content.test.sql` — 共享 CRUD、危险操作和箱子配额测试。
- Create: `supabase/tests/database/021_venue_shared_workflows.test.sql` — 搜索、移动和媒体越权测试。
- Create: `supabase/tests/database/022_venue_shared_packing.test.sql` — packing 所有权和 Credits 主体测试。
- Create: `supabase/tests/database/023_venue_activity.test.sql` — 事件、快照、筛选和撤权测试。
- Modify: `supabase/tests/database/007_api_privileges.test.sql` — 新表/RPC 的最小权限契约。
- Modify: `apps/web/src/lib/database.types.ts` — 新表、枚举、字段和 RPC 的手工类型快照。
- Modify: `apps/web/src/lib/database.types.test-d.ts` — 编译期验证 RPC 参数、返回和不可伪造字段。

### Web 数据层与账号隔离

- Create: `apps/web/src/features/venues/venue-sharing.api.ts` — 成员、邀请、能力和稳定错误 API。
- Create: `apps/web/src/features/venues/venue-sharing.api.test.ts` — RPC 映射和错误码测试。
- Create: `apps/web/src/app/AccountQueryBoundary.tsx` — 认证主体变化时阻断旧缓存渲染并清空 QueryClient。
- Create: `apps/web/src/app/AccountQueryBoundary.test.tsx` — 跨账号缓存隐私测试。
- Modify: `apps/web/src/app/providers.tsx` — 在 AuthProvider 内挂载账号缓存边界。
- Modify: `apps/web/src/features/venues/venues.api.ts` — 列出拥有和加入的场所，返回角色与能力摘要。
- Modify: `apps/web/src/features/venues/venues.api.test.ts` — 共享场所映射测试。
- Modify: `apps/web/src/features/venues/selected-venue.ts` — 按用户隔离 localStorage key。

### 邀请、成员和活动 UI

- Create: `apps/web/src/features/venues/venue-invite-session.ts` — fragment 令牌解析、标签页临时保存和清理。
- Create: `apps/web/src/features/venues/venue-invite-session.test.ts` — 令牌不持久化和认证返回测试。
- Create: `apps/web/src/features/venues/JoinVenuePage.tsx` — 登录前预览、登录后接受及全部邀请状态。
- Create: `apps/web/src/features/venues/JoinVenuePage.test.tsx` — 加入状态和跳转测试。
- Create: `apps/web/src/features/venues/VenueInviteDialog.tsx` — 二维码、复制、系统分享和撤销。
- Create: `apps/web/src/features/venues/VenueInviteDialog.test.tsx` — 响应式、焦点和分享测试。
- Create: `apps/web/src/features/venues/VenueMembersPage.tsx` — 席位、成员、邀请、移除和退出。
- Create: `apps/web/src/features/venues/VenueMembersPage.test.tsx` — 所有者/成员能力及撤权 UI 测试。
- Create: `apps/web/src/features/venues/venue-activity.api.ts` — 活动游标分页 API。
- Create: `apps/web/src/features/venues/venue-activity.api.test.ts` — 参数和游标测试。
- Create: `apps/web/src/features/venues/VenueActivityPage.tsx` — 最近 50 条、成员/动作筛选和离开标识。
- Create: `apps/web/src/features/venues/VenueActivityPage.test.tsx` — 文案、筛选、分页和空/错状态测试。
- Modify: `apps/web/src/app/router.tsx` / `router.test.tsx` — 加入、成员、活动路由。
- Modify: `apps/web/src/features/auth/LoginPage.tsx` / `LoginPage.test.tsx` — 保留安全 `returnTo`。
- Modify: `apps/web/src/features/auth/RegisterPage.tsx` / `RegisterPage.test.tsx` — 注册后恢复加入流程。
- Modify: `apps/web/src/features/venues/VenuesPage.tsx` / `VenuesPage.test.tsx` — 共享标识和管理入口。
- Modify: `apps/web/src/features/venues/VenueSwitcher.tsx` / `VenueSwitcher.test.tsx` — “家庭共享”与所有者标识。
- Modify: `apps/web/src/components/AppIcon.tsx` / `AppIcon.test.tsx` — `family`、`history`、`share`、`copy` 图标。
- Modify: `apps/web/src/i18n/messages.ts` / `messages.test.ts` — 全部中英文文案和键一致性。

### 共享内容前端适配

- Modify: `apps/web/src/features/spaces/spaces.api.ts` / `spaces.api.test.ts` — 空间与布局写入切换到安全 RPC。
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx` / `SpacesPage.test.tsx` — 成员可编辑但不能删除。
- Modify: `apps/web/src/features/boxes/boxes.api.ts` / `boxes.api.test.ts` — 删除 owner 过滤、共享详情和安全更新 RPC。
- Modify: `apps/web/src/features/boxes/box-entitlements.api.ts` / `box-entitlements.api.test.ts` — 场所所有者配额摘要。
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx` / `BoxesPage.test.tsx` — 能力控制和成员额度提示。
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx` / `PublicBoxPage.test.tsx` — 成员内容操作、所有者危险操作。
- Modify: `apps/web/src/features/boxes/BoxForm.tsx` / `BoxForm.test.tsx` — 成员不能改 visibility。
- Modify: `apps/web/src/features/boxes/CreateBoxModal.tsx` / `CreateBoxModal.test.tsx` — 创建时透传 visibility 能力。
- Modify: `apps/web/src/features/boxes/EditBoxModal.tsx` / `EditBoxModal.test.tsx` — 透传能力。

### 验收、法律与发布

- Modify: `apps/web/e2e/mock-backend.ts` — 两账号、邀请、共享权限和活动 mock。
- Create: `apps/web/e2e/venue-family-sharing.spec.ts` — 所有者邀请、成员完整流程、额度、撤权和活动 E2E。
- Create: `scripts/test-venue-sharing-concurrency.mjs` — 本地 Supabase 两会话竞争最后席位集成测试。
- Modify: `package.json` — 增加 `test:venue-sharing-concurrency`。
- Modify: `apps/web/src/content/legal/privacy.zh-CN.md` / `privacy.en-US.md` — 成员资料、共享内容和历史快照说明。
- Modify: `apps/web/src/content/legal/terms.zh-CN.md` / `terms.en-US.md` — 邀请责任、成员删除权限和撤权边界。
- Modify: `apps/web/src/features/legal/legal-policy.ts` — 版本更新为 `2026-08-09`。
- Modify: `docs/runbooks/deployment.md` — 迁移顺序、健康查询、灰度、并发验收和向前回滚。

---

## Task 1: 建立场所成员、邀请和能力数据库边界

**Files:**

- Create: `supabase/tests/database/019_venue_family_sharing.test.sql`
- Create: `supabase/migrations/202608090001_venue_family_sharing.sql`
- Modify: `supabase/tests/database/007_api_privileges.test.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`

**Interfaces:**

- Consumes: `public.venues`、`public.profiles`、`private.r2_presign_from_vault(...)`、`tests.create_supabase_user`。
- Produces: `venue_members`、`venue_invites`、`private.venue_membership_audit`、四个访问帮助函数，以及成员/邀请/能力 RPC。

- [ ] **Step 1: 写成员、邀请和最小权限失败测试**

在 019 中创建 owner、member-a、member-b、member-c、member-d、member-e 和 outsider，建立一个 owner 场所。先断言以下对象和权限契约：

```sql
select has_table('public', 'venue_members', 'venue members exist');
select has_table('public', 'venue_invites', 'venue invites exist');
select has_function('public', 'can_access_venue', array['uuid'], 'venue access helper exists');
select has_function('public', 'create_venue_invite', array['uuid'], 'owner can create invite');
select has_function('public', 'accept_venue_invite', array['text'], 'authenticated user can accept invite');
select has_function('public', 'remove_venue_member', array['uuid', 'uuid'], 'owner can remove member');
select has_function('public', 'leave_venue', array['uuid'], 'member can leave venue');
select ok(not has_table_privilege('authenticated', 'public.venue_members', 'insert'),
  'clients cannot insert memberships directly');
select ok(not has_table_privilege('authenticated', 'public.venue_invites', 'select'),
  'clients cannot read invite hashes');
```

写行为断言：owner 可创建邀请；raw token 不出现在表中；接受后成员数为 1；相同账号重复接受返回 `already_member`；另一账号复用返回 `venue_invite_used`；撤销返回 `venue_invite_revoked`；过期返回 `venue_invite_expired`；第 5 位额外成员返回 `venue_member_limit_reached`；owner 不能加入/退出自己的场所；outsider 不能列成员、撤销邀请或移除成员；成员离开和被移除后 `can_access_venue=false`，业务表不被删除。以 postgres 断言 private audit 精确记录 create/revoke/join/remove/leave，authenticated/service_role 均不能直接读取或写入该表。

- [ ] **Step 2: 运行数据库测试确认 RED**

Run: `npm run test:db`

Expected: 019 因 `venue_members`、`venue_invites` 和 RPC 不存在而失败；既有 001–018 不应被修改以掩盖失败。

- [ ] **Step 3: 创建表、约束和索引**

在 001 迁移创建以下结构；`token_hash` 固定 32 bytes，状态由时间列推导，不增加可漂移的 status 字段：

```sql
create table public.venue_members (
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default pg_catalog.now(),
  primary key (venue_id, user_id)
);

create table public.venue_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_by uuid not null,
  token_hash bytea not null unique check (pg_catalog.octet_length(token_hash) = 32),
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check ((accepted_by is null) = (accepted_at is null)),
  check (accepted_at is null or revoked_at is null)
);

create index venue_members_user_id_idx on public.venue_members(user_id, venue_id);
create index venue_invites_active_idx on public.venue_invites(venue_id, expires_at)
where accepted_at is null and revoked_at is null;

create table private.venue_membership_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  venue_id uuid not null,
  actor_id uuid,
  subject_user_id uuid,
  event_code text not null check (event_code in (
    'invite_created', 'invite_revoked', 'member_joined', 'member_removed', 'member_left'
  )),
  created_at timestamptz not null default pg_catalog.now()
);
```

`venue_invites.created_by/accepted_by` 有意保存 UUID 快照而不加 auth.users 外键：member 账号删除后 used invite 仍保持 accepted 状态，不会因 `on delete set null` 与 accepted_at 一致性检查冲突；owner 删除会由 venue cascade 删除 invite。启用 RLS，并从 `public, anon, authenticated, service_role` 撤销两个 public 表全部权限；private audit 表继续继承 private schema 的完全封闭权限。audit 的 venue/user UUID 不加级联外键，保证成员、账号或场所删除后安全事件仍可供数据库管理员排查。增加约束 trigger，拒绝把 `venues.owner_id` 写入成员表；成员上限仍由带场所锁的 RPC 强制。

- [ ] **Step 4: 实现无递归访问帮助函数和能力摘要**

实现 `security definer set search_path = pg_catalog` 的 `is_venue_owner(uuid)`、`is_venue_member(uuid)`、`can_access_venue(uuid)`、`can_edit_venue_content(uuid)`，函数内部只使用 `auth.uid()`。仅向 authenticated 授予 execute。

实现：

```sql
public.get_venue_access_summary(p_venue_id uuid)
returns table (
  venue_id uuid,
  role text,
  can_manage_members boolean,
  can_delete_venue boolean,
  can_delete_space boolean,
  can_delete_box boolean,
  can_change_box_visibility boolean,
  can_use_ai boolean,
  member_count integer,
  max_members integer
)
```

owner 的危险能力为 true；member 只保留 `can_use_ai=true`；`member_count` 包含 owner，`max_members=5`；无访问权抛 `venue_access_denied`。

- [ ] **Step 5: 实现成员列表和可访问场所列表**

`list_accessible_venues()` 返回：`id, owner_id, name, description, is_default, role, owner_display_name, space_count, member_count, max_members`。结果为 owner 自有场所与 `venue_members.user_id=auth.uid()` 的并集。

`list_venue_members(p_venue_id)` 先执行 `can_access_venue`，返回 owner 加成员：

```sql
returns table (
  user_id uuid,
  role text,
  display_name text,
  avatar_url text,
  joined_at timestamptz,
  is_current boolean
)
```

只读取 `profiles.display_name/avatar_object_key`；头像存在时生成 5 分钟 GET URL，不返回 object key、locale、email 或账单字段。

- [ ] **Step 6: 实现邀请创建、检查和原子接受**

`create_venue_invite(p_venue_id)` 仅 owner 可调用，场所锁使用：

```sql
perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('venue-members:' || p_venue_id::text, 0)
);
```

在锁内校验 `1 + members + active_invites < 5`，用 `extensions.gen_random_bytes(32)` 生成 base64url token，保存 `extensions.digest(token, 'sha256')`，固定 `expires_at=now()+interval '24 hours'`，返回 `{ invite_id, token, expires_at }`。

`inspect_venue_invite(p_token text)` 授权 anon/authenticated，只返回 `{ venue_id, venue_name, owner_display_name, status, expires_at, current_user_state }`；status 固定为 `active|expired|used|revoked|missing|full`，不返回成员清单。

`accept_venue_invite(p_token text)` 锁邀请行后获取同一场所锁，按规格顺序处理 accepted/revoked/expired/owner/already-member/full，成功时同一事务插入成员并标记 accepted，返回 `{ venue_id, result }`，result 固定 `joined|already_member`。

- [ ] **Step 7: 实现邀请列表、撤销、移除和退出**

实现 owner-only `list_venue_invites(uuid)`、`revoke_venue_invite(uuid)`、`remove_venue_member(uuid, uuid)`；实现 member-only `leave_venue(uuid)`。create/revoke/accept/remove/leave 在同一事务写 private audit，actor 取 `auth.uid()`，subject 为接受/移除/退出账号；审计写入失败则成员变更回滚。删除成员关系前后都不触碰空间、箱子、物品、媒体和 `activity_logs`。所有业务拒绝使用规格中的稳定错误码。

- [ ] **Step 8: 更新权限测试和 TypeScript 数据库类型**

在 007 断言新表对 anon/authenticated/service_role 均无直接写权限，只有规定角色可执行 RPC。在 `database.types.ts` 增加表、Rows/Inserts/Updates 和函数 Args/Returns；在 `database.types.test-d.ts` 加入：

```ts
type AcceptInviteArgs = Database['public']['Functions']['accept_venue_invite']['Args']
const validAcceptInvite: AcceptInviteArgs = { p_token: 'opaque-token' }
// @ts-expect-error actor identity comes from auth.uid(), never from the client
const forgedAcceptInvite: AcceptInviteArgs = { p_token: 'opaque-token', p_user_id: 'forged' }
void validAcceptInvite
void forgedAcceptInvite
```

- [ ] **Step 9: 运行 GREEN 验证并提交**

Run: `npm run test:db`

Expected: 019 和更新后的 007 全绿，001–018 无回归。

Run: `npm run typecheck`

Expected: 数据库类型快照通过编译。

```bash
git add supabase/migrations/202608090001_venue_family_sharing.sql supabase/tests/database/019_venue_family_sharing.test.sql supabase/tests/database/007_api_privileges.test.sql apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts
git commit -m "feat: add venue family membership primitives"
```

## Task 2: 扩展共享场所核心 CRUD 与所有者箱子额度

**Files:**

- Create: `supabase/tests/database/020_venue_shared_content.test.sql`
- Create: `supabase/migrations/202608090002_venue_shared_content.sql`
- Modify: `supabase/tests/database/007_api_privileges.test.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`

**Interfaces:**

- Consumes: Task 1 的 `can_access_venue`、`is_venue_owner`、成员表；现有 `account_entitlements` 和 `create_box`。
- Produces: 安全空间/布局/箱子写 RPC、仅限成员场所的箱子列表 RPC、兼容旧 owner 客户端的防御 trigger、场所所有者配额摘要及共享核心 RLS。

- [ ] **Step 1: 写共享 CRUD 与危险操作失败测试**

在 020 建立 owner 的 shared/private 两场所、member、outsider，并让 outsider 另有 public box。测试 member 能读取 shared venue/space/box/item，不能读取 private venue；`list_accessible_boxes(null)` 不返回 outsider public box；member 可创建/编辑空间、创建/编辑/移动箱子、创建/编辑/删除物品；member 不能删除空间/箱子/场所、不能改 visibility、不能把实体移到另一个场所；outsider 全部被拒绝。断言 owner 原有创建、编辑、删除不回归。

写箱子额度断言：owner 有 2 个箱子时 member 创建第 3 个成功且新箱 `owner_id=owner`；第 4 个返回 `box_limit_reached`；发放 owner 无限权益后 member 可继续创建；member 自己的权益和箱子数不影响该场所配额。

- [ ] **Step 2: 运行 RED 数据库测试**

Run: `npm run test:db`

Expected: member 读取和新 RPC 断言因现有 owner-only RLS/函数失败。

- [ ] **Step 3: 扩展 venues/spaces/space_layouts/boxes/items RLS**

迁移中用 drop/create 替换策略：

```sql
create policy venues_select_accessible on public.venues
for select to authenticated using (public.can_access_venue(id));

create policy spaces_select_accessible on public.spaces
for select to authenticated using (public.can_access_venue(venue_id));

create policy boxes_select_public on public.boxes
for select to anon, authenticated
using (visibility = 'public'::public.box_visibility);

create policy boxes_select_accessible on public.boxes
for select to authenticated using (
  exists (
    select 1 from public.spaces
    where spaces.id = boxes.space_id and public.can_access_venue(spaces.venue_id)
  )
);
```

items 和 space_layouts 通过父实体解析场所。公开读取和 authenticated 共享读取使用两条独立 policy，保证 anon policy 不调用仅授予 authenticated 的访问帮助函数。venues 更新/删除、spaces 删除、boxes 删除保持 owner-only；items 的 insert/update/delete 允许可编辑成员，但 `box_id` 的直接 update 继续撤销，移动统一走 `move_item`。

- [ ] **Step 4: 增加空间和布局安全 RPC，同时保持旧 owner 客户端兼容**

新增：

```sql
create_space(p_venue_id uuid, p_name text, p_description text)
returns table(id uuid);

update_space(p_space_id uuid, p_venue_id uuid, p_name text, p_description text)
returns void;

save_space_layout(
  p_space_id uuid, p_x_percent numeric, p_y_percent numeric,
  p_width_percent numeric, p_height_percent numeric
) returns void;
```

三者先解析 venue owner；成员可创建/编辑，但 owner_id 永远写 venue owner。owner 可把 space 移到自己拥有的另一 venue；member 提交的 `p_venue_id` 必须等于当前 venue。布局 upsert 写规范 owner_id。

本迁移不提前撤销 authenticated 的 spaces/space_layouts 旧写权限，避免数据库先行发布时旧 owner 前端中断。增加 BEFORE trigger：direct insert/upsert 根据 venue/space 覆盖为规范 owner_id；direct update 拒绝 member 改 venue_id、owner_id 或其他父关系。旧 owner 调用继续成功，member 即使绕过新 RPC 也只能完成权限矩阵允许的低风险字段编辑。

- [ ] **Step 5: 改造箱子配额摘要、创建和编辑 RPC**

新增：

```sql
get_venue_box_plan_summary(p_venue_id uuid)
returns table (
  box_count integer, free_limit integer,
  unlimited_boxes boolean, can_create boolean
);
```

只有可访问该场所的账号能调用，统计主体为 `venues.owner_id` 的全部箱子和权益。

新增 `list_accessible_boxes(p_venue_id uuid default null)`，返回现有 BoxSummary 所需字段：`id, public_id, box_code, space_id, venue_id, name, location, visibility, cover_object_key, updated_at, item_count, space_name, venue_name`。查询条件必须是 `can_access_venue(spaces.venue_id)`，不能只依赖 boxes 的 public-read RLS；这样无 venue filter 的 dashboard/移动目标列表也不会混入全站其他用户的公开箱子。

替换现有 `create_box(...)` 函数体：从 `p_space_id` 加载 space+venue，验证 caller 可编辑场所，以 venue owner 获取 owner-level advisory lock，检查 owner 权益/全局箱子数，写入 `boxes.owner_id=venue.owner_id`。

新增 `update_box(...)`：

```sql
update_box(
  p_box_id uuid, p_space_id uuid, p_name text, p_category text,
  p_location text, p_description text, p_visibility public.box_visibility
) returns void;
```

member 只能移动到同 venue 的 space，且 `p_visibility` 必须等于旧值；owner 可在自己的场所之间移动并修改 visibility。为兼容旧 owner 前端，本迁移保留现有 boxes 列级 update grant，并增加 BEFORE UPDATE guard：member 改 visibility、owner_id 或跨 venue space_id 时返回 `venue_owner_required/venue_access_denied`，owner 的既有安全更新继续成功。delete 继续由 owner-only RLS 控制。

- [ ] **Step 6: 强制 owner_id 和父关系不可伪造**

加入防御 trigger：spaces/boxes 的 owner_id 必须等于父 venue owner；items 的目标 box 必须存在且可编辑；成员无法通过 REST 写 `owner_id`、跨场所 `venue_id`、box `visibility` 或跨场所父引用。007 明确断言安全 RPC 只有 authenticated execute，并保留旧 owner 客户端所需的精确列权限；020 必须直接通过 REST 等价 SQL 证明这些兼容 grants 不能绕过 trigger/RLS。

- [ ] **Step 7: 更新数据库类型、运行验证并提交**

在类型文件增加 `create_space/update_space/save_space_layout/get_venue_box_plan_summary/list_accessible_boxes/update_box`，并保持 `create_box` 原签名。编译期断言 `update_box/update_space` 都没有 `p_owner_id`；`update_space.p_venue_id` 只表示目标场所，数据库仍自行解析 owner。

Run: `npm run test:db`

Expected: 020/007 全绿，018 的 owner 箱子权益测试继续通过。

Run: `npm run typecheck`

Expected: 通过。

```bash
git add supabase/migrations/202608090002_venue_shared_content.sql supabase/tests/database/020_venue_shared_content.test.sql supabase/tests/database/007_api_privileges.test.sql apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts
git commit -m "feat: authorize shared venue content"
```

## Task 3: 扩展搜索、物品流转和普通媒体授权

**Files:**

- Create: `supabase/tests/database/021_venue_shared_workflows.test.sql`
- Create: `supabase/migrations/202608090003_venue_shared_workflows.sql`
- Modify: `apps/web/src/lib/database.types.ts`

**Interfaces:**

- Consumes: Task 1 的访问帮助函数、Task 2 的共享 RLS。
- Produces: 共享搜索、同场所移动、共享媒体签名和安全对象 key。

- [ ] **Step 1: 写搜索、移动和媒体 RED 测试**

021 覆盖：member 的 `search_my_items` 与 `search_my_inventory` 能找到 shared venue 正式物品，但找不到 private venue；member 可 take out/return/move shared item；member 不能移动到另一个 venue，即使同时加入两个 venue；owner 保留跨场所移动；item_movements 只对当前可访问场所可读。AI 结果依赖 Task 4 的 packing RLS，在 022 中验收。

媒体覆盖：member 可为 shared box/item 创建、确认、下载；生成 key 必须以 venue owner 为前缀；outsider 不能使用猜到的 box/item/upload/object key；移除成员后不能签发新下载 URL。

- [ ] **Step 2: 运行 RED**

Run: `npm run test:db`

Expected: owner-only search/movement/media 断言失败。

- [ ] **Step 3: 改造搜索与 item_movements**

重建 `search_my_items(text)` 和当前最终版 `search_my_inventory(text)`，将 `boxes.owner_id=auth.uid()` 替换为场所访问判断；保持签名和结果字段不变，避免前端 API 漂移。

重建 item_movements select policy，并替换 `take_out_item`、`return_item`、`move_item` 的 owner 条件。`move_item` 读取 source/target venue：

```sql
if not public.is_venue_owner(source_venue_id)
  and source_venue_id is distinct from target_venue_id then
  raise exception using errcode = '42501', message = 'venue_access_denied';
end if;
```

owner 跨场所移动还必须拥有 source 和 target；成员只能同场所。

- [ ] **Step 4: 改造普通媒体 RPC**

替换 `create_media_upload`、`confirm_media_upload`、`create_media_download`：

- 从 box→space→venue 解析 `canonical_owner_id`；
- caller 必须 `can_edit_venue_content` 才能创建/确认；下载只需 `can_access_venue`；
- `media_uploads.owner_id` 和 object key 使用 canonical owner；
- confirm 根据 upload 对应 box 再次鉴权，不比较 `upload.owner_id=caller`；
- download 必须确认 object key 存在于当前可访问的 box/item/media 记录，不仅检查字符串前缀。

对象 key 继续使用固定形式：

```sql
'users/' || canonical_owner_id || '/boxes/' || p_box_id || '/' ||
case when p_media_kind = 'cover' then 'cover/' else 'items/' || p_item_id || '/' end ||
extensions.gen_random_uuid() || file_extension
```

- [ ] **Step 5: 运行 GREEN、类型检查并提交**

Run: `npm run test:db`

Expected: 021 全绿，003/004/005/012/013 既有搜索、媒体、移动测试无回归。

Run: `npm run typecheck`

Expected: 通过；RPC 签名保持兼容。

```bash
git add supabase/migrations/202608090003_venue_shared_workflows.sql supabase/tests/database/021_venue_shared_workflows.test.sql apps/web/src/lib/database.types.ts
git commit -m "feat: share venue workflows and media"
```

## Task 4: 让共享 packing 使用操作者 Credits

**Files:**

- Create: `supabase/tests/database/022_venue_shared_packing.test.sql`
- Create: `supabase/migrations/202608090004_venue_shared_packing.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`

**Interfaces:**

- Consumes: Task 1 的 venue helpers、Task 3 的安全媒体原则、现有 private credit reservation functions。
- Produces: packing 规范所有者、实际操作者字段和共享 RPC 权限。

- [ ] **Step 1: 写 packing/credits RED 测试**

022 创建 owner、member、other member、outsider，各自 credit grant。断言 member 可为 shared box 创建 session、上传/确认照片和 atlas、完成分析、读结果、编辑/合并/提升识别物品，且 `search_my_inventory` 能检索该 shared venue 已发布 AI 结果而不泄露 private venue；session/媒体/promotion 的 owner_id 是 venue owner，`created_by/requested_by` 是 member；完成和 reanalysis 只减少当前 caller 的 Credits，owner 与其他 member 余额不变；outsider 无法读取或调用；移除 member 后访问被拒绝。

- [ ] **Step 2: 运行 RED**

Run: `npm run test:db`

Expected: owner-only packing policies/functions拒绝 member，新增 actor 字段缺失。

- [ ] **Step 3: 分离 packing 数据所有者与操作者**

迁移新增并回填：

```sql
alter table public.packing_sessions add column created_by uuid references auth.users(id) on delete set null;
update public.packing_sessions set created_by = owner_id where created_by is null;

alter table public.packing_item_promotions add column requested_by uuid references auth.users(id) on delete set null;
update public.packing_item_promotions set requested_by = owner_id where requested_by is null;
```

新 session 写 `owner_id=venue.owner_id, created_by=auth.uid()`；promotion 写 `owner_id=venue.owner_id, requested_by=auth.uid()`；R2 object key 始终以 venue owner 开头。

- [ ] **Step 4: 重建共享 packing RLS**

packing_sessions/photos/atlases/detected_items/instances/evidence/promotions 的 authenticated select/update 条件改为从 `box_id` 或 session.box_id 调用 `can_access_venue`/`can_edit_venue_content`。analysis_jobs 继续不向客户端开放；service role worker 权限不扩大。

- [ ] **Step 5: 覆盖所有用户入口 RPC 的 owner-only 条件**

用 004 覆盖当前最终定义：`create_packing_session`、`create_packing_photo_upload`、`confirm_packing_photo_upload`、`delete_packing_photo`、`create_packing_atlas_upload`、`confirm_packing_atlas_upload`、`complete_packing_session`、`cancel_packing_session`、`delete_packing_session`、`create_packing_media_download`、`request_packing_item_promotion`、`update_packing_detected_item`、`merge_packing_detected_items`、`request_packing_reanalysis`。

每个函数通过 session→box→space→venue 重新鉴权。`complete_packing_session` 和 `request_packing_reanalysis` 保持现有 photo freeze、atlas、幂等和 queue 逻辑，只把 credit principal 明确为 caller：

```sql
perform private.reserve_packing_credits(
  caller, current_session.id, target_revision, confirmed_count, idempotency_key
);
```

不得使用 `current_session.owner_id` 扣 Credits。

- [ ] **Step 6: 更新类型并运行完整 packing 验证**

在数据库类型增加 nullable `created_by/requested_by`。编译期断言 PackingSession Row 含 `created_by: string | null`。

Run: `npm run test:db`

Expected: 022、014–016 通过。

Run: `npm run test:worker && npm run typecheck:worker && npm run typecheck`

Expected: worker、Web 类型全绿。

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/202608090004_venue_shared_packing.sql supabase/tests/database/022_venue_shared_packing.test.sql apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts
git commit -m "feat: share packing with actor credits"
```

## Task 5: 写入并读取五类关键场所活动

**Files:**

- Create: `supabase/tests/database/023_venue_activity.test.sql`
- Create: `supabase/migrations/202608090005_venue_activity.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`

**Interfaces:**

- Consumes: Tasks 1–4 的成员、共享 CRUD、packing promotion actor。
- Produces: `venue_activity_event`、activity_logs 扩展、关键事件 trigger/helper、`list_venue_activity`。

- [ ] **Step 1: 写活动 RED 测试**

023 断言五类操作分别生成一条 product event，actor 为实际 owner/member，快照含 item/box/space 名称、数量前后值、来源/目标；普通字段更新不进入产品活动流；删除实体后快照仍可读；离开成员返回 `actor_is_current=false`；当前成员可读，退出成员和 outsider 不可读；成员/动作筛选与 `(created_at,id)` 游标排序稳定。

增加 owner 跨场所 box 和 item move：source row 不含私密目标场所/箱子/空间名，destination row 不含私密来源名；同场所移动包含完整的两个箱子名或空间名。

- [ ] **Step 2: 运行 RED**

Run: `npm run test:db`

Expected: 新列、枚举和活动 RPC 缺失。

- [ ] **Step 3: 扩展 activity_logs 并建立索引**

```sql
create type public.venue_activity_event as enum (
  'item_created', 'item_moved', 'item_quantity_changed', 'item_deleted', 'box_moved'
);

alter table public.activity_logs
  add column venue_id uuid references public.venues(id) on delete set null,
  add column event_code public.venue_activity_event;

create index activity_logs_venue_feed_idx
on public.activity_logs(venue_id, created_at desc, id desc)
where event_code is not null;
```

旧日志只在可解析时回填 venue_id，不猜测 event_code。产品 feed 只查询 event_code 非空行。

- [ ] **Step 4: 实现事务内事件写入和去重**

新增 private helper 接收显式 actor 与白名单 snapshot，禁止客户端 execute。items AFTER trigger：INSERT 写 item_created；DELETE 写 item_deleted；UPDATE box_id 写 item_moved；UPDATE quantity 写 item_quantity_changed；同一 UPDATE 同时改变 box/quantity 时分别写两类真实事件。boxes AFTER UPDATE 仅在 space_id 变化时写 box_moved。

每条 snapshot 固定使用以下白名单形状：

```json
{
  "actor_display_name": "小林",
  "entity_name": "露营灯",
  "from": { "id": "uuid", "name": "杂物箱" },
  "to": { "id": "uuid", "name": "户外用品箱" },
  "quantity_before": 3,
  "quantity_after": 6,
  "direction": "within"
}
```

不适用字段省略，不写 null 占位。跨场所 move 分别写 source/destination 两行，`direction` 为 `out|in` 且不保存另一侧私密名称；同场所为 `within`。现有通用 `write_activity_log` 可保留，但新 feed 中每个场所、每个 event_code 只出现一次。service-role AI promotion 的 item_created 由最终 promotion 函数用 `requested_by` 显式写入；trigger 在 `auth.uid()` 为空时不伪造 actor。

- [ ] **Step 5: 实现授权分页 RPC**

```sql
list_venue_activity(
  p_venue_id uuid,
  p_actor_id uuid default null,
  p_event_code public.venue_activity_event default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
) returns table (
  id uuid, actor_id uuid, actor_display_name text,
  actor_is_current boolean, event_code public.venue_activity_event,
  entity_type public.audit_entity, entity_id uuid,
  snapshot jsonb, created_at timestamptz
)
```

限制 `p_limit between 1 and 50`；先验证 caller 仍可访问 venue；member 离开状态通过当前 venue owner/member 关系计算，不能用账号是否存在推断。

- [ ] **Step 6: 更新类型、运行 GREEN 并提交**

Run: `npm run test:db`

Expected: 023 全绿，008 的旧 trigger 测试无回归。

Run: `npm run typecheck`

Expected: 新枚举和 RPC 类型通过。

```bash
git add supabase/migrations/202608090005_venue_activity.sql supabase/tests/database/023_venue_activity.test.sql apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts
git commit -m "feat: record shared venue activity"
```

## Task 6: 增加账号级缓存隔离与共享场所数据层

**Files:**

- Create: `apps/web/src/app/AccountQueryBoundary.tsx`
- Create: `apps/web/src/app/AccountQueryBoundary.test.tsx`
- Create: `apps/web/src/features/venues/venue-sharing.api.ts`
- Create: `apps/web/src/features/venues/venue-sharing.api.test.ts`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/features/venues/venues.api.ts`
- Modify: `apps/web/src/features/venues/venues.api.test.ts`
- Modify: `apps/web/src/features/venues/selected-venue.ts`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`

**Interfaces:**

- Consumes: Task 1 typed RPC。
- Produces: `VenueAccessSummary`、`VenueMember`、`VenueInviteSummary`、`VenueInvitePreview`、成员/邀请 API；跨账号无旧缓存渲染。

- [ ] **Step 1: 写缓存隔离和 API RED 测试**

AccountQueryBoundary 测试先为 user-a 写入 `['venues']` 私密数据，再把 AuthProvider session 切到 user-b；断言 user-b 子树挂载前 QueryClient 已清空，DOM 从未显示 user-a 场所。再覆盖 logout。

API 测试 mock `supabase.rpc`，断言 `listVenues()` 改用 `list_accessible_venues`，并正确映射 owner/member、owner_display_name、member_count/max_members。邀请 API 逐一断言函数名、参数和稳定错误透传。

- [ ] **Step 2: 运行 RED**

Run: `npm test -- --run src/app/AccountQueryBoundary.test.tsx src/features/venues/venue-sharing.api.test.ts src/features/venues/venues.api.test.ts`

Expected: 新模块缺失，listVenues 仍直接查询表。

- [ ] **Step 3: 实现 AccountQueryBoundary**

组件在当前 session user id 与已激活 id 不同时先渲染 null，并在 layout effect 中清除缓存再放行：

```tsx
export function AccountQueryBoundary({ children }: PropsWithChildren) {
  const { session, loading } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id ?? null
  const [activeUserId, setActiveUserId] = useState(userId)

  useLayoutEffect(() => {
    if (activeUserId === userId) return
    queryClient.clear()
    setActiveUserId(userId)
  }, [activeUserId, queryClient, userId])

  if (loading || activeUserId !== userId) return null
  return children
}
```

在 providers 中置于 AuthProvider 内、LocaleProfileSync/RouterProvider 外。

- [ ] **Step 4: 定义共享 API 类型与错误识别**

`venue-sharing.api.ts` 导出：

```ts
export type VenueRole = 'owner' | 'member'
export type VenueAccessSummary = {
  venue_id: string; role: VenueRole
  can_manage_members: boolean; can_delete_venue: boolean
  can_delete_space: boolean; can_delete_box: boolean
  can_change_box_visibility: boolean; can_use_ai: boolean
  member_count: number; max_members: number
}
export type VenueInviteErrorCode =
  | 'venue_invite_expired' | 'venue_invite_used' | 'venue_invite_revoked'
  | 'venue_member_limit_reached' | 'venue_access_denied' | 'venue_owner_required'
```

实现 `getVenueAccessSummary`、`listVenueMembers`、`createVenueInvite`、`inspectVenueInvite`、`acceptVenueInvite`、`listVenueInvites`、`revokeVenueInvite`、`removeVenueMember`、`leaveVenue`，空单行结果抛显式错误，不静默生成 owner 能力。

- [ ] **Step 5: 切换可访问场所 API 和用户级选择 key**

`VenueSummary` 增加 `owner_id, role, owner_display_name, member_count, max_members`；`listVenues` 调用 `list_accessible_venues()`。`useSelectedVenue` 接收 `userId`，存储 key 改为：

```ts
const selectedVenueStorageKey = (userId: string) => `nomo-selected-venue-id:${userId}`
```

账号变化时重新读取对应 key；无权限 id 继续回落到第一条可访问场所。

- [ ] **Step 6: 运行 GREEN、类型检查并提交**

Run: `npm test -- --run src/app/AccountQueryBoundary.test.tsx src/features/venues/venue-sharing.api.test.ts src/features/venues/venues.api.test.ts`

Expected: 全绿。

Run: `npm run typecheck`

Expected: 调用 `useSelectedVenue` 的现有页面会暴露待 Task 8/9 修正的编译错误时，本任务必须同时传入 `session.user.id` 保持主干可编译，不允许提交红色类型状态。

```bash
git add apps/web/src/app/AccountQueryBoundary.tsx apps/web/src/app/AccountQueryBoundary.test.tsx apps/web/src/app/providers.tsx apps/web/src/features/venues/venue-sharing.api.ts apps/web/src/features/venues/venue-sharing.api.test.ts apps/web/src/features/venues/venues.api.ts apps/web/src/features/venues/venues.api.test.ts apps/web/src/features/venues/selected-venue.ts apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/spaces/SpacesPage.tsx apps/web/src/features/boxes/BoxesPage.tsx
git commit -m "feat: scope venue data to the active account"
```

## Task 7: 实现邀请链接、认证恢复和分享弹窗

**Files:**

- Create: `apps/web/src/features/venues/venue-invite-session.ts`
- Create: `apps/web/src/features/venues/venue-invite-session.test.ts`
- Create: `apps/web/src/features/venues/JoinVenuePage.tsx`
- Create: `apps/web/src/features/venues/JoinVenuePage.test.tsx`
- Create: `apps/web/src/features/venues/VenueInviteDialog.tsx`
- Create: `apps/web/src/features/venues/VenueInviteDialog.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/router.test.tsx`
- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/features/auth/LoginPage.test.tsx`
- Modify: `apps/web/src/features/auth/RegisterPage.tsx`
- Modify: `apps/web/src/features/auth/RegisterPage.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/src/i18n/messages.test.ts`

**Interfaces:**

- Consumes: Task 6 invite API。
- Produces: `/join/venue` 路由、24 小时单次邀请的 QR/复制/分享 UI 和登录/注册返回。

- [ ] **Step 1: 写 fragment/session/auth RED 测试**

断言 `readInviteToken()` 从 `location.hash` 读取 token 后立即 `history.replaceState` 清除 fragment，并只写 `sessionStorage['nomo-pending-venue-invite']`；`clearInviteToken()` 清理。不得调用 localStorage。

Login/Register 测试用 `location.state.returnTo='/join/venue'`，成功后回到该路由；`//evil.test`、`https://evil.test` 仍回 `/app`。注册需把 returnTo 继续传给“已有账号，登录”链接及有 session 的直接成功分支。

- [ ] **Step 2: 写 JoinVenuePage 和邀请弹窗 RED 测试**

Join 页覆盖 active 未登录、active 已登录接受、expired、used、revoked、full、already member、owner、missing；接受成功清 token、失效 `['venues', 'venue-access']` 并 navigate `/app`。

弹窗覆盖 QR 图片、24 小时/单次说明、copy、`navigator.share`、无 share 时回退 copy、busy 禁用、owner 撤销、Escape、焦点圈定/恢复、移动安全区。

- [ ] **Step 3: 运行 RED**

Run: `npm test -- --run src/features/venues/venue-invite-session.test.ts src/features/venues/JoinVenuePage.test.tsx src/features/venues/VenueInviteDialog.test.tsx src/features/auth/LoginPage.test.tsx src/features/auth/RegisterPage.test.tsx src/app/router.test.tsx`

Expected: 新模块/路由不存在。

- [ ] **Step 4: 实现 token 暂存和安全 returnTo**

抽取共享 `safeReturnTo(value)` 或在 Login/Register 使用同一严格逻辑：只接受单 `/` 开头且非 `//`。Join 页的登录/注册链接使用 state：

```tsx
<Link to="/login" state={{ returnTo: '/join/venue' }}>{t('venueSharing.signIn')}</Link>
<Link to="/register" state={{ returnTo: '/join/venue' }}>{t('venueSharing.register')}</Link>
```

原 token 留在当前标签页 sessionStorage，认证成功返回后继续 inspect/accept。

- [ ] **Step 5: 实现 JoinVenuePage 状态机**

路由放在 RequireAuth 外部。页面读取 token → inspect；未登录显示场所/所有者/权限摘要与登录注册；已登录显示接受按钮。错误码映射到独立中英文状态，不把 invalid token 与场所内容混合显示。接受 mutation 只在 active+session 时启用。

- [ ] **Step 6: 实现 VenueInviteDialog 和 QR**

使用现有 `qrcode`：

```ts
const inviteUrl = `${publicAppOrigin().replace(/\/+$/, '')}/join/venue#token=${token}`
const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
  errorCorrectionLevel: 'M', margin: 2, width: 1024,
})
```

copy/share 只在显式用户动作时使用 raw URL；组件关闭后父级清除 token，不写 React Query 持久缓存。所有文案进入 `venueSharing` i18n 树。

- [ ] **Step 7: 运行 GREEN、无障碍回归并提交**

Run: `npm test -- --run src/features/venues/venue-invite-session.test.ts src/features/venues/JoinVenuePage.test.tsx src/features/venues/VenueInviteDialog.test.tsx src/features/auth/LoginPage.test.tsx src/features/auth/RegisterPage.test.tsx src/app/router.test.tsx src/i18n/messages.test.ts`

Expected: 全绿。

Run: `npm run typecheck && npm run lint`

Expected: 通过。

```bash
git add apps/web/src/features/venues/venue-invite-session.ts apps/web/src/features/venues/venue-invite-session.test.ts apps/web/src/features/venues/JoinVenuePage.tsx apps/web/src/features/venues/JoinVenuePage.test.tsx apps/web/src/features/venues/VenueInviteDialog.tsx apps/web/src/features/venues/VenueInviteDialog.test.tsx apps/web/src/app/router.tsx apps/web/src/app/router.test.tsx apps/web/src/features/auth/LoginPage.tsx apps/web/src/features/auth/LoginPage.test.tsx apps/web/src/features/auth/RegisterPage.tsx apps/web/src/features/auth/RegisterPage.test.tsx apps/web/src/i18n/messages.ts apps/web/src/i18n/messages.test.ts
git commit -m "feat: add single-use venue invitations"
```

## Task 8: 实现场所成员管理与共享场所入口

**Files:**

- Create: `apps/web/src/features/venues/VenueMembersPage.tsx`
- Create: `apps/web/src/features/venues/VenueMembersPage.test.tsx`
- Modify: `apps/web/src/features/venues/VenuesPage.tsx`
- Modify: `apps/web/src/features/venues/VenuesPage.test.tsx`
- Modify: `apps/web/src/features/venues/VenueSwitcher.tsx`
- Modify: `apps/web/src/features/venues/VenueSwitcher.test.tsx`
- Modify: `apps/web/src/components/AppIcon.tsx`
- Modify: `apps/web/src/components/AppIcon.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/router.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/src/i18n/messages.test.ts`

**Interfaces:**

- Consumes: Tasks 6–7 API/邀请弹窗。
- Produces: `/app/venues/:venueId/members`、owner/member 管理体验、共享场所标识。

- [ ] **Step 1: 写成员页和场所入口 RED 测试**

owner 场景：显示 `3 / 5`、owner/member 头像昵称加入时间、创建邀请、未使用邀请及撤销、移除成员确认；不显示“退出场所”。member 场景：显示列表和“退出场所”，不显示邀请/移除/账单/删除入口。移除/退出成功后失效 `venues, venue-members, venue-access, venue-activity, spaces, boxes, items, search-items`；member 退出后导航到 `/app`。

VenuesPage/Switcher 断言 member 场所显示“家庭共享”和 owner 名，member 点击场所不打开编辑弹窗而进入成员页；owner 保持编辑能力并有家庭成员入口。

- [ ] **Step 2: 运行 RED**

Run: `npm test -- --run src/features/venues/VenueMembersPage.test.tsx src/features/venues/VenuesPage.test.tsx src/features/venues/VenueSwitcher.test.tsx src/components/AppIcon.test.tsx src/app/router.test.tsx`

Expected: 成员页/图标/路由不存在，共享角色未显示。

- [ ] **Step 3: 增加图标和路由**

在 AppIconName 增加 `family|history|share|copy`，每个图标提供 24×24 stroke path 并由现有 test 确认无 unknown name。本任务只增加已经实现的成员页路由：

```tsx
{ path: 'venues/:venueId/members', element: <VenueMembersPage /> },
```

activity 路由在 Task 10 与 VenueActivityPage 同一提交加入，任何中间提交都不能引用尚不存在的组件。

- [ ] **Step 4: 实现 VenueMembersPage**

并行查询 `getVenueAccessSummary`、`listVenueMembers`；owner 额外查询 `listVenueInvites`。Invite 按钮创建 token 后立即打开 VenueInviteDialog。移除和退出使用 ConfirmDialog，文案明确“不删除对方创建的数据/历史记录”。成员头像 URL 用 `<img referrerPolicy="no-referrer">`，无头像显示昵称首字符。

检测 `venue_access_denied` 时移除场所缓存并 replace 到 `/app`，不反复重试已撤权请求。

- [ ] **Step 5: 更新 VenuesPage 和 VenueSwitcher**

VenueSummary role=member 时禁用 VenueEditorDialog 路径，卡片提供家庭成员页入口；owner 卡片保留编辑并增加家庭成员入口。Switcher 每条显示 `role==='member'` 的 badge 和 owner_display_name，aria-label 同时包含共享状态。“最近活动”入口与可用路由在 Task 10 同一提交加入，Task 8 不产生悬空链接。

- [ ] **Step 6: 运行 GREEN、类型与 lint 并提交**

Run: `npm test -- --run src/features/venues/VenueMembersPage.test.tsx src/features/venues/VenuesPage.test.tsx src/features/venues/VenueSwitcher.test.tsx src/components/AppIcon.test.tsx src/app/router.test.tsx src/i18n/messages.test.ts`

Expected: 全绿。

Run: `npm run typecheck && npm run lint`

Expected: 通过。

```bash
git add apps/web/src/features/venues/VenueMembersPage.tsx apps/web/src/features/venues/VenueMembersPage.test.tsx apps/web/src/features/venues/VenuesPage.tsx apps/web/src/features/venues/VenuesPage.test.tsx apps/web/src/features/venues/VenueSwitcher.tsx apps/web/src/features/venues/VenueSwitcher.test.tsx apps/web/src/components/AppIcon.tsx apps/web/src/components/AppIcon.test.tsx apps/web/src/app/router.tsx apps/web/src/app/router.test.tsx apps/web/src/i18n/messages.ts apps/web/src/i18n/messages.test.ts
git commit -m "feat: add venue family management"
```

## Task 9: 让现有收纳 UI 使用数据库能力摘要

**Files:**

- Modify: `apps/web/src/features/spaces/spaces.api.ts`
- Modify: `apps/web/src/features/spaces/spaces.api.test.ts`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`
- Modify: `apps/web/src/features/boxes/boxes.api.ts`
- Modify: `apps/web/src/features/boxes/boxes.api.test.ts`
- Modify: `apps/web/src/features/boxes/box-entitlements.api.ts`
- Modify: `apps/web/src/features/boxes/box-entitlements.api.test.ts`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/BoxForm.test.tsx`
- Modify: `apps/web/src/features/boxes/CreateBoxModal.tsx`
- Modify: `apps/web/src/features/boxes/CreateBoxModal.test.tsx`
- Modify: `apps/web/src/features/boxes/EditBoxModal.tsx`
- Modify: `apps/web/src/features/boxes/EditBoxModal.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/src/i18n/messages.test.ts`

**Interfaces:**

- Consumes: Tasks 2–4 DB RPC、Task 6 `VenueAccessSummary`。
- Produces: 成员可用的空间/箱子/物品/AI UI，危险操作严格 owner-only。

- [ ] **Step 1: 写 API RED 测试**

spaces.api 断言 create/update/layout 调用 `create_space/update_space/save_space_layout` 且不发送 owner_id；update 发送表单 `venue_id`，DB 仅允许 owner 跨场所重挂。boxes.api 断言 `listBoxes/listBoxesForVenue` 调用 `list_accessible_boxes`，因此不会因 public-read policy 混入其他账号公开箱子；登录用户详情先读取 RLS 授权的 box+venue_id，再回退 public RPC；`updateBox` 调用 `update_box`。box plan API 调用 `get_venue_box_plan_summary({p_venue_id})`。

- [ ] **Step 2: 写 capability UI RED 测试**

SpacesPage member：可创建/编辑/调整布局，不显示删除，编辑时 venue selector 固定当前场所；owner 保留在自己场所间移动 space 的既有能力。BoxesPage member：可创建，owner plan full 时显示“请联系场所所有者解锁”，不显示 HK$38 购买按钮；owner 仍显示现有 paywall。PublicBoxPage member：可新增/编辑/删除/移动物品、编辑 box 普通字段、使用自己的 Credits 开 packing；不显示删除箱子、visibility、账单。outsider/public visitor 只保留公开读取。

增加 stale removal：页面 mutation 收到 `venue_access_denied` 时保留未提交表单内容、清场所缓存并引导返回，不把错误误判为普通网络失败。

- [ ] **Step 3: 运行 RED**

Run: `npm test -- --run src/features/spaces/spaces.api.test.ts src/features/spaces/SpacesPage.test.tsx src/features/boxes/boxes.api.test.ts src/features/boxes/box-entitlements.api.test.ts src/features/boxes/BoxesPage.test.tsx src/features/boxes/PublicBoxPage.test.tsx src/features/boxes/BoxForm.test.tsx src/features/boxes/CreateBoxModal.test.tsx src/features/boxes/EditBoxModal.test.tsx`

Expected: 现有 owner 过滤和 `isOwner` UI gate 导致 member 用例失败。

- [ ] **Step 4: 切换空间/箱子 API**

spaces API 用新 RPC；listSpaces 继续直接 select，由 RLS 返回 accessible rows。boxes 列表切换到 `list_accessible_boxes`，有 selected venue 时传 UUID，无 filter 时传 null；`getBoxByPublicId` 对 authenticated 先执行 RLS direct query并选择 `spaces(venue_id,name,venues(name))`，无可访问行再调用 `get_public_box`；PublicBox 增加 `venue_id?: string`。

`updateBox` 改为：

```ts
await supabase.rpc('update_box', {
  p_box_id: boxId,
  p_space_id: input.space_id,
  p_name: input.name,
  p_category: input.category,
  p_location: input.location,
  p_description: input.description,
  p_visibility: input.visibility,
})
```

- [ ] **Step 5: 用能力摘要替换 isOwner 推断**

BoxesPage 以 selectedVenueId 查询 `getVenueAccessSummary` 和 `getVenueBoxPlanSummary`。owner/member 都可创建；只有 `role==='owner'` 可进入购买。member 的 box_limit_reached 显示联系 owner，保留创建表单。

PublicBoxPage 在有 session+venue_id 时查询能力，定义：

```ts
const canEditContent = access?.role === 'owner' || access?.role === 'member'
const canDeleteBox = access?.can_delete_box ?? false
const canChangeVisibility = access?.can_change_box_visibility ?? false
const canUseAi = access?.can_use_ai ?? false
```

能力查询设置 `retry:false`；authenticated outsider 阅读公开箱子时，`venue_access_denied` 只表示无编辑能力，不能让公开详情进入错误态。物品 CRUD/movement 使用 canEditContent；packing 使用 canUseAi；box 删除/visibility 分别使用能力字段。BoxForm/CreateBoxModal/EditBoxModal 接收 `canChangeVisibility`，false 时不渲染 visibility control；新箱固定提交 private，编辑箱提交旧 visibility。

- [ ] **Step 6: 统一撤权错误处理和查询失效**

在 venue-sharing API 导出 `isVenueAccessDenied(error)`；spaces/boxes/items UI mutation 遇到该错误时移除当前 venue 数据并导航安全页。现有 items API 原样透传 Supabase 错误，不增加第二套错误映射。所有成功写入失效 `venues, venue-access, spaces, boxes, box, items, search-items, item-movements, venue-activity, box-plan` 中相关 keys。

- [ ] **Step 7: 运行 GREEN 和现有回归**

Run: `npm test -- --run src/features/spaces/spaces.api.test.ts src/features/spaces/SpacesPage.test.tsx src/features/boxes/boxes.api.test.ts src/features/boxes/box-entitlements.api.test.ts src/features/boxes/BoxesPage.test.tsx src/features/boxes/PublicBoxPage.test.tsx src/features/boxes/BoxForm.test.tsx src/features/boxes/CreateBoxModal.test.tsx src/features/boxes/EditBoxModal.test.tsx src/features/items/ItemForm.test.tsx src/features/item-movements/ItemMovementSheet.test.tsx src/features/packing/PackingCapturePage.test.tsx src/i18n/messages.test.ts`

Expected: 新 member 用例和既有 owner/public 用例全绿。

Run: `npm run typecheck && npm run lint`

Expected: 通过。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/spaces/spaces.api.ts apps/web/src/features/spaces/spaces.api.test.ts apps/web/src/features/spaces/SpacesPage.tsx apps/web/src/features/spaces/SpacesPage.test.tsx apps/web/src/features/boxes/boxes.api.ts apps/web/src/features/boxes/boxes.api.test.ts apps/web/src/features/boxes/box-entitlements.api.ts apps/web/src/features/boxes/box-entitlements.api.test.ts apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx apps/web/src/features/boxes/BoxForm.tsx apps/web/src/features/boxes/BoxForm.test.tsx apps/web/src/features/boxes/CreateBoxModal.tsx apps/web/src/features/boxes/CreateBoxModal.test.tsx apps/web/src/features/boxes/EditBoxModal.tsx apps/web/src/features/boxes/EditBoxModal.test.tsx apps/web/src/i18n/messages.ts apps/web/src/i18n/messages.test.ts
git commit -m "feat: enable shared venue inventory workflows"
```

## Task 10: 实现场所最近活动页面

**Files:**

- Create: `apps/web/src/features/venues/venue-activity.api.ts`
- Create: `apps/web/src/features/venues/venue-activity.api.test.ts`
- Create: `apps/web/src/features/venues/VenueActivityPage.tsx`
- Create: `apps/web/src/features/venues/VenueActivityPage.test.tsx`
- Modify: `apps/web/src/features/venues/VenueMembersPage.tsx`
- Modify: `apps/web/src/features/venues/VenueMembersPage.test.tsx`
- Modify: `apps/web/src/features/venues/VenuesPage.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/router.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/src/i18n/messages.test.ts`

**Interfaces:**

- Consumes: Task 5 `list_venue_activity`、Task 6 member API。
- Produces: `/app/venues/:venueId/activity` 最近活动、筛选和 cursor pagination。

- [ ] **Step 1: 写 API/UI RED 测试**

API 断言首请求 limit 50、filter null、cursor null；下一页把最后一行 created_at/id 传为 `p_before_*`。页面断言五类中英文句子、按成员/动作筛选、已离开 badge、空/加载/刷新错误、加载更多后不重复。`venue_access_denied` 立即离开页面。

- [ ] **Step 2: 运行 RED**

Run: `npm test -- --run src/features/venues/venue-activity.api.test.ts src/features/venues/VenueActivityPage.test.tsx src/features/venues/VenueMembersPage.test.tsx src/app/router.test.tsx`

Expected: 模块和路由不存在。

- [ ] **Step 3: 实现活动 API 和格式化函数**

导出 `VenueActivityEvent`、`VenueActivityEntry`、`VenueActivityCursor` 和：

```ts
listVenueActivity(input: {
  venueId: string
  actorId?: string | null
  eventCode?: VenueActivityEvent | null
  cursor?: VenueActivityCursor | null
}): Promise<VenueActivityEntry[]>
```

增加纯函数 `activityMessage(entry, t)`，只从白名单 snapshot 字段取值；缺少快照名称时使用 i18n “已删除的物品/箱子”，不渲染原始 JSON。

- [ ] **Step 4: 实现页面、筛选和分页**

页面并行读取成员供 filter 使用，用 `useInfiniteQuery` 的 pageParam 传 cursor，初始 50 条。成员选择值为 user UUID，动作选择值为五个 enum；改变 filter 重置页。每行 `<time dateTime>`，离开成员展示 snapshot 名称和“已离开”。

- [ ] **Step 5: 增加入口、路由和缓存刷新**

成员页和场所卡片增加“最近活动”链接；router 增加 activity route。物品/箱子成功 mutation 已在 Task 9 失效 `['venue-activity', venueId]`，本任务用同一 key 前缀。

- [ ] **Step 6: 运行 GREEN 并提交**

Run: `npm test -- --run src/features/venues/venue-activity.api.test.ts src/features/venues/VenueActivityPage.test.tsx src/features/venues/VenueMembersPage.test.tsx src/features/venues/VenuesPage.test.tsx src/app/router.test.tsx src/i18n/messages.test.ts`

Expected: 全绿。

Run: `npm run typecheck && npm run lint`

Expected: 通过。

```bash
git add apps/web/src/features/venues/venue-activity.api.ts apps/web/src/features/venues/venue-activity.api.test.ts apps/web/src/features/venues/VenueActivityPage.tsx apps/web/src/features/venues/VenueActivityPage.test.tsx apps/web/src/features/venues/VenueMembersPage.tsx apps/web/src/features/venues/VenueMembersPage.test.tsx apps/web/src/features/venues/VenuesPage.tsx apps/web/src/app/router.tsx apps/web/src/app/router.test.tsx apps/web/src/i18n/messages.ts apps/web/src/i18n/messages.test.ts
git commit -m "feat: show shared venue activity"
```

## Task 11: 完成真实并发、E2E、法律与发布验收

**Files:**

- Modify: `apps/web/e2e/mock-backend.ts`
- Create: `apps/web/e2e/venue-family-sharing.spec.ts`
- Create: `scripts/test-venue-sharing-concurrency.mjs`
- Modify: `package.json`
- Modify: `apps/web/src/content/legal/privacy.zh-CN.md`
- Modify: `apps/web/src/content/legal/privacy.en-US.md`
- Modify: `apps/web/src/content/legal/terms.zh-CN.md`
- Modify: `apps/web/src/content/legal/terms.en-US.md`
- Modify: `apps/web/src/features/legal/legal-policy.ts`
- Modify: `apps/web/src/features/legal/LegalDocumentPage.test.tsx`
- Modify: `docs/runbooks/deployment.md`

**Interfaces:**

- Consumes: Tasks 1–10 完整功能。
- Produces: 多账号浏览器验收、真实本地 DB 并发证据、法律披露和可操作部署/回滚手册。

- [ ] **Step 1: 扩展 E2E mock 并先写失败流程**

MockState 增加 `members, invites, activity`，每个 Playwright Page 保留独立 currentUserId，共享同一 state。实现所有新 RPC route，明确拒绝 direct venue_members/venue_invites 写入和 member 危险操作。

新 spec 使用 owner/member 两个 browser context 覆盖：owner 创建场所/空间/物品和 invite；member 注册后从 fragment 接受；共享场所在 switcher 出现；member 通过与 scanner parser 相同的箱子二维码 URL 进入详情、搜索、移动物品、创建第 3 个箱子；第 4 个被 owner quota 拒绝且无购买按钮；member 用自己的 Credits 发起 packing；owner 活动页看到 actor/来源/目标；member 不能删除 box/space/venue；owner 移除后 member 下一请求被拒绝并跳转。摄像头解码继续由现有 ScannerPage 单元/E2E 回归负责，本 spec 不伪造相机硬件。

- [ ] **Step 2: 运行 E2E RED**

Run: `npx playwright test e2e/venue-family-sharing.spec.ts --project=desktop-chromium`

Expected: mock/页面缺口导致流程失败；记录首个真实失败，不放宽断言。

- [ ] **Step 3: 实现真实两会话并发脚本**

脚本读取 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，只接受 URL host 为 `127.0.0.1`/`localhost`，否则立即退出，避免误操作远程。用 admin API 建 owner+5 member fixtures：先顺序加入 3 位成员；当只剩 1 个席位时，断言第二条 outstanding invite 无法创建；随后让两个账号对最后一条有效邀请执行 `Promise.allSettled`，断言仅一个 `joined`、另一个 `venue_invite_used`，最终总人数 5。该组合同时验证“有效邀请不超过席位”和接受时的原子人数检查；`finally` 删除 fixture users。

新增脚本：

```json
"test:venue-sharing-concurrency": "node scripts/test-venue-sharing-concurrency.mjs"
```

脚本失败输出稳定场景名和 RPC error code，不打印 raw token。

- [ ] **Step 4: 更新法律文本与版本测试**

隐私中英文明确：同一场所成员可看到展示名/头像、共享内容和操作快照；退出后历史展示名快照保留；邀请链接持有人可查看加入前最小场所信息。条款明确：所有者负责发放/撤销邀请；成员可删除物品但不能删除箱子/空间/场所；所有者箱子额度与成员本人 AI Credits 分离。`LEGAL_POLICY_VERSION='2026-08-09'`，测试断言中英文都有这些精确边界且 key 同步。

- [ ] **Step 5: 写部署、监控和向前回滚手册**

部署顺序固定：

```text
202608090001 → 002 → 003 → 004 → 005
→ npm run test:db
→ Web frontend
→ internal invite smoke test
→ enable family invite entry
```

手册提供 SQL：场所成员数 >4、有效邀请超过剩余席位、关键活动 actor 缺失、membership owner duplication、private membership audit 最近变更、最近 access-denied/error 聚合。列出 Test Mode：过期/撤销/复用、最后席位只能保有一条邀请且并发只加入一人、成员 3/4 箱、member Credits、撤权旧标签、跨场所隐私、R2 猜 key。回滚只关闭邀请入口/用向前迁移收紧新增共享写，保留全部表和数据。

- [ ] **Step 6: 运行 focused E2E 和并发 GREEN**

Run: `npx playwright test e2e/venue-family-sharing.spec.ts`

Expected: desktop Chromium、iPhone、Pixel 项目全部通过；只允许项目配置声明的条件 skip。

Run: `npm run test:venue-sharing-concurrency`

Expected: `last-seat-reservation: second invite rejected`、`last-seat-race: 1 joined, 1 venue_invite_used`，退出码 0。

- [ ] **Step 7: 运行完整发布验证**

Run: `npm run test:db`

Expected: 001–023 全绿。

Run: `npm test -- --run`

Expected: 全部 Vitest 通过，0 failed。

Run: `npm run test:worker && npm run typecheck:worker && npm run typecheck:billing`

Expected: Edge/worker 测试与类型检查通过。

Run: `npm run lint && npm run typecheck && npm run build`

Expected: lint 0 errors、TypeScript 0 errors、production build exit 0。

Run: `npm run test:e2e`

Expected: 全部可运行 Playwright specs 通过，只有明确的 project-conditional skips。

Run: `git diff --check`

Expected: 无 whitespace errors。

- [ ] **Step 8: Commit**

```bash
git add apps/web/e2e/mock-backend.ts apps/web/e2e/venue-family-sharing.spec.ts scripts/test-venue-sharing-concurrency.mjs package.json apps/web/src/content/legal/privacy.zh-CN.md apps/web/src/content/legal/privacy.en-US.md apps/web/src/content/legal/terms.zh-CN.md apps/web/src/content/legal/terms.en-US.md apps/web/src/features/legal/legal-policy.ts apps/web/src/features/legal/LegalDocumentPage.test.tsx docs/runbooks/deployment.md
git commit -m "test: verify venue family sharing release"
```

## 最终完成定义

- owner 邀请、member 加入、共享 CRUD、活动、退出/移除形成完整闭环；
- DB 是成员数、权限、箱子配额和 Credits 主体的最终权威；
- member 无法通过 REST、旧页面或猜 object key 绕过危险操作；
- 并发测试证明席位和单次 token 不会被突破；
- 移除成员后服务端即时拒绝，客户端不会跨账号展示缓存；
- 五类关键事件具备 actor、快照、筛选和离开标识；
- owner/public/AI Credits/箱子权益/packing 既有测试无回归；
- 部署、监控、法律和向前回滚步骤可以由未参与开发的工程师独立执行。
