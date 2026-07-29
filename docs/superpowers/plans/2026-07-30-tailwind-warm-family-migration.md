# Tailwind Warm Family Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nomo's remaining dark-purple legacy CSS with one Tailwind v4 warm-family visual system and complete the approved responsive page redesign without changing Supabase, R2, authorization, scan, or QR/PDF behavior.

**Architecture:** Enable Tailwind v4 in the existing CSS entry, define semantic theme variables, and migrate page presentation in working vertical slices. React feature pages continue to own data and behavior; focused presentational components own reusable class combinations. Legacy selectors are deleted in the same task that migrates their consumers so the project never settles into permanent dual styling.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Vite 8, React Router 7, TanStack Query 5, Supabase JS, Vitest/Testing Library, Playwright, existing R2 media and QR/PDF utilities.

---

## Current baseline

Commits through `38894fb` are complete and must be preserved:

- enriched box/space read models;
- typed SVG `AppIcon`;
- desktop and mobile navigation semantics;
- dashboard search/scan hierarchy;
- dashboard metrics/spaces/recent boxes;
- space cards and accessible portalled space editor.

The user's untracked `docs/QR_Code_智能收纳清单管理系统_PRD.md` must remain untouched.

## File map and responsibilities

- `apps/web/src/index.css`: Tailwind import, `@theme`, minimal base layer, safe-area and print-only utilities; legacy page selectors are removed progressively.
- `apps/web/vite.config.ts`: PWA colors only; Tailwind plugin already exists.
- `apps/web/src/app/AppShell.tsx`: responsive sidebar/mobile navigation classes.
- `apps/web/src/components/AppIcon.tsx`: existing code-native SVG icon API; no redesign logic.
- `apps/web/src/components/GlobalFindBar.tsx`: warm search/scan toolbar.
- `apps/web/src/components/PageState.tsx`: reusable loading, empty, and retryable error state.
- `apps/web/src/features/dashboard/DashboardPage.tsx`: Tailwind dashboard composition.
- `apps/web/src/features/spaces/SpacesPage.tsx`: Tailwind cards and portalled editor; existing modal logic remains intact.
- `apps/web/src/features/boxes/BoxesPage.tsx`: filterable box grid.
- `apps/web/src/features/boxes/PublicBoxPage.tsx`: box hero and item list.
- `apps/web/src/features/items/ItemForm.tsx`: media-first form, quantity stepper, sticky mobile action.
- `apps/web/src/features/search/SearchPage.tsx`: URL-backed grouped search.
- `apps/web/src/features/qr-print/PrintPage.tsx`: desktop batch workspace and mobile single-label experience.
- `apps/web/src/features/qr-print/pdf.ts`: generated label palette only; generation behavior remains unchanged.
- `apps/web/src/app/AuthLayout.tsx`: warm auth composition.
- `apps/web/src/visual-system.test.ts`: source-level theme and legacy-removal contracts.
- Co-located component tests: behavior and accessibility contracts.
- `apps/web/e2e/*.spec.ts`, `apps/web/e2e/mock-backend.ts`: three-device journeys using current accessible names.

## Task 1: Enable the warm Tailwind theme and remove automatic dark mode

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/index.html`
- Test: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Replace the legacy visual contract with a failing Tailwind contract**

Use exact source assertions:

```ts
test('defines the approved Tailwind warm-family theme', () => {
  expect(css.startsWith('@import "tailwindcss";')).toBe(true)
  for (const token of [
    '--color-canvas: #f8f2e8;',
    '--color-surface: #fffdf8;',
    '--color-sidebar: #f0e3d3;',
    '--color-ink: #30271e;',
    '--color-muted: #756a5e;',
    '--color-brand: #df6538;',
    '--color-brand-strong: #c95229;',
    '--color-success: #71896f;',
    '--color-danger: #b42318;',
    '--color-line: #e3d5c5;',
    '--color-placeholder: #ead7c2;',
    '--breakpoint-lg: 64rem;',
  ]) expect(css).toContain(token)
})

test('does not restore the rejected dark-purple theme', () => {
  expect(css).not.toContain('@media (prefers-color-scheme: dark)')
  expect(css).not.toMatch(/#(?:6946e8|ad97ff|7c3aed)/i)
})
```

Add a Vite config source assertion for `theme_color: '#df6538'` and `background_color: '#f8f2e8'`. Read `index.html` and assert `<meta name="theme-color" content="#df6538" />`.

- [ ] **Step 2: Run the contract and verify RED**

Run from `apps/web`: `npm run test -- src/visual-system.test.ts`

Expected: failures for missing Tailwind import/theme tokens, dark media query, purple values, and old PWA colors.

- [ ] **Step 3: Introduce the exact theme and a temporary compatibility bridge**

Start `index.css` with:

```css
@import "tailwindcss";

@theme {
  --color-canvas: #f8f2e8;
  --color-surface: #fffdf8;
  --color-sidebar: #f0e3d3;
  --color-ink: #30271e;
  --color-muted: #756a5e;
  --color-brand: #df6538;
  --color-brand-strong: #c95229;
  --color-success: #71896f;
  --color-danger: #b42318;
  --color-line: #e3d5c5;
  --color-placeholder: #ead7c2;
  --radius-control: 0.875rem;
  --radius-card: 1.25rem;
  --radius-shell: 1.5rem;
  --shadow-float: 0 18px 44px rgb(86 58 36 / 16%);
  --shadow-soft: 0 8px 24px rgb(86 58 36 / 8%);
  --breakpoint-lg: 64rem;
}

:root {
  --text: var(--color-muted);
  --text-h: var(--color-ink);
  --bg: var(--color-canvas);
  --surface: var(--color-surface);
  --surface-muted: #f3eadf;
  --border: var(--color-line);
  --accent: var(--color-brand);
  --accent-strong: var(--color-brand-strong);
  --accent-bg: #fae4d7;
  --accent-border: #e8a88a;
  --danger: var(--color-danger);
  --shadow: var(--shadow-float);
  font: 16px/1.55 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--color-muted);
  background: var(--color-canvas);
}
```

Do not retain a dark-mode media query. Keep the compatibility variables only until Tasks 2–6 delete their consumers.

- [ ] **Step 4: Update non-DOM PWA colors**

Set:

```ts
theme_color: '#df6538',
background_color: '#f8f2e8',
```

Add `<meta name="theme-color" content="#df6538" />` to `index.html`. Do not change manifest names, icons, display mode, PWA registration, workbox configuration, or other document metadata.

- [ ] **Step 5: Run verification**

Run: `npm run test -- src/visual-system.test.ts && npm run typecheck && npm run lint && npm run build`

Expected: all commands exit 0; the existing bundle-size warning may remain but no purple/dark contract failure is allowed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/index.css apps/web/src/visual-system.test.ts apps/web/vite.config.ts apps/web/index.html
git commit -m "feat: establish warm Tailwind theme"
```

## Task 2: Migrate the shell, dashboard, and spaces to Tailwind

**Files:**
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/src/components/GlobalFindBar.tsx`
- Modify: `apps/web/src/components/GlobalFindBar.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Add failing class and breakpoint contracts**

Assert semantic behavior plus these durable class outcomes:

```ts
expect(screen.getByRole('complementary')).toHaveClass('lg:flex')
expect(screen.getByRole('navigation', { name: '移动端主导航' })).toHaveClass('lg:hidden')
expect(screen.getByRole('main')).toHaveClass('lg:ml-60')
expect(screen.getByRole('search')).toHaveClass('flex')
expect(screen.getByRole('dialog', { name: '创建空间' })).toHaveClass('bg-surface')
```

Update the source contract to assert no `@media (max-width: 767px)`, `.dashboard-hero`, `.quick-actions`, `.space-card`, `.mobile-nav`, or `.desktop-sidebar` selector remains after this task.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm run test -- src/app/AppShell.test.tsx src/components/GlobalFindBar.test.tsx src/features/dashboard/DashboardPage.test.tsx src/features/spaces/SpacesPage.test.tsx src/visual-system.test.ts`

Expected: failures because JSX still exposes legacy class names and CSS still contains old selectors.

- [ ] **Step 3: Migrate `AppShell` with a 1024px desktop boundary**

Use these literal class responsibilities:

```tsx
<div className="min-h-dvh bg-canvas text-ink">
  <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto border-r border-line bg-sidebar px-6 py-8 lg:flex">
    {/* existing brand, exact links, and footer */}
  </aside>
  <main className="min-w-0 px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 lg:ml-60 lg:px-[clamp(1.75rem,4vw,4rem)] lg:pb-16 lg:pt-10">
    <Outlet />
  </main>
  <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-float backdrop-blur lg:hidden" aria-label="移动端主导航">
    {/* existing five exact links */}
  </nav>
</div>
```

Active desktop links use `bg-surface text-ink`; inactive links use `text-muted hover:bg-surface/60 hover:text-ink`. Mobile scan keeps `-translate-y-[18px]`, a 56px `bg-brand text-white` circle, and an explicit active ring. Preserve exact routes, labels, `aria-current`, brand link, and footer.

- [ ] **Step 4: Migrate `GlobalFindBar`**

Use a responsive flex search form with a `min-h-12` field, `focus-within:border-brand`, explicit input `focus-visible:outline-none`, and a search submit button. Give the scan link this complete static class string: `hidden size-[46px] shrink-0 items-center justify-center rounded-control bg-brand text-white shadow-soft transition hover:bg-brand-strong focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand/45 lg:inline-flex`. Keep the current trim/encode/navigation behavior and keyboard order unchanged.

- [ ] **Step 5: Migrate dashboard composition**

Page wrapper: `mx-auto flex w-full max-w-7xl flex-col gap-10`. Greeting is plain content on the warm canvas, not a gradient hero card. Metrics are `grid gap-4 sm:grid-cols-3`; ordinary cards use `border border-line bg-surface` without shadow. Spaces use `sm:grid-cols-2 xl:grid-cols-4`; recent boxes use `md:grid-cols-2 xl:grid-cols-3`. Preserve all query logic, content order, links, images/fallbacks, and empty/error text.

- [ ] **Step 6: Migrate spaces without changing modal behavior**

Use Tailwind on the existing header, create button, grid, linked cards, action buttons, portal backdrop, and editor. The editor backdrop is `fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:justify-center`; dialog is `max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-shell border border-line bg-surface p-6 shadow-float`. Preserve portal, inert, body lock, focus trap/restoration, pending ref, RHF, validation associations, and delete guard exactly.

- [ ] **Step 7: Delete migrated selectors**

Remove shell, nav, dashboard, quick-action, space-card, sheet/editor, and migrated shared selectors from `index.css`. Do not remove base styles still needed by unmigrated box/search/print/auth pages.

- [ ] **Step 8: Verify and commit**

Run focused tests, then: `npm run test -- --run && npm run typecheck && npm run lint && npm run build`.

Expected: all pass; no app logic test is weakened to accommodate styling.

```bash
git add apps/web/src/app/AppShell.tsx apps/web/src/app/AppShell.test.tsx apps/web/src/components/GlobalFindBar.tsx apps/web/src/components/GlobalFindBar.test.tsx apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/dashboard/DashboardPage.test.tsx apps/web/src/features/spaces/SpacesPage.tsx apps/web/src/features/spaces/SpacesPage.test.tsx apps/web/src/index.css apps/web/src/visual-system.test.ts
git commit -m "feat: migrate core workspace to Tailwind"
```

## Task 3: Build the Tailwind box catalogue

**Files:**
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Write failing URL-filter and card tests**

At `/app/boxes?space=space-1`, assert only `space-1` boxes render. Clicking `全部空间` must clear `space`; a space chip must set it with `replace:true`. For each visible box assert cover alt or `箱子封面占位图`, name, code, space/location, `{item_count} 件物品`, public/private text, view/edit/delete.

- [ ] **Step 2: Verify RED**

Run: `npm run test -- src/features/boxes/BoxesPage.test.tsx`

Expected: no filter chips, covers, item counts, or URL state in the current page.

- [ ] **Step 3: Implement local URL-backed filtering**

Use:

```ts
const [searchParams, setSearchParams] = useSearchParams()
const selectedSpace = searchParams.get('space') ?? ''
const visibleBoxes = selectedSpace
  ? boxes.filter((box) => box.space_id === selectedSpace)
  : boxes
```

Generate unique spaces from `boxes` by `space_id` and `space_name`. Chips are buttons with `aria-pressed`; selected is `border-brand bg-brand text-white`, unselected is `border-line bg-surface text-muted`.

- [ ] **Step 4: Implement the responsive grid cards**

Use `grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4`. Cover ratio is `aspect-[4/3]`. Use `AuthorizedImage` for `cover_object_key`; otherwise render a stable `bg-placeholder` illustration containing `AppIcon box` and accessible text. Visibility uses `AppIcon globe/lock` plus text. Keep the existing `ConfirmDialog` mutation behavior.

- [ ] **Step 5: Delete old box-card selectors and verify**

Update `visual-system.test.ts` to assert `.box-card` is absent from CSS. Run focused, full, typecheck, lint, and build.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/index.css apps/web/src/visual-system.test.ts
git commit -m "feat: build Tailwind box catalogue"
```

## Task 4: Build the Tailwind box detail and item workflow

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Modify: `apps/web/src/features/items/ItemForm.tsx`
- Modify: `apps/web/src/features/items/ItemForm.test.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Write failing item stepper tests**

Assert `减少数量` never goes below 1; `增加数量` increments; direct numeric input still validates; submission receives the final number. Preserve existing failed-upload retention and retry tests unchanged.

- [ ] **Step 2: Write failing owner/viewer hierarchy tests**

Owner sees cover/fallback, code, visibility text, `最近更新`, space/location, edit link, print, add, and item edit/delete. Anonymous public viewer sees the same readable content but no edit/add/delete controls. Items show image/fallback, name, category, description, and quantity.

- [ ] **Step 3: Verify RED**

Run: `npm run test -- src/features/items/ItemForm.test.tsx src/features/boxes/PublicBoxPage.test.tsx`

Expected: missing stepper, metadata, edit action, item description/list hierarchy, and sticky mobile action.

- [ ] **Step 4: Implement the quantity stepper**

Use existing RHF state:

```ts
const quantity = watch('quantity')
const setQuantity = (next: number) =>
  setValue('quantity', Math.max(1, next), { shouldDirty: true, shouldValidate: true })
```

Buttons are 44px, `type="button"`, use minus/plus icons and complete aria-labels. Reorder visual fields to media, name, category, quantity, note. Keep media upload logic and retry stages unchanged.

- [ ] **Step 5: Implement the hero, dense rows, and sticky actions**

Hero uses `grid gap-6 rounded-shell border border-line bg-surface p-5 md:grid-cols-[minmax(16rem,0.8fr)_1.2fr]`. Owner actions include edit link `/app/boxes/${box.id}/edit`. Items use bordered rows on desktop and compact stacked cards on mobile, not shadowed panels. The mobile add action is `fixed inset-x-5 bottom-[calc(6.75rem+env(safe-area-inset-bottom))]` and hidden for anonymous viewers; desktop uses inline action.

- [ ] **Step 6: Delete legacy detail/item selectors and verify**

Remove `.public-box`, `.box-cover`, `.item-card`, `.item-image`, and migrated form layout rules from CSS. Preserve only media-specific behavior still required by `AuthorizedImage` if it has not been expressed in JSX.

Run focused, full, typecheck, lint, and build.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx apps/web/src/features/items/ItemForm.tsx apps/web/src/features/items/ItemForm.test.tsx apps/web/src/index.css apps/web/src/visual-system.test.ts
git commit -m "feat: migrate box contents to Tailwind"
```

## Task 5: Build URL search and responsive label printing

**Files:**
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.test.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.test.tsx`
- Modify: `apps/web/src/features/qr-print/pdf.ts`
- Modify: `apps/web/src/features/qr-print/pdf.test.ts`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Write failing URL/grouped search tests**

At `/app/search?q=充电器`, assert the input initializes to `充电器`, item RPC runs after 250ms, matching boxes from `listBoxes()` appear under `箱子`, items under `物品`, and changing input replaces the URL query. Empty results include a `/app/scan` suggestion.

- [ ] **Step 2: Write failing print workspace tests**

Assert desktop markup has `已选择 0 个`, selectable box list, `标签预览`, exact box metadata after selection, real QR image alt `二维码标签预览`, and existing PDF progress/error. Assert the mobile single-label region uses radio/single selection and `下载单个标签`; it must not expose multi-select controls.

- [ ] **Step 3: Verify RED**

Run: `npm run test -- src/features/search/SearchPage.test.tsx src/features/qr-print/PrintPage.test.tsx src/features/qr-print/pdf.test.ts`

Expected: missing URL initialization/groups/preview/mobile branch and old purple PDF palette.

- [ ] **Step 4: Implement search using current APIs**

Use `useSearchParams`, existing `searchItems`, and `listBoxes`. Filter boxes case-insensitively over name, code, space, and location. Render separate Tailwind list groups with icon tiles and trailing chevrons; do not change the RPC.

- [ ] **Step 5: Implement responsive print modes**

Use one `selected` set for desktop checkboxes and `mobileSelectedId` for the single mobile choice. Desktop region is `hidden lg:grid lg:grid-cols-[minmax(18rem,0.75fr)_1.25fr]`; mobile region is `lg:hidden`. Generate preview via:

```ts
const qrUrl = boxQrUrl(env.VITE_PUBLIC_APP_ORIGIN, selectedBox.public_id)
const qrImage = await boxQrPng(qrUrl)
```

The preview is presentational; `renderLabelsPdf` remains the download path.

- [ ] **Step 6: Replace generated PDF colors**

Use `#fffdf8` background, `#e3d5c5` border, `#30271e` primary text, `#756a5e` secondary text, and `#df6538` code. Update PDF tests to assert unchanged label count, page count, URL, and progress behavior plus absence of old purple color.

- [ ] **Step 7: Remove legacy search/print selectors, verify, and commit**

Run focused, full, typecheck, lint, and build.

```bash
git add apps/web/src/features/search/SearchPage.tsx apps/web/src/features/search/SearchPage.test.tsx apps/web/src/features/qr-print/PrintPage.tsx apps/web/src/features/qr-print/PrintPage.test.tsx apps/web/src/features/qr-print/pdf.ts apps/web/src/features/qr-print/pdf.test.ts apps/web/src/index.css apps/web/src/visual-system.test.ts
git commit -m "feat: migrate search and printing to Tailwind"
```

## Task 6: Migrate remaining pages and standardize data states

**Files:**
- Create: `apps/web/src/components/PageState.tsx`
- Create: `apps/web/src/components/PageState.test.tsx`
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/src/app/AuthLayout.tsx`
- Modify: `apps/web/src/app/AuthLayout.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.tsx`
- Modify: `apps/web/src/features/scanner/ScannerPage.tsx`
- Modify: all remaining feature pages that still contain legacy presentation class names
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Write failing `PageState` and offline tests**

Use the exact API:

```ts
type PageStateProps =
  | { state: 'loading'; label: string }
  | { state: 'empty'; title: string; action?: ReactNode }
  | { state: 'error'; message: string; onRetry: () => void }
```

Assert loading status, empty action, error retry callback, and AppShell offline notice toggled by browser `offline`/`online` events.

- [ ] **Step 2: Verify RED**

Run: `npm run test -- src/components/PageState.test.tsx src/app/AppShell.test.tsx`

Expected: missing component and offline state.

- [ ] **Step 3: Implement `PageState` and adopt query retry**

Use Tailwind warm surface/border classes. Error action calls each query's `refetch()`. AppShell initializes from `navigator.onLine`, subscribes/cleans up both events, and shows `当前离线，部分操作可能不可用` with `role="status"`. Never expose raw signed URLs or backend media errors.

- [ ] **Step 4: Migrate auth and forms**

Auth uses a warm two-column desktop layout and compact mobile brand promise; no gradient. `BoxFormPage`, scanner, login/register/recovery, and remaining forms use semantic Tailwind classes, 44px controls, `aria-invalid`, and `aria-describedby`. Do not change form schemas, mutations, scanner validation, or route behavior.

- [ ] **Step 5: Delete remaining compatibility CSS**

At the end of this task, `index.css` may contain only `@import`, `@theme`, `@layer base`, reduced motion, safe-area/print utilities, and narrowly justified browser-normalization rules. Remove compatibility variables `--text`, `--bg`, `--accent`, all legacy page selectors, gradients, and ordinary-card shadows.

- [ ] **Step 6: Strengthen the source contract**

Assert absence of `prefers-color-scheme: dark`, purple hex values, `radial-gradient`, `.panel`, `.card-grid`, `.form-stack`, `.auth-shell`, `.quick-actions`, and the compatibility variables. Assert presence of Tailwind theme tokens, reduced motion, and print media.

- [ ] **Step 7: Verify and commit**

Run full tests, typecheck, lint, and build.

```bash
git add apps/web/src apps/web/vite.config.ts
git commit -m "feat: complete Tailwind visual migration"
```

Before `git add`, inspect `git status` and stage only intended application files; never stage the user's PRD.

## Task 7: Update journeys and perform design-conformance acceptance

**Files:**
- Modify: `apps/web/e2e/core-flow.spec.ts`
- Modify: `apps/web/e2e/privacy.spec.ts`
- Modify: `apps/web/e2e/mock-backend.ts`
- Modify: `apps/web/src/visual-system.test.ts` only if acceptance finds a missing stable contract
- Create: `docs/superpowers/reports/2026-07-30-tailwind-design-conformance.md`

- [ ] **Step 1: Update stale E2E setup and selectors**

Change the dashboard assertion from `收纳工作台` to `早上好，今天找什么？`. Update `createSpace()` to click the unique header `创建空间` button before filling `空间名称`, then submit within the `创建空间` dialog. Use current role/name selectors for boxes, item stepper, URL search, print preview, and mobile navigation.

- [ ] **Step 2: Add responsive design assertions**

Desktop: sidebar visible, mobile nav hidden, scan visible beside search. iPhone/Pixel: sidebar hidden, mobile five-nav visible, desktop scan hidden, center scan visible, no horizontal overflow. At 768px mobile nav remains; at 1024px sidebar appears.

- [ ] **Step 3: Run all automated verification**

Run:

```bash
npm run test -- --run
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected: 0 failures across Vitest, all three Playwright projects, lint, typecheck, and production build.

- [ ] **Step 4: Use Chrome for visual and functional audit**

Inspect login, dashboard, spaces, boxes, one public box, item form, search, print, and scanner entry at 1440×900, 1024×768, 768×1024, 390×844, 360×800, and 320×568. Verify exact computed theme colors, max width, responsive navigation, sticky/safe-area clearance, focus rings, no horizontal overflow, and no console errors. Do not accept camera permission during layout-only audit.

- [ ] **Step 5: Write the conformance report**

The report must contain a four-part matrix—配色、样式、布局、功能—with `MATCH/PARTIAL/MISSING/CONFLICT`, evidence, and zero remaining Critical/Important issues. Include the verification commands and results. If a Critical/Important issue exists, write a failing test and fix it before finalizing the report.

- [ ] **Step 6: Final commit**

```bash
git add apps/web/e2e/core-flow.spec.ts apps/web/e2e/privacy.spec.ts apps/web/e2e/mock-backend.ts apps/web/src/visual-system.test.ts docs/superpowers/reports/2026-07-30-tailwind-design-conformance.md
git commit -m "test: verify Tailwind design conformance"
```

Only stage files that changed.

## Final acceptance checklist

- [ ] Warm Tailwind theme is the only visual system; no automatic dark-purple theme remains.
- [ ] PWA, PDF labels, auth, scanner, forms, and all feature pages use the approved palette.
- [ ] Desktop/sidebar begins at 1024px; tablets retain mobile navigation.
- [ ] Desktop scan is icon-only beside search; mobile scan is the elevated center action.
- [ ] Dashboard, spaces, boxes, detail/items, search, and print match the approved hierarchy.
- [ ] Public/private access, owner-only editing, R2 retry semantics, scan validation, and PDF generation are preserved.
- [ ] All form errors are associated, controls are at least 44px, focus is visible, and reduced motion is supported.
- [ ] Legacy CSS selectors and compatibility variables are removed rather than hidden under overrides.
- [ ] Unit, lint, typecheck, build, three-device E2E, Chrome visual audit, and conformance report all pass.
