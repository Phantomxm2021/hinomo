# Mobile Box Detail App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the mobile box-detail presentation as an app-style screen while preserving the current desktop presentation and all existing behaviors.

**Architecture:** Keep data loading, permissions, mutations, focus restoration, and forms inside `PublicBoxPage`. Change only responsive presentation classes and small markup groupings, using mobile defaults plus `lg:` overrides to reproduce the existing desktop cards and grid.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright.

---

### Task 1: Lock the responsive design contract

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`

- [ ] **Step 1: Write failing tests for mobile and desktop structure**

Add assertions that the summary section uses a borderless mobile presentation with desktop restoration, the item list is a mobile grouped surface with desktop card restoration, and the empty state is borderless on mobile:

```tsx
const summary = screen.getByTestId('box-summary')
expect(summary).toHaveClass('border-0', 'bg-transparent', 'lg:border', 'lg:bg-surface')

const list = screen.getByTestId('box-item-list')
expect(list).toHaveClass('overflow-hidden', 'bg-surface', 'lg:contents')

const empty = screen.getByText('箱子里还没有物品')
expect(empty).toHaveClass('border-0', 'lg:border', 'lg:border-dashed')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx
```

Expected: FAIL because the mobile app-specific structure and responsive desktop restoration classes are absent.

- [ ] **Step 3: Add a loading skeleton contract**

Assert that the loading summary uses the same responsive borderless/mobile and bordered/desktop structure:

```tsx
expect(screen.getByTestId('box-summary-skeleton')).toHaveClass(
  'border-0',
  'bg-transparent',
  'lg:border',
  'lg:bg-surface',
)
```

- [ ] **Step 4: Run the focused test and confirm the intended failures**

Run the same focused Vitest command. Expected: FAIL only on the new design-contract assertions.

### Task 2: Implement mobile app presentation with desktop restoration

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`

- [ ] **Step 1: Convert the page frame and loading skeleton**

Use tighter mobile gutters and app-like skeleton grouping while retaining desktop spacing:

```tsx
const frameClassName = 'mx-auto grid min-w-0 w-full max-w-6xl gap-6 px-4 pb-[calc(6rem+var(--safe-area-bottom))] pt-3 min-[360px]:px-5 lg:gap-6 lg:px-8 lg:pb-10 lg:pt-5'

<div
  data-testid="box-summary-skeleton"
  className="grid gap-4 border-0 bg-transparent p-0 lg:grid-cols-[minmax(16rem,0.8fr)_1.2fr] lg:gap-6 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-5"
>
```

- [ ] **Step 2: Rebuild the mobile summary hierarchy**

Make the summary borderless by default and restore the desktop card at `lg`; keep cover, metadata, actions, and existing text content:

```tsx
<section
  data-testid="box-summary"
  className="grid gap-4 border-0 bg-transparent p-0 lg:grid-cols-[minmax(16rem,0.8fr)_1.2fr] lg:gap-6 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-5"
>
```

Use mobile fill-style metadata and action controls, with `lg:border`, `lg:bg-canvas`, and existing desktop dimensions restored at the desktop breakpoint.

- [ ] **Step 3: Convert items to a grouped mobile list**

Wrap item rows in a single rounded mobile surface, use separators between rows, and restore independent desktop cards through `lg:contents` and per-item `lg:` card classes:

```tsx
<div data-testid="box-item-list" className="overflow-hidden rounded-[1.25rem] bg-surface shadow-[inset_0_0_0_1px_rgba(79,64,48,0.06)] lg:contents">
  <article className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-line/60 p-3 last:border-b-0 lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-4">
```

Preserve accessible edit/delete names and all callbacks.

- [ ] **Step 4: Simplify the mobile empty state and bottom action**

Use an icon plus centered message without a border on mobile, restoring the existing dashed card on desktop. Keep the fixed safe-area add button and make its shape/touch treatment app-like without changing its behavior.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx
```

Expected: all `PublicBoxPage` tests PASS.

### Task 3: Regression and responsive verification

**Files:**
- Modify only if a regression is found: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify only if the documented contract needs correction: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`

- [ ] **Step 1: Run related unit tests**

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx src/features/boxes/BoxDetailPage.test.tsx src/visual-system.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run static verification**

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 3: Run the production build and E2E suite**

```bash
npm run build
npm run test:e2e
```

Expected: build succeeds; desktop and mobile projects pass with only documented conditional skips.

- [ ] **Step 4: Inspect mobile and desktop renders**

Open the existing local app at a phone-sized viewport and desktop viewport. Verify that mobile has no outer summary card or per-item card grid, while desktop retains the existing two-column summary and independent item cards.

- [ ] **Step 5: Commit implementation**

```bash
git add apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx docs/superpowers/plans/2026-08-01-mobile-box-detail-app.md
git commit -m "feat: redesign mobile box detail"
```
