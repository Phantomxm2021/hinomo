# Mobile Box Detail Action Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile box details media-forward and consolidate owner actions into an iOS-style plus menu.

**Architecture:** `PublicBoxPage` owns responsive visibility and mobile action-sheet state. `ItemForm` owns selected-file and stored-image preview rendering, while retaining its existing upload mutation flow.

**Tech Stack:** React, TypeScript, Tailwind CSS, React Query, Vitest, Testing Library.

---

### Task 1: Lock the mobile navigation and media behavior

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`
- Modify: `apps/web/src/features/items/ItemForm.test.tsx`

- [x] **Step 1: Add failing page tests**

Assert that an owner sees only a plus menu trigger in the mobile navigation, the title includes the box name, and mobile box metadata plus the fixed add button are absent.

- [x] **Step 2: Add failing form tests**

Mock an existing item image and a selected local image; assert both render a preview with stable alternative text.

- [x] **Step 3: Run focused tests**

Run: `npm test -- --run src/features/boxes/PublicBoxPage.test.tsx src/features/items/ItemForm.test.tsx`

Expected: FAIL because the page still has separate buttons and the form has no previews.

### Task 2: Implement the responsive mobile interaction

**Files:**
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/items/ItemForm.tsx`

- [x] **Step 1: Add mobile action-menu state**

Use `MobileActionSheet` with `新增物品`, `编辑箱子` and `打印标签`; close the sheet before navigating or printing and preserve the desktop action region.

- [x] **Step 2: Refine mobile navigation and content visibility**

Render `箱子名称 · 箱子详情` in the navigation; hide the screenshot metadata at mobile widths and remove the fixed mobile add button.

- [x] **Step 3: Render item-image previews**

Use `AuthorizedImage` for existing R2 images. Create an object URL for a selected local file, revoke it when replaced/unmounted, and show it above the file control.

- [x] **Step 4: Run focused tests**

Run: `npm test -- --run src/features/boxes/PublicBoxPage.test.tsx src/features/items/ItemForm.test.tsx`

Expected: PASS.

### Task 3: Regression verification

**Files:**
- Modify if needed: `apps/web/e2e/core-flow.spec.ts`

- [x] **Step 1: Run static verification**

Run: `npm test -- --run && npm run typecheck && npm run lint && npm run build && git diff --check`

Expected: all commands exit 0.

- [x] **Step 2: Run responsive end-to-end verification**

Run: `npm run test:e2e`

Expected: desktop, iPhone and Pixel suites pass; existing device-conditional skips remain skipped.
