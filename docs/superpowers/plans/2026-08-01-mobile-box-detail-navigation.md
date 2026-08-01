# Mobile Box Detail Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an app-style mobile navigation bar to the box detail page and move owner edit/print tools into its right-side tool area without changing desktop presentation.

**Architecture:** Keep the navigation inside `PublicBoxPage` so it can reuse ownership, printing state, and routing data. Render a mobile-only sticky bar and retain the existing summary actions as desktop-only controls using the `lg` breakpoint.

**Tech Stack:** React, React Router, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright.

---

### Task 1: Define mobile navigation behavior

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`

- [ ] **Step 1: Add the owner navigation contract**

Assert that owners receive a mobile navigation landmark with Back, icon-only Edit, and Print tools, while the existing action group is desktop-only:

```tsx
const navigation = screen.getByRole('navigation', { name: '箱子详情导航' })
expect(within(navigation).getByRole('button', { name: '返回' })).toBeInTheDocument()
expect(within(navigation).getByRole('link', { name: '编辑箱子' })).toHaveTextContent('')
expect(within(navigation).getByRole('button', { name: '打印标签' })).toHaveTextContent('')
expect(screen.getByTestId('desktop-box-actions')).toHaveClass('hidden', 'lg:flex')
```

- [ ] **Step 2: Add the visitor permissions contract**

Assert that anonymous visitors see Back and the centered title but no Edit or Print tools inside the navigation.

- [ ] **Step 3: Add history-back coverage**

Render the detail page with `/previous` before `/b/public-1`, click Back, and assert the previous route renders.

- [ ] **Step 4: Run the focused test and verify RED**

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx
```

Expected: FAIL because the mobile navigation and desktop-only action contract do not exist.

### Task 2: Implement navigation and relocate mobile tools

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`

- [ ] **Step 1: Add history navigation**

Import `useNavigate`, create `const navigate = useNavigate()`, and wire the Back button to `navigate(-1)`.

- [ ] **Step 2: Add the mobile navigation bar**

Insert a mobile-only sticky navigation before error and summary content:

```tsx
<nav
  className="sticky top-0 z-20 -mx-4 -mt-3 grid min-h-14 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden"
  aria-label="箱子详情导航"
>
```

Use a 44px Back button, centered `箱子详情` label, and two 44px icon tools for owners. Keep an empty fixed-width right tool area for visitors.

- [ ] **Step 3: Make summary actions desktop-only**

Change the existing action group to:

```tsx
<div data-testid="desktop-box-actions" className="hidden lg:flex lg:flex-wrap lg:gap-2">
```

Preserve the desktop Edit, Print, and Add controls and all existing callbacks.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx
```

Expected: all tests PASS.

### Task 3: Verify responsive regression safety

**Files:**
- Modify only if a regression is found: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify only if the contract is incomplete: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`

- [ ] **Step 1: Run full unit and static checks**

```bash
npm test -- --run
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 2: Run production build and E2E**

```bash
npm run build
npm run test:e2e
```

Expected: build succeeds; desktop, iPhone, and Pixel projects pass with documented conditional skips.

- [ ] **Step 3: Commit implementation**

```bash
git add apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx docs/superpowers/plans/2026-08-01-mobile-box-detail-navigation.md
git commit -m "feat: add mobile box detail navigation"
```
