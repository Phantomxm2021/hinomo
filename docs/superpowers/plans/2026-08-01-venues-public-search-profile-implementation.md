# 场地、公开访问、移动搜索与“我的”实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复公开箱子匿名访问和移动搜索，为空间增加场地归属与平面图缩放，并提供移动端“我的”页面。

**Architecture:** 数据库通过两个可独立执行的迁移增加最小公开读取 RPC 与 `venues` 层级；前端按功能拆分 API、表单和展示组件，并以 React Query 统一缓存。公开读取不扩大 `spaces` 的匿名权限；场地由 RLS 隔离，空间只允许关联当前用户的场地。

**Tech Stack:** PostgreSQL / Supabase RLS 与 RPC、React 19、TypeScript 6、React Router、TanStack Query、React Hook Form、Zod、Tailwind CSS 4、Vitest、Testing Library、Playwright。

---

## 文件结构

- `supabase/migrations/202608010001_public_box_rpc.sql`：公开箱子的最小安全读取接口。
- `supabase/migrations/202608010002_venues.sql`：场地表、空间外键、回填、RLS、搜索返回值。
- `supabase/tests/database/009_public_box_rpc.test.sql`：公开/私密箱子匿名读取边界。
- `supabase/tests/database/010_venues.test.sql`：场地回填、归属及 RLS。
- `apps/web/src/features/venues/venues.api.ts`：场地 CRUD 与部署状态错误映射。
- `apps/web/src/features/venues/venue.schema.ts`：场地表单校验。
- `apps/web/src/features/venues/VenueFilterBar.tsx`：场地 chips 与新增入口。
- `apps/web/src/features/venues/VenueEditorDialog.tsx`：创建、编辑和删除场地。
- `apps/web/src/features/spaces/SpaceEditorDialog.tsx`：空间表单及场地选择；从过大的页面组件中抽离。
- `apps/web/src/features/profile/useAccountProfile.ts`：桌面菜单与移动页面共享的资料/头像/语言状态。
- `apps/web/src/features/profile/AccountAvatar.tsx`：共享头像展示与可更换控件。
- `apps/web/src/features/profile/MyPage.tsx`：移动端“我的”。
- 修改既有 API、页面、类型、测试和 E2E mock，以贯通 `venue_name`。

### Task 1：公开箱子安全 RPC

**Files:**
- Create: `supabase/migrations/202608010001_public_box_rpc.sql`
- Create: `supabase/tests/database/009_public_box_rpc.test.sql`

- [ ] **Step 1: 写失败的数据库契约测试**

测试以事务创建 owner、空间、公开箱子、私密箱子和物品，切换为 `anon` 后断言：

```sql
select plan(5);
select has_function('public', 'get_public_box', array['uuid']);
set local role anon;
select is((select count(*) from public.get_public_box(:'public_id')), 1::bigint, 'anon reads public box');
select is((select count(*) from public.get_public_box(:'private_id')), 0::bigint, 'private box is hidden');
select is((select count(*) from public.get_public_box(gen_random_uuid())), 0::bigint, 'missing box is hidden');
select throws_ok('select * from public.spaces', '42501', null, 'anon cannot enumerate spaces');
select * from finish();
```

- [ ] **Step 2: 运行数据库测试并确认缺少函数**

Run: `npm run test:db`

Expected: `009_public_box_rpc.test.sql` FAIL，错误包含 `function public.get_public_box(uuid) does not exist`。

- [ ] **Step 3: 实现固定返回类型的 security-definer RPC**

迁移定义单行 JSON 结构，函数体显式校验公开状态，不授予表级匿名权限：

```sql
create or replace function public.get_public_box(p_public_id uuid)
returns table (
  id uuid, owner_id uuid, public_id uuid, box_code text, space_id uuid,
  name text, category text, location text, description text,
  visibility public.box_visibility, cover_object_key text,
  updated_at timestamptz, space_name text, items jsonb
)
language sql stable security definer
set search_path = pg_catalog
as $$
  select b.id, b.owner_id, b.public_id, b.box_code, b.space_id,
    b.name, b.category, b.location, b.description, b.visibility,
    b.cover_object_key, b.updated_at, s.name,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'name', i.name, 'category', i.category,
      'quantity', i.quantity, 'description', i.description,
      'image_object_key', i.image_object_key
    ) order by i.created_at) filter (where i.id is not null), '[]'::jsonb)
  from public.boxes b
  join public.spaces s on s.id = b.space_id
  left join public.items i on i.box_id = b.id
  where b.public_id = p_public_id and b.visibility = 'public'::public.box_visibility
  group by b.id, s.name;
$$;
revoke all on function public.get_public_box(uuid) from public;
grant execute on function public.get_public_box(uuid) to anon, authenticated;
```

- [ ] **Step 4: 运行 SQL 语法和数据库测试**

Run: `npm run test:db`

Expected: database tests PASS；私密和不存在均返回零行，`anon` 仍不能读取 `spaces`。

- [ ] **Step 5: 提交迁移与测试**

```bash
git add supabase/migrations/202608010001_public_box_rpc.sql supabase/tests/database/009_public_box_rpc.test.sql
git commit -m "fix: expose public boxes through safe rpc"
```

### Task 2：前端公开箱子改用 RPC

**Files:**
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`
- Modify: `apps/web/src/features/boxes/boxes.api.ts`
- Modify: `apps/web/src/features/boxes/boxes.api.test.ts`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Modify: `apps/web/e2e/mock-backend.ts`
- Modify: `apps/web/e2e/privacy.spec.ts`

- [ ] **Step 1: 写 RPC 映射和匿名公开页失败测试**

```ts
it('loads a public box through get_public_box', async () => {
  rpcMock.mockResolvedValue({ data: [{ ...publicBoxRow, items: [itemRow] }], error: null })
  await expect(getBoxByPublicId(publicBoxRow.public_id)).resolves.toMatchObject({
    id: publicBoxRow.id, space_name: '卧室', items: [itemRow],
  })
  expect(rpcMock).toHaveBeenCalledWith('get_public_box', { p_public_id: publicBoxRow.public_id })
})

it('falls back to the owner query for the signed-in owners private box', async () => {
  rpcMock.mockResolvedValue({ data: [], error: null })
  sessionMock.mockResolvedValue(ownerSession)
  ownerQueryMock.mockResolvedValue({ data: privateOwnerRow, error: null })
  await expect(getBoxByPublicId(privateOwnerRow.public_id)).resolves.toMatchObject({ visibility: 'private' })
})
```

E2E mock 新增 `/rest/v1/rpc/get_public_box`，并在退出登录后直接访问公开 URL；私密 URL 仍显示“无权限或内容不存在”。

- [ ] **Step 2: 运行定向测试确认仍在查询 boxes 嵌套 spaces**

Run: `npm test -- apps/web/src/features/boxes/boxes.api.test.ts apps/web/src/features/boxes/PublicBoxPage.test.tsx`

Expected: FAIL，mock 记录到 `.from('boxes')` 而非 `get_public_box`。

- [ ] **Step 3: 增加 RPC 类型并改写 API 映射**

```ts
export async function getBoxByPublicId(publicId: string): Promise<PublicBox | null> {
  const { data, error } = await supabase.rpc('get_public_box', { p_public_id: publicId })
  if (error) throw error
  const row = data?.[0]
  if (row) return mapPublicBoxRpcRow(row)
  const { data: sessionData } = await supabase.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) return null
  return getOwnedBoxByPublicId(publicId, ownerId)
}
```

`getOwnedBoxByPublicId` 使用原来的嵌套 `spaces(name)` 查询，但同时约束 `.eq('owner_id', ownerId)`；因此只有登录 owner 的私密箱子走该路径。匿名和其他登录用户不会因此获得私密数据。公开箱子 owner 仍由 RPC 返回 `owner_id` 来启用编辑控件。

在 `Database['public']['Functions']` 中加入与迁移完全一致的 `Args` 和 `Returns`，`items` 使用 `Json`，类型测试断言 `p_public_id` 为 `string`。

- [ ] **Step 4: 运行 API、页面和隐私 E2E**

Run: `npm test -- apps/web/src/features/boxes/boxes.api.test.ts apps/web/src/features/boxes/PublicBoxPage.test.tsx apps/web/src/lib/database.types.test-d.ts`

Expected: PASS。

Run: `npm run test:e2e -- --grep "public|private"`

Expected: owner 退出后仍能打开公开箱子，私密箱子保持不可见。

- [ ] **Step 5: 提交前端公开读取修复**

```bash
git add apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts apps/web/src/features/boxes/boxes.api.ts apps/web/src/features/boxes/boxes.api.test.ts apps/web/src/features/boxes/PublicBoxPage.test.tsx apps/web/e2e/mock-backend.ts apps/web/e2e/privacy.spec.ts
git commit -m "fix: load public box without space table access"
```

### Task 3：移动搜索明确触发

**Files:**
- Modify: `apps/web/src/components/GlobalFindBar.tsx`
- Modify: `apps/web/src/components/GlobalFindBar.test.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.test.tsx`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: 写按钮、Enter、空白和输入法组合测试**

```ts
it('submits a trimmed mobile query from the visible button', async () => {
  renderAtApp(<GlobalFindBar />)
  await user.type(screen.getByRole('searchbox', { name: '搜索物品或箱子' }), '  相机  ')
  await user.click(screen.getByRole('button', { name: '搜索' }))
  expect(mockNavigate).toHaveBeenCalledWith('/app/search?q=%E7%9B%B8%E6%9C%BA')
})
```

SearchPage 测试 `compositionStart` 后推进 250ms 不请求，`compositionEnd` 后请求并更新 `?q=`；空白提交不请求。

- [ ] **Step 2: 运行搜索组件测试并确认缺少显式按钮/表单**

Run: `npm test -- apps/web/src/components/GlobalFindBar.test.tsx apps/web/src/features/search/SearchPage.test.tsx`

Expected: FAIL，找不到“搜索”按钮或 SearchPage 的 `role="search"`。

- [ ] **Step 3: 实现移动按钮、键盘语义和 composition 安全**

首页表单在输入框右侧加入：

```tsx
<input name="q" enterKeyHint="search" autoComplete="off" type="search" ... />
<button className="grid size-12 shrink-0 place-items-center rounded-control bg-brand text-white lg:hidden"
  type="submit" aria-label="搜索"><AppIcon name="search" /></button>
```

SearchPage 用 `<form role="search" onSubmit={submit}>` 包裹输入，使用 `isComposingRef`：composition 期间 effect 直接返回；结束时同步输入，再由现有 250ms debounce 更新 URL 和请求。

- [ ] **Step 4: 运行组件测试和移动 E2E**

Run: `npm test -- apps/web/src/components/GlobalFindBar.test.tsx apps/web/src/features/search/SearchPage.test.tsx`

Expected: PASS。

Run: `npm run test:e2e -- --grep "mobile search"`

Expected: 390px 视口点击按钮和按 Enter 均进入结果页并显示匹配箱子/物品。

- [ ] **Step 5: 提交搜索修复**

```bash
git add apps/web/src/components/GlobalFindBar.tsx apps/web/src/components/GlobalFindBar.test.tsx apps/web/src/features/search/SearchPage.tsx apps/web/src/features/search/SearchPage.test.tsx apps/web/e2e/core-flow.spec.ts
git commit -m "fix: make mobile search explicitly actionable"
```

### Task 4：场地数据库层级和默认回填

**Files:**
- Create: `supabase/migrations/202608010002_venues.sql`
- Create: `supabase/tests/database/010_venues.test.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`

- [ ] **Step 1: 写场地回填、唯一性和跨 owner 拒绝测试**

```sql
select plan(7);
select has_table('public', 'venues');
select col_is_not_null('public', 'spaces', 'venue_id');
select is((select count(*) from public.venues where owner_id = :'owner_id' and name = '家里'), 1::bigint, 'default venue backfilled once');
select throws_ok($$ insert into public.spaces(owner_id, venue_id, name) values (:'owner_id', :'other_venue_id', '越权空间') $$, '42501');
select throws_ok($$ insert into public.venues(owner_id, name) values (:'owner_id', '家里') $$, '23505');
select throws_ok($$ delete from public.venues where id = :'default_venue_id' $$, '23503');
select ok((select count(*) = 0 from public.venues where owner_id <> auth.uid()), 'RLS hides other owners');
```

- [ ] **Step 2: 运行数据库测试并确认 venues 不存在**

Run: `npm run test:db`

Expected: FAIL，`relation public.venues does not exist`。

- [ ] **Step 3: 编写可重复执行的场地迁移**

关键约束和回填：

```sql
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index venues_owner_name_unique on public.venues(owner_id, lower(btrim(name)));
insert into public.venues(owner_id, name)
select distinct owner_id, '家里' from public.spaces
on conflict do nothing;
alter table public.spaces add column venue_id uuid references public.venues(id) on delete restrict;
update public.spaces s set venue_id = v.id from public.venues v
where v.owner_id = s.owner_id and lower(btrim(v.name)) = lower('家里') and s.venue_id is null;
alter table public.spaces alter column venue_id set not null;
```

RLS 为 owner CRUD；spaces insert/update policy 增加 `exists venues where venues.id = venue_id and venues.owner_id = auth.uid()`。`search_my_items` 用 drop/create 增加 `venue_name` 返回列。迁移同时 drop/recreate `get_public_box(uuid)`，在 `space_name` 后增加 `venue_name` 并 join `venues`；随后重新执行 `revoke/grant`，保证公开箱子详情也能显示完整路径。

- [ ] **Step 4: 更新生成式数据库类型契约**

`venues` 增加 Row/Insert/Update/Relationships；`spaces.Row/Insert/Update` 增加 `venue_id: string`；`search_my_items.Returns` 增加 `venue_name: string`。类型测试构造合法 venue 和 space insert，并用 `@ts-expect-error` 拒绝缺少 `venue_id`。

- [ ] **Step 5: 运行数据库和类型测试**

Run: `npm run test:db && npm run typecheck`

Expected: PASS；重复应用迁移测试不会创建第二个“家里”。

- [ ] **Step 6: 提交场地 schema**

```bash
git add supabase/migrations/202608010002_venues.sql supabase/tests/database/010_venues.test.sql apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts
git commit -m "feat: add owner-scoped venues"
```

### Task 5：场地 API、校验和部署提示

**Files:**
- Create: `apps/web/src/features/venues/venue.schema.ts`
- Create: `apps/web/src/features/venues/venues.api.ts`
- Create: `apps/web/src/features/venues/venues.api.test.ts`
- Modify: `apps/web/src/features/spaces/space.schema.ts`
- Modify: `apps/web/src/features/spaces/spaces.api.ts`
- Modify: `apps/web/src/features/spaces/spaces.api.test.ts`

- [ ] **Step 1: 写 CRUD、映射和缺迁移错误测试**

```ts
it('maps missing venues schema to a deployment error', async () => {
  fromMock.mockReturnValue(postgrestError({ code: 'PGRST205' }))
  await expect(listVenues()).rejects.toMatchObject({ code: 'VENUES_SCHEMA_UNAVAILABLE' })
})

it('creates a space in the selected venue', async () => {
  await createSpace({ venue_id: 'venue-home', name: '卧室', description: null })
  expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ venue_id: 'venue-home' }))
})
```

- [ ] **Step 2: 运行 API 测试确认模块/字段缺失**

Run: `npm test -- apps/web/src/features/venues/venues.api.test.ts apps/web/src/features/spaces/spaces.api.test.ts`

Expected: FAIL，`venues.api` 不存在且 `SpaceInput` 无 `venue_id`。

- [ ] **Step 3: 实现场地 CRUD 和空间关联**

```ts
export type VenueSummary = { id: string; name: string; description: string | null; space_count: number }
export type VenueInput = { name: string; description: string | null }
export const VENUES_SCHEMA_UNAVAILABLE = 'VENUES_SCHEMA_UNAVAILABLE'

export async function listVenues(): Promise<VenueSummary[]> {
  const { data, error } = await supabase.from('venues').select('id, name, description, spaces(count)').order('name')
  if (error) throw mapVenueSchemaError(error)
  return (data ?? []).map(v => ({ ...v, space_count: v.spaces[0]?.count ?? 0 }))
}
```

`createVenue/updateVenue/deleteVenue` 复用 session owner 模式；`venueSchema` 与空间相同限制。`SpaceSummary` 和 `SpaceInput` 增加 `venue_id/venue_name`，`listSpaces` 选择 `venues(name)`。

- [ ] **Step 4: 运行 API 和 schema 测试**

Run: `npm test -- apps/web/src/features/venues/venues.api.test.ts apps/web/src/features/spaces/spaces.api.test.ts`

Expected: PASS，缺表/缺列错误均映射为可识别部署提示。

- [ ] **Step 5: 提交数据访问层**

```bash
git add apps/web/src/features/venues apps/web/src/features/spaces/space.schema.ts apps/web/src/features/spaces/spaces.api.ts apps/web/src/features/spaces/spaces.api.test.ts
git commit -m "feat: add venue data access"
```

### Task 6：场地与空间管理 UI

**Files:**
- Create: `apps/web/src/features/venues/VenueFilterBar.tsx`
- Create: `apps/web/src/features/venues/VenueFilterBar.test.tsx`
- Create: `apps/web/src/features/venues/VenueEditorDialog.tsx`
- Create: `apps/web/src/features/venues/VenueEditorDialog.test.tsx`
- Create: `apps/web/src/features/spaces/SpaceEditorDialog.tsx`
- Create: `apps/web/src/features/spaces/SpaceEditorDialog.test.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`
- Modify: `apps/web/src/features/spaces/SpaceCard.tsx`

- [ ] **Step 1: 写场地筛选、创建、迁移空间和禁止删除测试**

```ts
it('filters spaces by venue and defaults new spaces to that venue', async () => {
  renderSpacesPage({ venues: [home, office], spaces: [bedroom, meetingRoom] })
  await user.click(screen.getByRole('button', { name: '公司，1 个空间' }))
  expect(screen.getByRole('heading', { name: '会议室' })).toBeVisible()
  expect(screen.queryByRole('heading', { name: '卧室' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('场地')).toHaveValue(office.id)
})
```

另测：编辑空间选择“家里”后 update 含 `venue_id`；非空场地删除显示“请先移动或删除其中的 N 个空间”；Schema 未部署时显示运行迁移的明确提示和重试。

- [ ] **Step 2: 运行 UI 测试确认场地控件不存在**

Run: `npm test -- apps/web/src/features/venues apps/web/src/features/spaces/SpacesPage.test.tsx`

Expected: FAIL，找不到“全部”“家里”“公司”和场地选择框。

- [ ] **Step 3: 实现场地过滤条和两个可访问编辑器**

`VenueFilterBar` 接口固定为：

```ts
type Props = {
  venues: VenueSummary[]; selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void; onEdit: (venue: VenueSummary) => void
}
```

chips 横向滚动且按钮触控面积至少 44px；“全部”传 `null`。`VenueEditorDialog` 延续现有 portal、focus trap、Escape 和返回焦点语义。`SpaceEditorDialog` 表单字段为 `venue_id/name/description`，create 默认值来自 `selectedVenueId ?? venues[0]?.id`。

- [ ] **Step 4: 精简 SpacesPage 为查询、筛选和 mutation 编排**

```ts
const visibleSpaces = selectedVenueId
  ? spaces.filter(space => space.venue_id === selectedVenueId)
  : spaces
```

标题改为“场地与空间”；场地和空间都可创建/编辑。卡片显示 `venue_name`，平面视图只接收 `visibleSpaces`。所有初次加载使用现有 `SkeletonGroup`，缓存刷新失败保留旧数据和重试按钮。

- [ ] **Step 5: 运行 UI 测试、类型检查和 320px 溢出测试**

Run: `npm test -- apps/web/src/features/venues apps/web/src/features/spaces && npm run typecheck`

Expected: PASS。

Run: `npm run test:e2e -- --grep "venue"`

Expected: 创建“公司”→创建“会议室”→切换 chip 后只显示会议室；320px 无横向页面溢出。

- [ ] **Step 6: 提交场地与空间 UI**

```bash
git add apps/web/src/features/venues apps/web/src/features/spaces apps/web/e2e/core-flow.spec.ts apps/web/e2e/mock-backend.ts
git commit -m "feat: manage venues and assigned spaces"
```

### Task 7：全局位置补充场地名称

**Files:**
- Modify: `apps/web/src/features/boxes/boxes.api.ts`
- Modify: `apps/web/src/features/boxes/boxes.api.test.ts`
- Modify: `apps/web/src/features/boxes/BoxCatalogueCard.tsx`
- Modify: `apps/web/src/features/boxes/BoxCatalogueCard.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxDetailPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxDetailPage.test.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.test.tsx`
- Modify: `apps/web/src/features/qr-print/print-model.ts`
- Modify: `apps/web/src/features/qr-print/print-model.test.ts`

- [ ] **Step 1: 写“场地 · 空间 · 位置”显示测试**

```ts
expect(screen.getByText('公司 · 会议室 · 文件柜')).toBeVisible()
```

API 测试要求 listBoxes 选择 `spaces(name, venues(name))` 并映射 `venue_name`；search RPC 返回结果带 `venue_name`；打印模型的位置副标题保持相同顺序。

- [ ] **Step 2: 运行箱子、搜索和打印定向测试确认缺字段**

Run: `npm test -- apps/web/src/features/boxes apps/web/src/features/search apps/web/src/features/qr-print/print-model.test.ts`

Expected: FAIL，`venue_name` 未定义或页面只显示空间和位置。

- [ ] **Step 3: 扩展 summary 类型和统一位置格式函数**

在 `boxes.api.ts` 的 `BoxSummary` 加 `venue_name: string`。新增纯函数：

```ts
export function formatStoragePath(parts: Array<string | null | undefined>) {
  return parts.map(part => part?.trim()).filter(Boolean).join(' · ')
}
```

箱子卡、详情、搜索和打印均调用该函数；没有位置时不产生多余分隔符。

- [ ] **Step 4: 运行定向测试和类型检查**

Run: `npm test -- apps/web/src/features/boxes apps/web/src/features/search apps/web/src/features/qr-print && npm run typecheck`

Expected: PASS；同名空间可凭场地区分。

- [ ] **Step 5: 提交全局位置展示**

```bash
git add apps/web/src/features/boxes apps/web/src/features/search apps/web/src/features/qr-print
git commit -m "feat: show venue in storage paths"
```

### Task 8：平面图拖拽缩放

**Files:**
- Modify: `apps/web/src/features/spaces/SpaceMap.tsx`
- Modify: `apps/web/src/features/spaces/SpaceMap.test.tsx`
- Modify: `apps/web/src/features/spaces/space-layout.ts`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: 写缩放边界、释放保存、Escape 和键盘测试**

```ts
it('resizes from the handle and persists only on pointer release', async () => {
  const onLayoutChange = vi.fn()
  renderMap({ editMode: true, onLayoutChange })
  const handle = screen.getByRole('button', { name: '调整卧室大小' })
  fireEvent.pointerDown(handle, { pointerId: 7, clientX: 200, clientY: 120 })
  fireEvent.pointerMove(handle, { pointerId: 7, clientX: 240, clientY: 160 })
  expect(onLayoutChange).not.toHaveBeenCalled()
  fireEvent.pointerUp(handle, { pointerId: 7 })
  expect(onLayoutChange).toHaveBeenCalledTimes(1)
})
```

补充：宽高 clamp 到 20–60/10–50；右/下边界不越界；Escape 恢复；ArrowRight/Down 每次 +2；触摸手柄不启动 Link 移动；保存失败保留当前宽高并出现“重试保存布局”，点击后以 mutation variables 重试相同位置。

- [ ] **Step 2: 运行 SpaceMap 测试并确认缩放手柄不存在**

Run: `npm test -- apps/web/src/features/spaces/SpaceMap.test.tsx apps/web/src/features/spaces/SpacesPage.test.tsx`

Expected: FAIL，找不到“调整卧室大小”。

- [ ] **Step 3: 抽出纯布局约束并增加 resize 状态**

```ts
export const constrainResize = (start: SpacePosition, dx: number, dy: number): SpacePosition => ({
  ...start,
  width: clampToGrid(start.width + dx, 20, Math.min(60, 100 - start.x)),
  height: clampToGrid(start.height + dy, 10, Math.min(50, 100 - start.y)),
})
```

`SpaceMap` 使用互斥 union：

```ts
type Interaction =
  | { kind: 'move'; id: string; startX: number; startY: number; initial: SpacePosition; canvasWidth: number; canvasHeight: number }
  | { kind: 'resize'; id: string; startX: number; startY: number; initial: SpacePosition; canvasWidth: number; canvasHeight: number }
  | null
```

卡片右下角渲染 `type="button"` 手柄，pointer down 调用 `preventDefault/stopPropagation/setPointerCapture`；move 只更新本地；up 保存一次；cancel/Escape 恢复 initial。

- [ ] **Step 4: 运行单测和浏览器拖拽/触摸 E2E**

Run: `npm test -- apps/web/src/features/spaces/SpaceMap.test.tsx apps/web/src/features/spaces/SpacesPage.test.tsx`

Expected: PASS。

Run: `npm run test:e2e -- --grep "resize space"`

Expected: 鼠标和触摸路径均改变宽高、没有浏览器链接拖拽图像，POST `space_layouts` 只在释放后发生。

- [ ] **Step 5: 提交平面图缩放**

```bash
git add apps/web/src/features/spaces/SpaceMap.tsx apps/web/src/features/spaces/SpaceMap.test.tsx apps/web/src/features/spaces/space-layout.ts apps/web/src/features/spaces/SpacesPage.test.tsx apps/web/e2e/core-flow.spec.ts
git commit -m "feat: resize spaces on the floor plan"
```

### Task 9：共享账户逻辑与移动端“我的”

**Files:**
- Create: `apps/web/src/features/profile/useAccountProfile.ts`
- Create: `apps/web/src/features/profile/useAccountProfile.test.tsx`
- Create: `apps/web/src/features/profile/AccountAvatar.tsx`
- Create: `apps/web/src/features/profile/AccountAvatar.test.tsx`
- Create: `apps/web/src/features/profile/MyPage.tsx`
- Create: `apps/web/src/features/profile/MyPage.test.tsx`
- Modify: `apps/web/src/features/profile/UserAccountMenu.tsx`
- Modify: `apps/web/src/features/profile/UserAccountMenu.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/e2e/mock-backend.ts`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: 写“我的”导航、Skeleton、头像、语言和退出测试**

```ts
it('replaces mobile search with My and keeps five tabs', () => {
  renderAppShell()
  const nav = screen.getByRole('navigation', { name: '移动端主导航' })
  expect(within(nav).getAllByRole('link')).toHaveLength(5)
  expect(within(nav).getByRole('link', { name: '我的' })).toHaveAttribute('href', '/app/me')
  expect(within(nav).queryByRole('link', { name: '搜索' })).not.toBeInTheDocument()
})
```

MyPage 测试首屏 Skeleton；资料成功后昵称/邮箱只读；选择头像触发共享 upload mutation；语言保存成功提示；退出确认后调用 `supabase.auth.signOut()`。

- [ ] **Step 2: 运行 profile/router 测试确认路由和页面缺失**

Run: `npm test -- apps/web/src/features/profile apps/web/src/app/AppShell.test.tsx apps/web/src/app/App.test.tsx`

Expected: FAIL，`/app/me` 与“我的”链接不存在。

- [ ] **Step 3: 抽取共享 hook 和头像组件**

```ts
export function useAccountProfile() {
  const { session } = useAuth()
  const user = session?.user
  const profileQuery = useQuery({ queryKey: ['profile', user?.id], queryFn: () => getProfile(user!.id), enabled: Boolean(user) })
  const avatarQuery = useQuery({ queryKey: ['profile-avatar', user?.id, profileQuery.data?.avatar_object_key], queryFn: getAvatarDownload, enabled: Boolean(profileQuery.data?.avatar_object_key) })
  return { user, profileQuery, avatarQuery, avatarMutation, localeMutation, signOut }
}
```

`AccountAvatar` 支持 `size="sm" | "lg"` 和可选 file input，接受 JPEG/PNG/WebP；继续调用现有 `uploadAvatar`，不复制压缩参数。

- [ ] **Step 4: 实现 MyPage 并改造桌面菜单复用共享状态**

MyPage 区块为资料、语言设置、退出；首屏使用结构化 Skeleton。缓存数据刷新失败时继续显示旧值和重试。昵称来源顺序保持 profile display_name → auth metadata → 邮箱前缀；邮箱只读。退出使用 `ConfirmDialog`。

路由加入 `{ path: 'me', element: <MyPage /> }`；mobileNavigation 最后一项改为 `{ to: '/app/me', label: '我的', icon: 'user' }`，桌面 navigation 不变。

- [ ] **Step 5: 运行组件、路由和移动 E2E**

Run: `npm test -- apps/web/src/features/profile apps/web/src/app/AppShell.test.tsx apps/web/src/app/App.test.tsx && npm run typecheck`

Expected: PASS。

Run: `npm run test:e2e -- --grep "My tab"`

Expected: 390px 视口能打开“我的”、看到资料、保存语言并退出；底栏仍为五项且无“搜索”。

- [ ] **Step 6: 提交移动账户页**

```bash
git add apps/web/src/features/profile apps/web/src/app/router.tsx apps/web/src/app/AppShell.tsx apps/web/src/app/AppShell.test.tsx apps/web/src/app/App.test.tsx apps/web/e2e/mock-backend.ts apps/web/e2e/core-flow.spec.ts
git commit -m "feat: add mobile account tab"
```

### Task 10：全量验证、SQL 交付说明与视觉验收

**Files:**
- Modify: `docs/runbooks/deployment.md`
- Modify: `docs/superpowers/plans/2026-08-01-venues-public-search-profile-implementation.md`

- [ ] **Step 1: 补充用户执行迁移的顺序和验证查询**

部署文档明确依次执行：

```text
202608010001_public_box_rpc.sql
202608010002_venues.sql
```

并提供只读验证查询：`select proname from pg_proc where proname = 'get_public_box';`、`select count(*) from public.venues;`、`select count(*) from public.spaces where venue_id is null;`。不要记录或展示 Vault/R2 secrets。

- [ ] **Step 2: 运行全量静态和单元验证**

Run: `npm test -- --run && npm run typecheck && npm run lint && npm run build`

Expected: 所有 Vitest 测试 PASS；TypeScript、oxlint 和 Vite build exit 0。

- [ ] **Step 3: 运行全量 E2E**

Run: `npm run test:e2e`

Expected: 全部非环境依赖用例 PASS；已有明确标记的环境用例可保持 skip，无新增失败。

- [ ] **Step 4: 执行多视口浏览器验收**

在 320×568、360×800、390×844、768×1024、1024×768、1440×900 检查：场地 chips、空间卡片/平面图、移动搜索、“我的”和桌面侧栏。每个视口断言 `document.documentElement.scrollWidth <= document.documentElement.clientWidth`，底栏不遮挡最后一项内容。

- [ ] **Step 5: 检查差异、迁移安全与计划完成状态**

Run: `git diff --check && git status --short`

Expected: 无 whitespace error；只有本任务预期文件。逐项核对本计划 checkbox，SQL 文件中无真实 secret，公开 RPC 无公开列表能力。

- [ ] **Step 6: 提交文档并准备代码审查**

```bash
git add docs/runbooks/deployment.md docs/superpowers/plans/2026-08-01-venues-public-search-profile-implementation.md
git commit -m "docs: add venue migration rollout"
```
