# Warm Family UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current generic template UI with the approved warm-family responsive experience while preserving Supabase authorization, public/private visibility, R2 media upload, QR scanning, and PDF generation behavior.

**Architecture:** Keep the existing React Router feature structure and TanStack Query data ownership. Add a small code-native SVG icon primitive and a reusable search/scan control, enrich existing Supabase list queries with nested counts and cover keys, then reshape each page around the approved mobile-first information architecture. Keep all mutations and security rules unchanged; this is a UI and read-model refactor only.

**Tech Stack:** React 19, TypeScript 6, React Router 7, TanStack Query 5, Supabase JS, Vitest + Testing Library, Playwright, Vite, plain CSS, existing R2 media APIs.

---

## File map and responsibilities

- `apps/web/src/components/AppIcon.tsx`: typed, code-native SVG icon set used by navigation, buttons, cards, and statuses.
- `apps/web/src/components/GlobalFindBar.tsx`: reusable search form with desktop scan icon button.
- `apps/web/src/components/PageState.tsx`: consistent loading, empty, error/retry, and offline notices.
- `apps/web/src/app/AppShell.tsx`: desktop sidebar and mobile five-action primary navigation.
- `apps/web/src/features/boxes/boxes.api.ts`: box list read model, including `space_id`, cover key, and item count.
- `apps/web/src/features/spaces/spaces.api.ts`: space list read model, including box and item totals.
- `apps/web/src/features/dashboard/DashboardPage.tsx`: greeting, global find bar, metrics, spaces, and recent boxes.
- `apps/web/src/features/spaces/SpacesPage.tsx`: space cards and modal-style create/edit form.
- `apps/web/src/features/boxes/BoxesPage.tsx`: filterable visual box catalogue.
- `apps/web/src/features/boxes/PublicBoxPage.tsx`: box hero, owner actions, content list, and mobile add action.
- `apps/web/src/features/items/ItemForm.tsx`: compact editor and accessible quantity stepper.
- `apps/web/src/features/search/SearchPage.tsx`: URL-backed search and location-first results.
- `apps/web/src/features/qr-print/PrintPage.tsx`: desktop selection/preview workspace and responsive mobile fallback.
- `apps/web/src/app/AuthLayout.tsx`: warm-family branded authentication shell.
- `apps/web/src/index.css`: tokens, shell, responsive layouts, cards, forms, states, and print workspace.
- Co-located `*.test.tsx`, `visual-system.test.ts`, and `apps/web/e2e/*.spec.ts`: behavior, accessibility, visual contract, and responsive journey coverage.

## Task 1: Enrich the read models without changing the database

**Files:**
- Modify: `apps/web/src/features/boxes/boxes.api.ts`
- Modify: `apps/web/src/features/spaces/spaces.api.ts`
- Create: `apps/web/src/features/boxes/boxes.api.test.ts`
- Create: `apps/web/src/features/spaces/spaces.api.test.ts`

- [ ] **Step 1: Write failing box mapping tests**

Mock the Supabase fluent query and assert `listBoxes()` returns this exact additional shape:

```ts
expect(result[0]).toMatchObject({
  space_id: 'space-1',
  cover_object_key: 'users/u/boxes/b/cover.webp',
  item_count: 3,
})
```

- [ ] **Step 2: Write failing space aggregation tests**

Use a space with two boxes whose nested item counts are 2 and 3, then assert:

```ts
expect(result[0]).toEqual({
  id: 'space-1',
  name: '客厅',
  description: '日常用品',
  box_count: 2,
  item_count: 5,
})
```

- [ ] **Step 3: Run the focused tests and confirm red**

Run: `npm run test -- src/features/boxes/boxes.api.test.ts src/features/spaces/spaces.api.test.ts`

Expected: failures because the current summary types and selectors omit the new fields.

- [ ] **Step 4: Implement the nested selectors and pure mapping**

Extend the types and selectors to these contracts:

```ts
export type BoxSummary = CreatedBox & {
  space_id: string
  location: string | null
  visibility: Database['public']['Enums']['box_visibility']
  space_name: string
  cover_object_key: string | null
  item_count: number
  updated_at: string
}

// listBoxes selector
'.select("id, public_id, box_code, space_id, name, location, visibility, cover_object_key, updated_at, items(count), spaces(name)")'

// mapped fields
space_id: box.space_id,
cover_object_key: box.cover_object_key,
item_count: box.items[0]?.count ?? 0,
updated_at: box.updated_at,
```

Also add `updated_at: string` to `PublicBox`, select it in `getBoxByPublicId`, and map it so the detail hero can display `最近更新` without another request.

Use this space selector and aggregation:

```ts
export type SpaceSummary = {
  id: string
  name: string
  description: string | null
  box_count: number
  item_count: number
}

// listSpaces selector
'.select("id, name, description, boxes(id, items(count))")'

const boxes = space.boxes ?? []
return {
  id: space.id,
  name: space.name,
  description: space.description,
  box_count: boxes.length,
  item_count: boxes.reduce((sum, box) => sum + (box.items[0]?.count ?? 0), 0),
}
```

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm run test -- src/features/boxes/boxes.api.test.ts src/features/spaces/spaces.api.test.ts && npm run typecheck`

Expected: both test files pass and TypeScript reports no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/boxes/boxes.api.ts apps/web/src/features/boxes/boxes.api.test.ts apps/web/src/features/spaces/spaces.api.ts apps/web/src/features/spaces/spaces.api.test.ts
git commit -m "feat: enrich storage overview read models"
```

## Task 2: Build the icon system and responsive application shell

**Files:**
- Create: `apps/web/src/components/AppIcon.tsx`
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Replace the old shell expectations with the approved IA**

Test both navigation regions independently:

```ts
const desktop = screen.getByRole('navigation', { name: '主导航' })
expect(within(desktop).getAllByRole('link').map((link) => link.textContent)).toEqual([
  '今日收纳', '我的空间', '全部箱子', '查找物品', '打印标签',
])
expect(within(desktop).queryByRole('link', { name: '扫码' })).not.toBeInTheDocument()

const mobile = screen.getByRole('navigation', { name: '移动端主导航' })
expect(within(mobile).getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
  '首页', '空间', '扫码', '箱子', '搜索',
])
expect(within(mobile).getByRole('link', { name: '扫码' })).toHaveClass('mobile-scan-action')
```

- [ ] **Step 2: Run the shell test and confirm red**

Run: `npm run test -- src/app/AppShell.test.tsx`

Expected: old four-link navigation does not match the approved order or scan placement.

- [ ] **Step 3: Add a typed SVG primitive**

Implement `AppIcon` with `currentColor`, `aria-hidden="true"`, and these supported names:

```ts
export type AppIconName =
  | 'home' | 'space' | 'scan' | 'box' | 'search'
  | 'print' | 'plus' | 'edit' | 'trash' | 'lock'
  | 'globe' | 'chevron-right' | 'minus' | 'close'

export function AppIcon({ name, size = 20 }: { name: AppIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}
```

Define every path in the local `paths` record; do not use emoji, font icons, or a new dependency.

- [ ] **Step 4: Implement separate desktop and mobile nav models**

Desktop links: 今日收纳 `/app`, 我的空间 `/app/spaces`, 全部箱子 `/app/boxes`, 查找物品 `/app/search`, 打印标签 `/app/print`.

Mobile links: 首页, 空间, elevated scan action, 箱子, 搜索. Each link contains `AppIcon` plus a visible label; the scan link keeps the visible label below the circular button but has no card treatment.

Keep the brand linked to `/app` and add a signed-in household footer text without exposing personal data: `我的收纳空间`.

- [ ] **Step 5: Add shell-only responsive styles**

Use these exact layout rules as the shell contract:

```css
.app-shell { min-height: 100dvh; background: var(--color-canvas); }
.desktop-sidebar { position: fixed; inset: 0 auto 0 0; width: 240px; padding: 32px 24px; }
.app-content { min-width: 0; margin-left: 240px; padding: 40px clamp(28px, 4vw, 64px) 64px; }
.mobile-nav { display: none; }

@media (max-width: 767px) {
  .desktop-sidebar { display: none; }
  .app-content { margin-left: 0; padding: 24px 20px 104px; }
  .mobile-nav { display: grid; grid-template-columns: repeat(5, 1fr); position: fixed; inset: auto 0 0; z-index: 30; }
  .mobile-scan-action { transform: translateY(-18px); }
  .mobile-scan-action .nav-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--color-accent); color: white; box-shadow: var(--shadow-float); }
}
```

- [ ] **Step 6: Verify and commit**

Run: `npm run test -- src/app/AppShell.test.tsx && npm run typecheck`

Expected: shell test and typecheck pass.

```bash
git add apps/web/src/components/AppIcon.tsx apps/web/src/app/AppShell.tsx apps/web/src/app/AppShell.test.tsx apps/web/src/index.css
git commit -m "feat: add responsive family navigation shell"
```

## Task 3: Rebuild the dashboard around finding and recent activity

**Files:**
- Create: `apps/web/src/components/GlobalFindBar.tsx`
- Create: `apps/web/src/components/GlobalFindBar.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Write search/scan control tests**

Render at `/app` and assert:

```ts
await user.type(screen.getByRole('searchbox', { name: '搜索物品或箱子' }), '充电器')
await user.click(screen.getByRole('button', { name: '搜索' }))
expect(screen.getByTestId('location')).toHaveTextContent('/app/search?q=%E5%85%85%E7%94%B5%E5%99%A8')
expect(screen.getByRole('link', { name: '扫码查看' })).toHaveAttribute('title', '扫码查看')
```

- [ ] **Step 2: Write the new dashboard contract test**

Assert the page has `今天找什么？`, three metrics (空间/箱子/物品), `按房间查看`, recent boxes with cover region and item counts, and no `扫码查看` shortcut card.

- [ ] **Step 3: Run focused tests and confirm red**

Run: `npm run test -- src/components/GlobalFindBar.test.tsx src/features/dashboard/DashboardPage.test.tsx`

Expected: missing component and old shortcut-driven dashboard fail.

- [ ] **Step 4: Implement `GlobalFindBar`**

Use a controlled `<form role="search">`; trim the query and navigate to `/app/search?q=<encoded query>`. Place the icon-only scan link after the input:

```tsx
<Link className="scan-icon-button" to="/app/scan" aria-label="扫码查看" title="扫码查看">
  <AppIcon name="scan" size={22} />
</Link>
```

The button is 46px square on desktop and hidden in the dashboard bar below 768px because the elevated bottom action already provides scan access.

- [ ] **Step 5: Implement the approved dashboard hierarchy**

Compute totals only from query results:

```ts
const itemCount = boxes.reduce((sum, box) => sum + box.item_count, 0)
```

Render in order: eyebrow `家庭总览`, heading `早上好，今天找什么？`, `GlobalFindBar`, three metric cards, room/space cards linked to `/app/boxes?space=<id>`, recent box cards linked to public box URLs, and the empty state. Use `AuthorizedImage` when `cover_object_key` is present and a CSS box illustration fallback otherwise.

- [ ] **Step 6: Verify and commit**

Run: `npm run test -- src/components/GlobalFindBar.test.tsx src/features/dashboard/DashboardPage.test.tsx && npm run typecheck`

Expected: focused tests and typecheck pass.

```bash
git add apps/web/src/components/GlobalFindBar.tsx apps/web/src/components/GlobalFindBar.test.tsx apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/dashboard/DashboardPage.test.tsx apps/web/src/index.css
git commit -m "feat: redesign storage dashboard"
```

## Task 4: Turn spaces into a direct-manipulation card page

**Files:**
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add behavior tests for the closed-by-default editor**

Assert `创建空间` is initially an action button rather than a visible form, clicking it opens a dialog-like panel titled `创建空间`, editing opens the same panel titled `编辑空间`, and successful save closes it. Preserve all existing create/update/delete safety tests.

- [ ] **Step 2: Run the test and confirm red**

Run: `npm run test -- src/features/spaces/SpacesPage.test.tsx`

Expected: current permanently visible form fails the interaction contract.

- [ ] **Step 3: Implement the page header and editor state**

Replace `editTarget`-only state with:

```ts
const [editorOpen, setEditorOpen] = useState(false)
const [editTarget, setEditTarget] = useState<SpaceSummary | null>(null)
```

Opening create resets blank values; opening edit resets target values. After a successful mutation call `setEditorOpen(false)`. Render the form in a `.sheet-backdrop` and `.space-editor` with `role="dialog"`, `aria-modal="true"`, labelled title, close button, and existing validation/error messages.

- [ ] **Step 4: Implement visual space cards**

Each card contains a soft-color icon tile, name, optional description, `{box_count} 个箱子 · {item_count} 件物品`, and compact edit/delete icon buttons with complete accessible labels. The whole non-action portion links to `/app/boxes?space=<id>`.

- [ ] **Step 5: Verify and commit**

Run: `npm run test -- src/features/spaces/SpacesPage.test.tsx && npm run typecheck`

Expected: interaction, mutation, and deletion guard tests pass.

```bash
git add apps/web/src/features/spaces/SpacesPage.tsx apps/web/src/features/spaces/SpacesPage.test.tsx apps/web/src/index.css
git commit -m "feat: redesign space management"
```

## Task 5: Build the visual, filterable box catalogue

**Files:**
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add filter and card content tests**

Start the route at `/app/boxes?space=space-1`. Assert only matching boxes render, selecting `全部空间` restores all boxes, cover alt text appears when a cover exists, and each card exposes name, room/location, item count, box code, visibility status, view, edit, and delete actions.

- [ ] **Step 2: Run the test and confirm red**

Run: `npm run test -- src/features/boxes/BoxesPage.test.tsx`

Expected: current page has no URL-backed filter, cover, or item count.

- [ ] **Step 3: Implement URL-backed filtering**

Use `useSearchParams`, derive unique spaces from the returned boxes, and update only the `space` parameter. Keep filtering local:

```ts
const visibleBoxes = selectedSpace
  ? boxes.filter((box) => box.space_id === selectedSpace)
  : boxes
```

Render filter chips with `aria-pressed`; retain `批量打印` and the accent `创建箱子` action.

- [ ] **Step 4: Implement image-forward box cards**

Render `AuthorizedImage` for a cover and a CSS fallback otherwise. Put visibility in a subdued badge using `AppIcon` (`globe` or `lock`), show item count as `{item_count} 件物品`, and keep destructive delete behind the existing confirmation dialog.

- [ ] **Step 5: Verify and commit**

Run: `npm run test -- src/features/boxes/BoxesPage.test.tsx && npm run typecheck`

Expected: focused tests and typecheck pass.

```bash
git add apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/index.css
git commit -m "feat: redesign box catalogue"
```

## Task 6: Redesign box detail and make quantity editing touch-friendly

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Modify: `apps/web/src/features/items/ItemForm.tsx`
- Modify: `apps/web/src/features/items/ItemForm.test.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add quantity stepper tests**

Assert `减少数量` never lowers quantity below 1, `增加数量` increments, direct numeric input still works, and submission receives the final value. Preserve the existing failed-upload retention and retry assertions unchanged.

- [ ] **Step 2: Add detail hierarchy tests**

For the owner, assert cover, breadcrumb-style location, visibility badge, edit, print, item editor trigger, and item rows. For an anonymous public viewer, assert content remains visible but mutation controls do not render. Preserve private-box access behavior.

- [ ] **Step 3: Run both tests and confirm red**

Run: `npm run test -- src/features/items/ItemForm.test.tsx src/features/boxes/PublicBoxPage.test.tsx`

Expected: quantity buttons and approved hierarchy are absent.

- [ ] **Step 4: Implement the stepper through React Hook Form**

Use `watch('quantity')` and `setValue('quantity', next, { shouldDirty: true, shouldValidate: true })`. Buttons are `type="button"`, have 44px hit areas, and contain `AppIcon` minus/plus. Keep the registered numeric input between them and retain all upload/retry logic byte-for-byte except surrounding markup/classes.

- [ ] **Step 5: Implement the box hero and item list**

Render cover and metadata in `.box-hero`; owner actions are compact icon/text buttons. Items become rows on desktop and stacked cards on mobile, each with image, name, category, description, and quantity pill. The owner add form is collapsed behind `添加物品`; on mobile the action remains sticky above the primary nav. Anonymous viewers receive a read-only page with no editor markup.

- [ ] **Step 6: Verify and commit**

Run: `npm run test -- src/features/items/ItemForm.test.tsx src/features/boxes/PublicBoxPage.test.tsx && npm run typecheck`

Expected: behavior, privacy rendering, upload retry, and typecheck all pass.

```bash
git add apps/web/src/features/items/ItemForm.tsx apps/web/src/features/items/ItemForm.test.tsx apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx apps/web/src/index.css
git commit -m "feat: redesign box contents experience"
```

## Task 7: Make search and print task-oriented

**Files:**
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.test.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.test.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add URL search and result-list tests**

Render `/app/search?q=充电器`, assert the input initializes from `q`, the item query runs after debounce, matching boxes are filtered from `listBoxes()`, and each item result announces name/quantity plus `空间 › 箱子 › 位置`. Assert changing the input replaces `q` without losing keyboard focus.

- [ ] **Step 2: Add print workspace tests**

Assert the desktop workspace contains a selectable box list, live `已选择 N 个`, a `标签预览` region for the first selected box, and the existing PDF progress/error behavior. When no box is selected, preview shows a purposeful empty message.

- [ ] **Step 3: Run focused tests and confirm red**

Run: `npm run test -- src/features/search/SearchPage.test.tsx src/features/qr-print/PrintPage.test.tsx`

Expected: URL initialization, path hierarchy, and preview workspace are missing.

- [ ] **Step 4: Implement URL-backed search**

Use `useSearchParams`; initialize from `searchParams.get('q') ?? ''`. The existing 250ms debounce writes the trimmed query back with `setSearchParams(query ? { q: query } : {}, { replace: true })`. Keep the item search RPC and error states unchanged, load `listBoxes()` in parallel, and filter box name/code/space/location case-insensitively. Render `物品` and `箱子` as separate result groups; both use dense rows with a leading icon tile and trailing chevron. Use a stable soft-color item tile because the existing search RPC does not return an image key.

- [ ] **Step 5: Implement the print selection/preview split**

Keep `buildLabels` and `renderLabelsPdf` untouched. Render a two-column `.print-workspace`: left selectable list, right sticky preview with box name, code, destination URL text, and the real QR image produced by `boxQrPng(boxQrUrl(env.VITE_PUBLIC_APP_ORIGIN, selectedBox.public_id))`, labelled `二维码标签预览`. Replace preview state on selection changes and render a safe error state if QR generation fails. For mobile, render a single-box selector and one-label download action rather than the desktop batch workspace; make its primary action sticky above the bottom nav.

- [ ] **Step 6: Verify and commit**

Run: `npm run test -- src/features/search/SearchPage.test.tsx src/features/qr-print/PrintPage.test.tsx && npm run typecheck`

Expected: focused tests and typecheck pass; PDF unit tests remain untouched.

```bash
git add apps/web/src/features/search/SearchPage.tsx apps/web/src/features/search/SearchPage.test.tsx apps/web/src/features/qr-print/PrintPage.tsx apps/web/src/features/qr-print/PrintPage.test.tsx apps/web/src/index.css
git commit -m "feat: redesign search and label printing"
```

## Task 8: Standardize page states and apply the warm-family design system

**Files:**
- Create: `apps/web/src/components/PageState.tsx`
- Create: `apps/web/src/components/PageState.test.tsx`
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: `apps/web/src/app/AuthLayout.tsx`
- Modify: `apps/web/src/app/AuthLayout.test.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Write the shared state contract**

Create tests proving `PageState` renders a lightweight loading skeleton with `role="status"`, an empty-state action, and an error notice whose `重试` button calls the supplied callback. Add an `AppShell` test that dispatches browser `offline`/`online` events and verifies a non-modal `当前离线，部分操作可能不可用` notice appears and clears.

- [ ] **Step 2: Run the state tests and confirm red**

Run: `npm run test -- src/components/PageState.test.tsx src/app/AppShell.test.tsx`

Expected: shared state component and offline notice do not exist.

- [ ] **Step 3: Implement and adopt the shared states**

`PageState` accepts this exact discriminated API:

```ts
type PageStateProps =
  | { state: 'loading'; label: string }
  | { state: 'empty'; title: string; action?: ReactNode }
  | { state: 'error'; message: string; onRetry: () => void }
```

Use `query.refetch()` for retry on dashboard, spaces, boxes, search, and print. Keep mutation errors next to their action instead of routing them through `PageState`. In `AppShell`, initialize with `navigator.onLine`, subscribe to `online` and `offline`, clean up both listeners, and render the notice with `role="status"`. Never include backend URLs, signed query strings, access keys, or raw media errors in UI text.

- [ ] **Step 4: Write the visual token contract**

Assert the stylesheet contains these exact custom properties and safeguards:

```css
--color-canvas: #f8f2e8;
--color-surface: #fffdf8;
--color-sidebar: #f0e3d3;
--color-text: #30271e;
--color-muted: #756a5e;
--color-accent: #df6538;
--color-accent-strong: #c95229;
--color-border: #e3d5c5;
--radius-card: 20px;
--radius-control: 14px;
```

Also assert `:focus-visible`, `@media (prefers-reduced-motion: reduce)`, and `min-height: 44px` touch targets exist.

- [ ] **Step 5: Run visual/auth tests and confirm red**

Run: `npm run test -- src/visual-system.test.ts src/app/AuthLayout.test.tsx`

Expected: current palette and auth presentation do not meet the new contract.

- [ ] **Step 6: Normalize the entire stylesheet**

Organize `index.css` in this order: tokens/reset, typography/links/buttons, auth, application shell, shared page primitives, dashboard, spaces, boxes/detail/items, search/print/scanner, dialogs/states, desktop breakpoint, mobile breakpoint, reduced motion, print media. Remove obsolete shortcut/card selectors rather than leaving conflicting rules.

Use system Chinese font stacks, 1.5+ body line-height, subtle borders, warm shadows, no gradients, no emoji icons, and no color-only status indicators. Ensure every input/button is at least 44px tall and all icon-only controls have visible focus rings.

- [ ] **Step 7: Align auth with the product**

Keep existing route/content semantics but add the N mark, concise benefits list, and warm background. On mobile, collapse the brand panel to logo plus one-sentence promise above the auth form; do not hide the product name or recovery/register links.

- [ ] **Step 8: Verify and commit**

Run: `npm run test -- src/components/PageState.test.tsx src/app/AppShell.test.tsx src/visual-system.test.ts src/app/AuthLayout.test.tsx && npm run lint && npm run typecheck`

Expected: visual contract, auth tests, lint, and typecheck pass.

```bash
git add apps/web/src/components/PageState.tsx apps/web/src/components/PageState.test.tsx apps/web/src/app/AppShell.tsx apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/spaces/SpacesPage.tsx apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/search/SearchPage.tsx apps/web/src/features/qr-print/PrintPage.tsx apps/web/src/app/AuthLayout.tsx apps/web/src/app/AuthLayout.test.tsx apps/web/src/index.css apps/web/src/visual-system.test.ts
git commit -m "feat: apply warm family visual system"
```

## Task 9: Update responsive journeys and perform final verification

**Files:**
- Modify: `apps/web/e2e/core-flow.spec.ts`
- Modify: `apps/web/e2e/privacy.spec.ts` only if selectors changed
- Modify: `apps/web/playwright.config.ts` if device projects are not already configured
- Modify: `README.md` only if visible navigation instructions are stale

- [ ] **Step 1: Update the core journey selectors**

Cover this path with role/name selectors: login → dashboard → open spaces → create space → create box → open box → add item → search item → open box result → open print workspace. Add assertions that desktop scan is beside the dashboard search and mobile scan is the elevated center navigation action.

- [ ] **Step 2: Configure or confirm three responsive projects**

Use Playwright desktop Chromium, Pixel 7, and iPhone 13 profiles. Each project must use the existing mock backend; do not point automated tests at the user's Supabase or R2 data.

- [ ] **Step 3: Run unit and integration tests**

Run: `npm run test -- --run`

Expected: all Vitest suites pass with no unhandled rejection.

- [ ] **Step 4: Run static checks and production build**

Run: `npm run lint && npm run typecheck && npm run build`

Expected: all commands exit 0. Record any existing bundle-size warning as non-blocking only if the build succeeds and no new dependency was added.

- [ ] **Step 5: Run responsive E2E tests**

Run: `npm run test:e2e`

Expected: desktop Chromium, Pixel 7, and iPhone 13 projects pass.

- [ ] **Step 6: Perform browser visual QA against the local app**

Start the existing dev or preview server and inspect at 1440×900, 390×844, and 360×800. Verify no horizontal scrolling, no content hidden behind mobile nav/sticky actions, desktop scan is icon-only to the right of search, mobile scan is centered/elevated, dialogs fit the viewport, images preserve aspect ratio, and focus order follows reading order.

- [ ] **Step 7: Run the production smoke check**

Run: `npm run preview -- --host 127.0.0.1`

Open `/`, `/app`, `/app/spaces`, `/app/boxes`, `/app/search`, `/app/print`, and one mocked `/b/:publicId` route. Expected: the built app serves each route without template content or console errors.

- [ ] **Step 8: Commit final test/documentation changes**

```bash
git add apps/web/e2e/core-flow.spec.ts apps/web/e2e/privacy.spec.ts apps/web/playwright.config.ts README.md
git commit -m "test: verify responsive storage journeys"
```

Only add files that actually changed; omit unchanged paths from `git add`.

## Final acceptance checklist

- [ ] The mobile primary navigation is exactly 首页 / 空间 / 扫码 / 箱子 / 搜索, with scan elevated in the center.
- [ ] Desktop scan appears only as an icon button to the right of the dashboard search box, not in the sidebar.
- [ ] Dashboard, spaces, boxes, box detail, search, and print match the approved warm-family hierarchy.
- [ ] Editing still requires login; public boxes remain anonymously viewable and private boxes remain protected.
- [ ] R2 uploads, failed-upload field retention, and retry behavior still pass their existing tests.
- [ ] No Supabase schema, RPC, trigger, Edge Function, or R2 backend change is introduced.
- [ ] Keyboard focus, accessible names, reduced motion, and 44px touch targets are verified.
- [ ] Unit tests, lint, typecheck, production build, responsive E2E, and browser smoke checks pass.
