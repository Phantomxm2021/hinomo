# Nomo Integrated Entry and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every template/placeholder route with a session-aware entry, a useful authenticated dashboard, and a cohesive responsive product shell.

**Architecture:** Add a small `RootEntry` routing component, a `DashboardPage` that aggregates existing spaces and boxes queries, and an `AuthLayout` route wrapper. Keep business APIs and database schema unchanged; integration happens entirely in React Router and shared CSS.

**Tech Stack:** React 19, React Router, TanStack Query, Supabase auth context, Vitest, Testing Library, Playwright, CSS.

---

### Task 1: Session-aware root entry

**Files:**
- Create: `apps/web/src/app/RootEntry.tsx`
- Create: `apps/web/src/app/RootEntry.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

- [ ] **Step 1: Write the failing root routing tests**

Test `RootEntry` with a mocked `useAuth`: loading renders `正在进入 Nomo…`, a null session navigates to `/login`, and a session navigates to `/app`.

```tsx
test('sends an anonymous visitor to login', () => {
  authState = { session: null, loading: false }
  renderEntry()
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test --workspace @nomo/web -- RootEntry --run`

Expected: FAIL because `RootEntry.tsx` does not exist.

- [ ] **Step 3: Implement the minimal entry component**

```tsx
export function RootEntry() {
  const { session, loading } = useAuth()
  if (loading) return <main className="entry-loading"><span className="brand-mark">N</span><p role="status">正在进入 Nomo…</p></main>
  return <Navigate replace to={session ? '/app' : '/login'} />
}
```

Replace the `/` placeholder route with `<RootEntry />`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test --workspace @nomo/web -- RootEntry --run`

Expected: all RootEntry tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/RootEntry.tsx apps/web/src/app/RootEntry.test.tsx apps/web/src/app/router.tsx
git commit -m "feat: route visitors into Nomo"
```

### Task 2: Authenticated dashboard

**Files:**
- Create: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Create: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

- [ ] **Step 1: Write failing aggregation and empty-state tests**

Mock `listSpaces` and `listBoxes`. Assert two spaces, three boxes, one public box and two private boxes are displayed, the first three boxes appear as recent items, and empty data shows `创建第一个箱子`.

```tsx
expect(await screen.findByText('3')).toBeInTheDocument()
expect(screen.getByText('1 个公开 · 2 个私有')).toBeInTheDocument()
expect(screen.getByRole('link', { name: '创建第一个箱子' })).toHaveAttribute('href', '/app/boxes/new')
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test --workspace @nomo/web -- DashboardPage --run`

Expected: FAIL because `DashboardPage.tsx` does not exist.

- [ ] **Step 3: Implement dashboard from existing APIs**

Use independent queries:

```tsx
const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
const boxes = boxesQuery.data ?? []
const publicCount = boxes.filter((box) => box.visibility === 'public').length
```

Render four shortcut links (`/app/boxes/new`, `/app/scan`, `/app/search`, `/app/print`), summary cards, and `boxes.slice(0, 3)`. Keep actions visible during loading or partial query failure.

- [ ] **Step 4: Replace `/app` placeholder and fallback**

```tsx
{ index: true, element: <DashboardPage /> },
{ path: '*', element: <Navigate replace to="/app" /> },
```

- [ ] **Step 5: Verify GREEN and regressions**

Run: `npm test --workspace @nomo/web -- DashboardPage BoxesPage SpacesPage --run`

Expected: dashboard and existing list tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/dashboard apps/web/src/app/router.tsx
git commit -m "feat: add integrated storage dashboard"
```

### Task 3: Unified authentication and application shell

**Files:**
- Create: `apps/web/src/app/AuthLayout.tsx`
- Create: `apps/web/src/app/AuthLayout.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/AppShell.tsx`
- Delete: `apps/web/src/app/RoutePlaceholders.tsx`

- [ ] **Step 1: Write the failing shell test**

Render `AuthLayout` with an outlet and assert the Nomo brand, product statement, and outlet content are visible. Add an AppShell test asserting exactly four mobile navigation destinations: workbench, boxes, search and scan.

```tsx
expect(screen.getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/')
expect(screen.getByText('让每件物品都有迹可循')).toBeInTheDocument()
expect(screen.getByRole('navigation', { name: '移动端主导航' }).querySelectorAll('a')).toHaveLength(4)
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test --workspace @nomo/web -- AuthLayout AppShell --run`

Expected: FAIL because `AuthLayout` and the workbench navigation do not exist.

- [ ] **Step 3: Implement route layout and navigation**

`AuthLayout` renders a brand panel plus `<Outlet />`. Nest login/register/password routes under this layout. Change navigation to:

```ts
const navigation = [
  { to: '/app', label: '工作台', end: true },
  { to: '/app/boxes', label: '箱子' },
  { to: '/app/search', label: '搜索' },
  { to: '/app/scan', label: '扫码' },
]
```

Keep spaces accessible from the dashboard. Delete `RoutePlaceholders.tsx` after confirming no imports remain.

- [ ] **Step 4: Verify GREEN**

Run: `npm test --workspace @nomo/web -- AuthLayout AppShell auth --run`

Expected: shell and existing auth tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app
git commit -m "feat: unify Nomo application shell"
```

### Task 4: Cohesive responsive visual system

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/index.html`

- [ ] **Step 1: Add semantic class assertions before styling**

Extend dashboard/auth tests to assert `dashboard-hero`, `dashboard-stats`, `quick-actions`, and `auth-shell` exist. Run them before editing CSS; they must fail until the class hooks are present.

- [ ] **Step 2: Add the minimal class hooks and verify tests**

Run: `npm test --workspace @nomo/web -- DashboardPage AuthLayout --run`

Expected: PASS after class hooks are added.

- [ ] **Step 3: Replace template-like global styles**

Define warm neutral tokens, accessible focus rings, primary/secondary buttons, auth panels, dashboard stats/actions, desktop sidebar and four-item mobile navigation. Preserve dark mode and add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
}
```

Set `body` min width to 320px and keep bottom safe-area padding. Update page description metadata in `index.html`.

- [ ] **Step 4: Verify build and accessibility**

Run: `npm run lint && npm run typecheck && npm test -- --run && npm run build`

Expected: all commands exit 0; only the known bundle-size warning may remain.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/index.css apps/web/index.html apps/web/src/app apps/web/src/features/dashboard
git commit -m "style: finish responsive Nomo interface"
```

### Task 5: Browser integration acceptance

**Files:**
- Modify: `apps/web/e2e/core-flow.spec.ts`
- Modify: `apps/web/e2e/privacy.spec.ts`

- [ ] **Step 1: Add failing entry/dashboard E2E assertions**

Anonymous root navigation must reach `/login`. After registration, `/app` must show the `收纳工作台` heading and dashboard shortcuts. Existing public/private checks remain unchanged.

```ts
await page.goto('/')
await expect(page).toHaveURL(/\/login$/)
await register(page, 'owner@example.com')
await expect(page.getByRole('heading', { name: '收纳工作台' })).toBeVisible()
```

- [ ] **Step 2: Run Playwright and confirm RED before integration is complete**

Run: `npm run test:e2e`

Expected: new dashboard assertion FAILS on the current placeholder page.

- [ ] **Step 3: Run full acceptance after implementation**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run test:e2e
git diff --check
```

Expected: 51+ unit tests and all desktop/iPhone/Pixel E2E projects PASS; production build contains no placeholder route.

- [ ] **Step 4: Inspect final repository state and commit**

```bash
rg -n "PlaceholderPage|RoutePlaceholders" apps/web/src
git status --short
git add apps/web/e2e
git commit -m "test: verify integrated Nomo entry flow"
```

Expected: `rg` returns no matches; only the user-owned PRD remains untracked after commit.
