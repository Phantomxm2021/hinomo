# Dashboard Space Filter and Search Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一空间术语，为所有用户提供内置“默认”场地，让首页按场地切换全部数据，并让搜索页与首页使用相同的搜索框设计。

**Architecture:** 数据库新增不可变的 `venues.is_default` 标记与注册触发器，前端 API 固定把默认场地排在第一位。首页在已经加载的 `spaces` 与 `boxes` 上按所选场地过滤，不增加 RPC；首页和搜索页共享一个无业务状态的 `SearchInputShell` 视觉组件。

**Tech Stack:** PostgreSQL/Supabase SQL、React 19、TanStack Query、React Router、TypeScript、Tailwind CSS 4、Vitest、Testing Library、Playwright。

---

## 文件结构

- `supabase/migrations/202608010003_default_venue.sql`：默认场地列、回填、注册触发器和不可变 RLS。
- `apps/web/src/lib/database.types.ts`：`venues.is_default` 类型。
- `apps/web/src/features/venues/venues.api.ts`：默认场地映射与固定排序。
- `apps/web/src/features/venues/VenueFilterBar.tsx`、`VenueEditorDialog.tsx`：默认场地只读保护。
- `apps/web/src/features/dashboard/DashboardPage.tsx`：场地下拉框和派生过滤数据。
- `apps/web/src/components/SearchInputShell.tsx`：首页与搜索页共享视觉外壳。
- `apps/web/src/components/GlobalFindBar.tsx`、`apps/web/src/features/search/SearchPage.tsx`：复用共享搜索外壳。
- 相关 `.test.tsx`、API 测试和 `apps/web/e2e/`：行为回归。

### Task 1：默认场地数据库契约与 API 排序

**Files:**
- Create: `supabase/migrations/202608010003_default_venue.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/lib/database.types.test-d.ts`
- Modify: `apps/web/src/features/venues/venues.api.ts`
- Modify: `apps/web/src/features/venues/venues.api.test.ts`

- [ ] **Step 1: 写失败的 API 排序和类型测试**

在 `venues.api.test.ts` 增加返回“默认、公司、家里”的测试，断言查询先调用：

```ts
expect(mockOrder).toHaveBeenNthCalledWith(1, 'is_default', { ascending: false })
expect(mockOrder).toHaveBeenNthCalledWith(2, 'name')
expect(result[0]).toMatchObject({ name: '默认', is_default: true })
```

在类型测试中断言 `Database['public']['Tables']['venues']['Row']['is_default']` 为 `boolean`。

- [ ] **Step 2: 运行测试确认失败**

Run（`apps/web`）：`npm test -- src/features/venues/venues.api.test.ts src/lib/database.types.test-d.ts --run`

Expected: FAIL，查询尚未选择/排序 `is_default`。

- [ ] **Step 3: 编写默认场地迁移**

迁移包含：

```sql
alter table public.venues add column is_default boolean not null default false;
create unique index venues_one_default_per_owner on public.venues(owner_id) where is_default;

insert into public.venues(owner_id, name, is_default)
select users.id, '默认', true from auth.users as users
on conflict (owner_id) where is_default do nothing;

create function public.create_default_venue_for_user() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into public.venues(owner_id, name, is_default) values (new.id, '默认', true)
  on conflict (owner_id) where is_default do nothing;
  return new;
end;
$$;

create trigger auth_user_create_default_venue
after insert on auth.users for each row execute function public.create_default_venue_for_user();
```

重新创建 venue insert/update/delete policy：客户端不能插入 `is_default = true`，也不能修改或删除 `is_default = true` 的行。文件末尾执行 `notify pgrst, 'reload schema';`。只生成 SQL，不连接真实数据库。

- [ ] **Step 4: 更新类型和 API**

`VenueSummary` 增加 `is_default: boolean`；查询选择 `is_default` 并链式排序：

```ts
.select('id, name, description, is_default, spaces(count)')
.order('is_default', { ascending: false })
.order('name')
```

- [ ] **Step 5: 运行 API、类型、lint 测试并提交**

Run（`apps/web`）：`npm test -- src/features/venues src/lib/database.types.test-d.ts --run && npm run typecheck && npm run lint`

Expected: PASS。

Commit: `feat: add built-in default venue`

### Task 2：默认场地只读与空间术语统一

**Files:**
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpaceMap.tsx`
- Modify: `apps/web/src/features/spaces/SpaceMap.test.tsx`
- Modify: `apps/web/src/features/venues/VenueFilterBar.tsx`
- Modify: `apps/web/src/features/venues/VenueEditorDialog.tsx`
- Modify: `apps/web/src/features/venues/VenueEditorDialog.test.tsx`

- [ ] **Step 1: 写失败的术语与默认场地保护测试**

断言：

```ts
expect(screen.getByText('空间总览')).toBeInTheDocument()
expect(screen.getByRole('region', { name: '按空间查看' })).toBeInTheDocument()
expect(mobileNavLinks).toContainEqual(expect.objectContaining({ name: '空间' }))
expect(screen.queryByText('家庭总览')).not.toBeInTheDocument()
expect(screen.queryByText('按房间查看')).not.toBeInTheDocument()
```

默认场地编辑按钮不渲染；直接把默认场地传给编辑器时，保存和删除按钮均不可用并显示“默认场地不可修改或删除”。

- [ ] **Step 2: 运行测试确认旧文案和可编辑行为失败**

Run（`apps/web`）：`npm test -- src/app/AppShell.test.tsx src/features/dashboard/DashboardPage.test.tsx src/features/spaces src/features/venues --run`

Expected: FAIL，仍出现“家庭总览”“按房间查看”“场地与空间”，且默认场地可编辑。

- [ ] **Step 3: 最小替换用户可见术语**

- `家庭总览` → `空间总览`
- `正在加载家庭总览` → `正在加载空间总览`
- `按房间查看` → `按空间查看`
- 空状态的“所在房间” → “所在空间”
- 导航 `场地与空间`、`场地` → `空间`
- SpacesPage 一级标题 `场地与空间` → `空间`
- SpaceMap `家庭平面总览` → `空间平面总览`
- 布局提示 `拖动房间卡片` → `拖动空间卡片`

创建、编辑、筛选实体时保留“场地”名称。

- [ ] **Step 4: 禁止默认场地进入编辑流程**

`VenueFilterBar` 对 `is_default` 不渲染编辑按钮；`VenueEditorDialog` 对默认场地禁用提交和删除，作为前端第二层保护。

- [ ] **Step 5: 运行测试并提交**

Run（`apps/web`）：`npm test -- src/app/AppShell.test.tsx src/features/dashboard/DashboardPage.test.tsx src/features/spaces src/features/venues --run`

Expected: PASS。

Commit: `refactor: unify space terminology`

### Task 3：首页场地下拉筛选

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/e2e/mock-backend.ts`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: 写失败的首页联动测试**

构造默认和公司两个场地、各一个空间与箱子。初始断言只显示默认场地数据；切换到公司后断言：

```ts
await user.selectOptions(screen.getByLabelText('选择场地'), 'venue-office')
expect(within(screen.getByLabelText('空间统计')).getByText('1')).toBeInTheDocument()
expect(screen.getByRole('link', { name: /会议室/ })).toBeInTheDocument()
expect(screen.queryByRole('link', { name: /卧室/ })).not.toBeInTheDocument()
expect(screen.getByRole('link', { name: /摄影器材/ })).toBeInTheDocument()
expect(screen.queryByRole('link', { name: /冬季衣物/ })).not.toBeInTheDocument()
```

同时验证箱子统计和物品总数随之变化。

- [ ] **Step 2: 运行首页测试确认没有下拉框**

Run（`apps/web`）：`npm test -- src/features/dashboard/DashboardPage.test.tsx --run`

Expected: FAIL，找不到“选择场地”。

- [ ] **Step 3: 实现派生过滤数据**

首页新增 `listVenues` 查询，并使用：

```ts
const activeVenueId = selectedVenueId ?? venues[0]?.id ?? null
const visibleSpaces = activeVenueId
  ? spaces.filter((space) => space.venue_id === activeVenueId)
  : []
const visibleSpaceIds = new Set(visibleSpaces.map((space) => space.id))
const visibleBoxes = boxes.filter((box) => visibleSpaceIds.has(box.space_id))
```

所有统计、空间卡片、最近箱子和空状态只读取 `visibleSpaces/visibleBoxes`。下拉框使用 `value={activeVenueId ?? ''}`，桌面位于标题右上角，移动端在标题下全宽。

- [ ] **Step 4: 更新 HTTP mock 和移动/桌面 E2E**

mock venue 返回 `is_default`；新增首页切换测试，断言 URL 不变、数据变化且无横向溢出。

- [ ] **Step 5: 运行首页与 E2E 并提交**

Run（`apps/web`）：`npm test -- src/features/dashboard/DashboardPage.test.tsx --run`

Run（仓库根目录）：`npm run test:e2e -- --grep "dashboard venue"`

Expected: desktop、iPhone、Pixel PASS（桌面/移动条件 skip 除外）。

Commit: `feat: filter dashboard by venue`

### Task 4：共享首页基准搜索外壳

**Files:**
- Create: `apps/web/src/components/SearchInputShell.tsx`
- Create: `apps/web/src/components/SearchInputShell.test.tsx`
- Modify: `apps/web/src/components/GlobalFindBar.tsx`
- Modify: `apps/web/src/components/GlobalFindBar.test.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.test.tsx`

- [ ] **Step 1: 写失败的共享样式测试**

共享组件测试断言外壳包含首页基准类：

```ts
expect(shell).toHaveClass('min-h-12', 'rounded-control', 'border-line', 'bg-surface')
expect(input).toHaveClass('h-11', 'text-body', 'focus-visible:outline-none')
```

SearchPage 测试断言搜索框位于该共享外壳内，不再使用 `min-h-14`、`text-lg` 或独立绝对定位图标。

- [ ] **Step 2: 运行搜索测试确认失败**

Run（`apps/web`）：`npm test -- src/components/GlobalFindBar.test.tsx src/components/SearchInputShell.test.tsx src/features/search/SearchPage.test.tsx --run`

Expected: FAIL，`SearchInputShell` 不存在。

- [ ] **Step 3: 创建无状态视觉组件并复用**

`SearchInputShell` 接收标准 input props，通过 `forwardRef` 传递输入引用；组件只渲染图标、统一外壳和 input。GlobalFindBar 保留移动搜索按钮与桌面扫码按钮；SearchPage 在共享外壳右侧保留提交按钮。

- [ ] **Step 4: 保持搜索业务行为不变**

SearchPage 继续使用现有 `input`、`query`、250ms debounce、composition start/end、URL `q` 同步和空白提交逻辑；只替换标记与样式。

- [ ] **Step 5: 运行搜索测试并提交**

Run（`apps/web`）：`npm test -- src/components src/features/search --run && npm run typecheck && npm run lint`

Expected: PASS。

Commit: `refactor: share dashboard search styling`

### Task 5：部署说明与全量验证

**Files:**
- Modify: `docs/runbooks/deployment.md`
- Modify: `docs/superpowers/plans/2026-08-01-dashboard-space-filter-search-alignment.md`

- [ ] **Step 1: 补充手动 SQL 顺序**

部署文档在既有两个迁移后增加 `202608010003_default_venue.sql`，并提供只读验证：

```sql
select owner_id, count(*) from public.venues where is_default group by owner_id having count(*) <> 1;
```

预期零行。不得调用 Supabase CLI 或连接真实数据库。

- [ ] **Step 2: 全量静态和单元验证**

Run：`npm test -- --run && npm run typecheck && npm run lint && npm run build`

Expected: exit 0，所有测试通过。

- [ ] **Step 3: 全量浏览器验证**

Run：`npm run test:e2e`

Expected: 所有非条件用例通过；320、360、390、768、1024、1440px 无横向溢出。

- [ ] **Step 4: 审计差异并提交文档**

Run：`git diff --check && git status --short`

Expected: 只有本计划文件；SQL 不含密钥或 destructive data migration。

Commit: `docs: add default venue rollout`
