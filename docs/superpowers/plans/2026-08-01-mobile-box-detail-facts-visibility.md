# Mobile Box Detail Facts Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the location, note, and item-count information card on mobile box details while preserving it on desktop.

**Architecture:** Keep the existing details group and data intact. Mark the group with a stable test identifier, hide it by default, and use `lg:contents` to restore the current desktop grid behavior.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: Add the responsive visibility contract

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this assertion to the public-box detail rendering test:

```tsx
expect(screen.getByTestId('box-detail-facts')).toHaveClass('hidden', 'lg:contents')
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx
```

Expected: FAIL because the facts group has no identifier or mobile hiding classes.

### Task 2: Hide the mobile facts group

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`

- [ ] **Step 1: Implement the exact responsive wrapper**

Change the existing location/note/count wrapper to:

```tsx
<div data-testid="box-detail-facts" className="hidden lg:contents">
```

Keep its three existing paragraphs unchanged.

- [ ] **Step 2: Run focused tests and verify GREEN**

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx
```

Expected: all detail-page tests PASS.

### Task 3: Verify and commit

**Files:**
- Modify only if a regression is found: `apps/web/src/features/boxes/PublicBoxPage.tsx`

- [ ] **Step 1: Run verification**

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx docs/superpowers/plans/2026-08-01-mobile-box-detail-facts-visibility.md
git commit -m "feat: hide mobile box detail facts"
```
