# Mobile Skeleton Flow Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace text loading states with structural Skeletons, simplify scanning and box creation, remove catalogue sorting, and align every mobile route with the approved warm-family design.

**Architecture:** Add one accessible Skeleton primitive, then compose feature-owned loading layouts so each pending page matches its final geometry. Keep React Query ownership in existing pages, simplify creation through the existing modal callback boundary, and centralize mobile navigation changes in `AppShell` while making only targeted page-level spacing fixes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, TanStack Query, React Router, Vitest, Testing Library, Playwright.

---

### Task 1: Add the accessible Skeleton primitive

**Files:**
- Create: `apps/web/src/components/Skeleton.tsx`
- Create: `apps/web/src/components/Skeleton.test.tsx`
- Modify: `apps/web/src/components/PageState.tsx`
- Modify: `apps/web/src/components/PageState.test.tsx`
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Write failing Skeleton semantics and visual-contract tests**

```tsx
render(
  <SkeletonGroup label="正在加载箱子">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-28 w-full" />
  </SkeletonGroup>,
)

expect(screen.getByRole('status', { name: '正在加载箱子' })).toBeInTheDocument()
expect(screen.getAllByTestId('skeleton')).toHaveLength(2)
expect(screen.getAllByTestId('skeleton')[0]).toHaveAttribute('aria-hidden', 'true')
expect(screen.getAllByTestId('skeleton')[0]).toHaveClass('motion-safe:animate-pulse')
```

Update the PageState loading test to assert Skeleton blocks are rendered and the visible label is screen-reader-only instead of centered loading text. Add a CSS contract assertion that no global `overflow-x: hidden` is introduced.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- --run src/components/Skeleton.test.tsx src/components/PageState.test.tsx src/visual-system.test.ts
```

Expected: FAIL because `Skeleton` and `SkeletonGroup` do not exist and PageState still renders visible text.

- [ ] **Step 3: Implement the primitive and generic loading fallback**

```tsx
import type { HTMLAttributes, ReactNode } from 'react'

export function Skeleton({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      data-testid="skeleton"
      className={`rounded-control bg-placeholder/80 motion-safe:animate-pulse ${className}`}
    />
  )
}

export function SkeletonGroup({ label, className = '', children }: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}
```

Change `PageState state="loading"` to a neutral three-line card Skeleton so legacy call sites are never text-only while feature-specific loaders are migrated.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Skeleton.tsx apps/web/src/components/Skeleton.test.tsx apps/web/src/components/PageState.tsx apps/web/src/components/PageState.test.tsx apps/web/src/index.css apps/web/src/visual-system.test.ts
git commit -m "feat: add accessible skeleton primitives"
```

### Task 2: Give catalogue-style pages structural loading layouts

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.test.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.test.tsx`
- Modify: `apps/web/src/features/qr-print/PrintSheetPreview.tsx`
- Modify: `apps/web/src/features/qr-print/PrintSheetPreview.test.tsx`

- [ ] **Step 1: Add failing pending-state tests for each page**

For each mocked deferred query, assert the pending layout has a named status and multiple blocks matching its final structure:

```tsx
expect(screen.getByRole('status', { name: '正在加载箱子目录' })).toBeInTheDocument()
expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(6)
expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
```

Also seed `initialData`/cached data and refetch to prove existing cards remain visible during background fetching.

- [ ] **Step 2: Run focused page tests and verify RED**

```bash
npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/features/spaces/SpacesPage.test.tsx src/features/boxes/BoxesPage.test.tsx src/features/search/SearchPage.test.tsx src/features/qr-print/PrintPage.test.tsx
```

Expected: FAIL because pages still use text loading or partial bespoke placeholders.

- [ ] **Step 3: Compose page-owned Skeleton layouts**

Use `SkeletonGroup` directly in each feature so geometry follows the real page. The box catalogue pattern should be:

```tsx
<SkeletonGroup label="正在加载箱子目录" className="grid gap-5">
  <Skeleton className="h-24 w-full rounded-card" />
  <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton className="h-64 rounded-card" key={index} />
    ))}
  </div>
</SkeletonGroup>
```

Dashboard uses three statistic blocks plus room/recent cards; Spaces uses toolbar, space cards, and layout canvas; Search uses section headings and result rows; Print uses selector plus A4 outline. Replace the QR preview's `正在生成二维码…` text with a square Skeleton that keeps the final QR geometry. Replace the Spaces layout button's visible `正在加载布局…` copy with a disabled control containing a compact Skeleton and an accessible loading label. Only render page Skeletons when `isPending && data === undefined`; cached data stays mounted during refetch.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/dashboard apps/web/src/features/spaces/SpacesPage.tsx apps/web/src/features/spaces/SpacesPage.test.tsx apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/features/search apps/web/src/features/qr-print/PrintPage.tsx apps/web/src/features/qr-print/PrintPage.test.tsx apps/web/src/features/qr-print/PrintSheetPreview.tsx apps/web/src/features/qr-print/PrintSheetPreview.test.tsx
git commit -m "feat: add structural page skeletons"
```

### Task 3: Cover detail, form, profile, and media loading

**Files:**
- Modify: `apps/web/src/features/boxes/BoxDetailPage.tsx`
- Create: `apps/web/src/features/boxes/BoxDetailPage.test.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.test.tsx`
- Modify: `apps/web/src/features/media/AuthorizedImage.tsx`
- Modify: `apps/web/src/features/media/AuthorizedImage.test.tsx`
- Modify: `apps/web/src/features/profile/UserAccountMenu.tsx`
- Create: `apps/web/src/features/profile/UserAccountMenu.test.tsx`
- Modify: `apps/web/src/app/RootEntry.tsx`
- Modify: `apps/web/src/app/RootEntry.test.tsx`
- Modify: `apps/web/src/app/RequireAuth.tsx`
- Modify: `apps/web/src/app/RequireAuth.test.tsx`
- Modify: `apps/web/src/features/auth/ResetPasswordPage.tsx`
- Modify: `apps/web/src/features/auth/ResetPasswordPage.test.tsx`

- [ ] **Step 1: Write failing tests for all remaining query-backed surfaces**

Assert box detail/public detail/form pending states use a named SkeletonGroup; AuthorizedImage renders a sized media Skeleton instead of `图片加载中…`; the sidebar profile footer renders avatar and two-line Skeletons until profile data resolves. Assert RootEntry, RequireAuth, and reset-link validation use branded/form-shaped Skeletons rather than visible loading sentences.

```tsx
expect(screen.getByRole('status', { name: '正在加载授权图片' })).toBeInTheDocument()
expect(screen.queryByText('图片加载中…')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- --run src/features/boxes/BoxDetailPage.test.tsx src/features/boxes/PublicBoxPage.test.tsx src/features/boxes/BoxFormPage.test.tsx src/features/media/AuthorizedImage.test.tsx src/features/profile/UserAccountMenu.test.tsx src/app/RootEntry.test.tsx src/app/RequireAuth.test.tsx src/features/auth/ResetPasswordPage.test.tsx
```

Expected: FAIL on text loading states and missing profile/media Skeletons.

- [ ] **Step 3: Implement detail and local-media Skeletons**

Use a shared visual pattern without creating a query store:

```tsx
<SkeletonGroup label="正在加载箱子详情" className="grid gap-4">
  <Skeleton className="h-10 w-2/3" />
  <Skeleton className="aspect-[16/9] w-full rounded-card" />
  <Skeleton className="h-28 w-full rounded-card" />
</SkeletonGroup>
```

AuthorizedImage must preserve its caller-provided wrapper geometry; render a `size-full min-h-16` Skeleton and keep the final image/error alternative unchanged. Profile pending state must not display fabricated user metadata from the query, but session email may remain because it is already available. Authentication gates use `SkeletonGroup` inside the same canvas/surface structure they finally reveal and retain screen-reader labels such as `正在检查登录状态`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/boxes/BoxDetailPage.tsx apps/web/src/features/boxes/BoxDetailPage.test.tsx apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx apps/web/src/features/boxes/BoxForm.tsx apps/web/src/features/boxes/BoxFormPage.test.tsx apps/web/src/features/media apps/web/src/features/profile/UserAccountMenu.tsx apps/web/src/features/profile/UserAccountMenu.test.tsx apps/web/src/app/RootEntry.tsx apps/web/src/app/RootEntry.test.tsx apps/web/src/app/RequireAuth.tsx apps/web/src/app/RequireAuth.test.tsx apps/web/src/features/auth/ResetPasswordPage.tsx apps/web/src/features/auth/ResetPasswordPage.test.tsx
git commit -m "feat: complete query loading skeletons"
```

### Task 4: Remove manual QR address entry and simplify scanner recovery

**Files:**
- Modify: `apps/web/src/features/scanner/ScannerPage.tsx`
- Modify: `apps/web/src/features/scanner/ScannerPage.test.tsx`

- [ ] **Step 1: Replace manual-entry tests with camera-only behavior tests**

```tsx
expect(screen.queryByLabelText('手动输入二维码地址')).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: '打开箱子' })).not.toBeInTheDocument()
expect(screen.getByRole('button', { name: '重新尝试相机' })).toBeInTheDocument()
```

Cover rejected permission, unavailable camera, invalid QR, and successful camera navigation.

- [ ] **Step 2: Run scanner tests and verify RED**

```bash
npm test -- --run src/features/scanner/ScannerPage.test.tsx
```

Expected: FAIL because manual state and UI still exist and recovery lacks a retry button.

- [ ] **Step 3: Implement a restartable camera-only scanner**

Remove `manualValue`, `manualError`, `openManualAddress`, the entire form block, and the “请使用手动输入” copy. Add a retry counter consumed by the scanner effect:

```tsx
const [scannerAttempt, setScannerAttempt] = useState(0)

<button type="button" onClick={() => {
  handledRef.current = false
  setCameraMessage(null)
  setScannerAttempt((value) => value + 1)
}}>
  重新尝试相机
</button>
```

Use a `relative aspect-[4/5] max-h-[65dvh] overflow-hidden rounded-shell bg-ink` camera card on mobile and `md:aspect-video` on larger screens. Include `scannerAttempt` in the effect dependencies and always stop old controls before restarting.

- [ ] **Step 4: Run scanner tests and verify GREEN**

Run Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/scanner/ScannerPage.tsx apps/web/src/features/scanner/ScannerPage.test.tsx
git commit -m "feat: simplify camera scanner flow"
```

### Task 5: Close the create modal after persistence and remove QR results

**Files:**
- Modify: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.test.tsx`
- Modify: `apps/web/src/features/boxes/CreateBoxModal.tsx`
- Modify: `apps/web/src/features/boxes/CreateBoxModal.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/e2e/mock-backend.ts`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: Write failing success and upload-retry tests**

Create without a cover must call a single completion callback after the API resolves, unmount the dialog, invalidate/refetch `['boxes']`, and never call `boxQrPng` or render a QR image. With a cover upload failure, assert the dialog remains open and `重试上传` completes the flow only after the retry succeeds.

```tsx
expect(screen.queryByRole('img', { name: /二维码/ })).not.toBeInTheDocument()
await waitFor(() => expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument())
expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['boxes'] })
```

- [ ] **Step 2: Run box creation tests and verify RED**

```bash
npm test -- --run src/features/boxes/BoxFormPage.test.tsx src/features/boxes/CreateBoxModal.test.tsx src/features/boxes/BoxesPage.test.tsx
```

Expected: FAIL because `BoxForm` enters the QR result state.

- [ ] **Step 3: Replace QR-result state with `onCompleted`**

Remove `env`, `boxQrPng`, `boxQrUrl`, `createdBox`, `qrPng`, `qrError`, and the result section. Replace `onCreated`/`onDone` with:

```tsx
onCompleted?: (box: CreatedBox) => void
```

After create and optional successful upload, call `onCompleted?.(box)`. If upload fails, retain `pendingBox` and file; `retryCoverUpload` calls `onCompleted?.(pendingBox)` after success. Editing behavior remains unchanged.

In `BoxesPage`, completion must update/invalidate the query, close `?create=1`, and expose a temporary `role="status"` message such as `箱子已创建` without blocking focus restoration.

- [ ] **Step 4: Update E2E helpers and verify GREEN**

Change `createBox()` in `mock-backend.ts` to wait for the modal to close and the new card to appear instead of waiting for a QR image. Run the Step 2 tests plus:

```bash
npm run test:e2e -- --project=desktop-chromium -g "owner creates"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/boxes apps/web/e2e/mock-backend.ts apps/web/e2e/core-flow.spec.ts
git commit -m "feat: finish box creation in catalogue"
```

### Task 6: Remove catalogue sorting while preserving search and space filters

**Files:**
- Modify: `apps/web/src/features/boxes/BoxCatalogueToolbar.tsx`
- Modify: `apps/web/src/features/boxes/BoxCatalogueToolbar.test.tsx`
- Modify: `apps/web/src/features/boxes/box-catalogue.ts`
- Modify: `apps/web/src/features/boxes/box-catalogue.test.ts`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`

- [ ] **Step 1: Write failing no-sort and stable-order tests**

```tsx
expect(screen.queryByRole('combobox', { name: '箱子排序' })).not.toBeInTheDocument()
expect(screen.getByRole('searchbox', { name: '搜索箱子' })).toBeInTheDocument()
expect(screen.getByRole('group', { name: '空间筛选' })).toBeInTheDocument()
```

Model test: filtered results preserve input order, and an incoming `?sort=name` is removed without changing `q` or `space`.

- [ ] **Step 2: Run catalogue tests and verify RED**

```bash
npm test -- --run src/features/boxes/BoxCatalogueToolbar.test.tsx src/features/boxes/box-catalogue.test.ts src/features/boxes/BoxesPage.test.tsx
```

Expected: FAIL because sort types, UI, URL state, and sorting remain.

- [ ] **Step 3: Simplify the catalogue API**

Rename `filterAndSortBoxes` to `filterBoxes` and reduce filters to:

```ts
export type BoxCatalogueFilters = {
  query: string
  spaceId: string
}
```

Return `boxes.filter(...)` without `toSorted`. Remove `BoxCatalogueSort`, `parseCatalogueSort`, `sort` props, `onSortChange`, and sort dependencies. Keep the toolbar as a full-width search surface; keep `SpaceFilterChips` below it. On mount, delete legacy `sort` while preserving other parameters.

- [ ] **Step 4: Run catalogue tests and verify GREEN**

Run Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/boxes/BoxCatalogueToolbar.tsx apps/web/src/features/boxes/BoxCatalogueToolbar.test.tsx apps/web/src/features/boxes/box-catalogue.ts apps/web/src/features/boxes/box-catalogue.test.ts apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx
git commit -m "feat: simplify box catalogue filters"
```

### Task 7: Align the global mobile shell and every route

**Files:**
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxDetailPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/scanner/ScannerPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: `apps/web/src/visual-system.test.ts`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: Write failing shell and responsive contract tests**

Assert mobile banner has the brand but no `我的收纳空间` link/button. Assert main content uses responsive horizontal padding and safe bottom space:

```tsx
expect(screen.getByRole('banner')).toHaveTextContent('Nomo')
expect(screen.queryByRole('link', { name: '我的收纳空间' })).not.toBeInTheDocument()
```

Extend E2E to visit `/app`, `/app/spaces`, `/app/boxes`, one box detail, `/app/search`, `/app/scan`, and `/app/print` at 320/390/768 widths and run `expectNoHorizontalOverflow(page)` on each.

- [ ] **Step 2: Run shell/unit and focused responsive E2E tests to verify RED**

```bash
npm test -- --run src/app/AppShell.test.tsx src/visual-system.test.ts
npm run test:e2e -- --project=iphone -g "mobile route alignment"
```

Expected: shell test FAILS on the extra top-right link; responsive audit identifies current page-specific mismatches.

- [ ] **Step 3: Implement AppShell and targeted page alignment**

Replace the mobile header with a brand-only container:

```tsx
<header className="flex items-center px-4 pt-5 min-[360px]:px-5 lg:hidden" role="banner">
  <Link className="flex items-center gap-2 text-xl font-black tracking-[-0.05em] text-ink no-underline" to="/app">
    <span className="grid size-9 place-items-center rounded-control bg-brand text-xl font-black tracking-normal text-white" aria-hidden="true">N</span>
    Nomo
  </Link>
</header>
```

Use `main` padding `px-4 min-[360px]:px-5` and preserve the existing safe-area bottom calculation. For each listed page, enforce `min-w-0`, mobile `gap-5`, full-width 48px primary actions, `rounded-card` surfaces, and `lg:` overrides for existing desktop geometry. Do not change desktop information architecture.

- [ ] **Step 4: Run focused tests and all responsive E2E projects**

```bash
npm test -- --run src/app/AppShell.test.tsx src/visual-system.test.ts
npm run test:e2e -- --project=desktop-chromium --project=iphone --project=pixel -g "mobile route alignment|navigation changes"
```

Expected: PASS with no route-level horizontal overflow and no mobile top-right button.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/AppShell.tsx apps/web/src/app/AppShell.test.tsx apps/web/src/features apps/web/src/visual-system.test.ts apps/web/e2e/core-flow.spec.ts
git commit -m "feat: align global mobile experience"
```

### Task 8: Perform final browser QA and regression verification

**Files:**
- Modify only if final QA exposes a tested defect in an owning file.

- [ ] **Step 1: Run the complete automated gate**

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: all Vitest files pass, typecheck/lint/build succeed, all Playwright desktop/iPhone/Pixel tests pass, diff check is clean, and only intentional changes are present.

- [ ] **Step 2: Inspect real Chrome at all required breakpoints**

Use the authenticated local app and inspect 1440×900, 1024×768, 768×1024, 390×844, 360×800, and 320×568. Verify:

- all query pages show structural Skeletons before data resolves;
- no mobile route has the top-right space button;
- scanner has no address input;
- creating a box returns directly to the refreshed catalogue;
- catalogue has search and space filters but no sort;
- bottom navigation never covers primary actions;
- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

- [ ] **Step 3: Fix any visual defect through a fresh RED/GREEN cycle**

For each defect, add a focused component or E2E assertion first, observe failure, apply the smallest owning-file change, and rerun the affected test before returning to the complete gate.

- [ ] **Step 4: Request final code review**

Review the complete range from the plan commit through `HEAD` against `docs/superpowers/specs/2026-08-01-mobile-skeleton-flow-simplification-design.md`. Resolve every Critical or Important finding and rerun the gate.

- [ ] **Step 5: Commit final QA fixes if any**

```bash
git add -u apps/web/src apps/web/e2e
git commit -m "fix: complete mobile experience alignment"
```
