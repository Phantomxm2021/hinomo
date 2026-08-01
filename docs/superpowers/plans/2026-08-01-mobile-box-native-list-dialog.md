# Mobile Box Native List Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile box details use an Apple-style item list with bottom-sheet add/edit dialogs, while keeping desktop behavior unchanged.

**Architecture:** `PublicBoxPage` owns responsive placement: it hides the cover, converts rows into mobile list buttons, and wraps `ItemForm` in a mobile dialog. `ItemForm` only gains responsive surface classes and an optional edit-delete action, preserving mutation and upload logic.

**Tech Stack:** React, React Router, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: Lock mobile presentation and dialog behavior

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Modify: `apps/web/src/features/items/ItemForm.test.tsx`

- [x] **Step 1: Write failing detail tests**

Assert the cover is mobile-hidden, owner item rows are buttons, and opening new/edit items produces a dialog:

```tsx
expect(screen.getByTestId('box-cover')).toHaveClass('hidden', 'lg:block')
await user.click(screen.getByRole('button', { name: '编辑锤子' }))
expect(screen.getByRole('dialog', { name: '编辑物品' })).toBeInTheDocument()
```

- [x] **Step 2: Write failing form delete-action test**

Render an editing `ItemForm` with `onDelete` and assert its destructive action invokes the callback.

- [x] **Step 3: Run focused tests and verify RED**

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx src/features/items/ItemForm.test.tsx
```

Expected: FAIL because the cover remains mobile-visible, forms are inline, and `onDelete` does not exist.

### Task 2: Implement native list and bottom sheet

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/items/ItemForm.tsx`

- [x] **Step 1: Hide only the mobile cover**

Add `data-testid="box-cover"` and `hidden lg:block` to the existing cover wrapper.

- [x] **Step 2: Convert mobile rows to list buttons**

Render an owner item row as an accessible `button` on mobile, with thumbnail, name, single-line description, quantity and chevron. Keep the desktop article/card actions through `lg:` classes.

- [x] **Step 3: Wrap add/edit forms in a mobile dialog**

Place the existing form inside a fixed backdrop and bottom sheet for mobile:

```tsx
<div className="fixed inset-0 z-40 flex items-end bg-ink/30 lg:static lg:block lg:bg-transparent" role="dialog" aria-modal="true" aria-labelledby="item-form-title">
  <div className="max-h-[calc(100dvh-var(--safe-area-top))] w-full overflow-y-auto rounded-t-[1.5rem] bg-canvas pb-[max(1rem,var(--safe-area-bottom))] lg:max-h-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:pb-0">
```

- [x] **Step 4: Add edit delete action**

Add optional `onDelete` to `ItemForm`; show a `删除物品` button only when editing. Pass it from the detail page to set the existing delete target and close the sheet.

- [x] **Step 5: Run focused tests and verify GREEN**

```bash
npm test -- --run src/features/boxes/PublicBoxPage.test.tsx src/features/items/ItemForm.test.tsx
```

Expected: all focused tests PASS.

### Task 3: Full regression and commit

**Files:**
- Modify only if verification reveals a regression: the two implementation files and their tests.

- [x] **Step 1: Run verification**

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands exit successfully.

- [x] **Step 2: Run responsive E2E**

```bash
npm run test:e2e
```

Expected: desktop, iPhone, and Pixel projects pass with documented skips.

- [x] **Step 3: Commit**

```bash
git add apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx apps/web/src/features/items/ItemForm.tsx apps/web/src/features/items/ItemForm.test.tsx docs/superpowers/plans/2026-08-01-mobile-box-native-list-dialog.md
git commit -m "feat: use native mobile item list dialogs"
```
