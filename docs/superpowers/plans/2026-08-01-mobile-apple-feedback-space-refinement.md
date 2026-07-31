# Mobile Apple Feedback and Space Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine venue behavior, empty states, dashboard placement, floor-plan resizing, and mobile-only feedback/visual patterns without changing the established desktop layout.

**Architecture:** Keep the existing Supabase venue and layout models. Relax only the default venue update rule while retaining delete protection; derive empty states from the selected venue; extend `SpaceMap` with axis-specific resize interactions. Add a shared mobile feedback layer at `AppShell`, rendering Apple-style transient notices, alerts, and action sheets below `lg`, while existing desktop feedback remains available above `lg`.

**Tech Stack:** React 19, TypeScript, TanStack Query, React Router, Tailwind CSS, Supabase/PostgreSQL, Vitest, Testing Library, Playwright.

---

### Task 1: Default Venue Rename Without Delete

**Files:**
- Modify: `supabase/migrations/202608010003_default_venue.sql`
- Modify: `apps/web/src/features/venues/VenueEditorDialog.tsx`
- Modify: `apps/web/src/features/venues/VenueEditorDialog.test.tsx`
- Modify: `apps/web/src/features/venues/VenueFilterBar.tsx`
- Modify: `apps/web/src/features/venues/VenueFilterBar.test.tsx`

- [ ] **Step 1: Write failing tests** asserting the default venue has an edit trigger, editable name/description fields, an enabled save button, and no enabled delete action.
- [ ] **Step 2: Run** `npm test -- src/features/venues --run`; expect failures from the current read-only default venue.
- [ ] **Step 3: Implement** editable default venue UI. Keep `is_default` immutable by revoking table-wide update and granting authenticated users column updates for `name` and `description`; allow owner update policy for both default and non-default rows; retain `and not is_default` in delete policy.
- [ ] **Step 4: Run** venue tests, typecheck, and lint; expect exit 0.
- [ ] **Step 5: Commit** with `feat: allow renaming default venue`.

### Task 2: Venue-Scoped Empty State and Dashboard Placement

**Files:**
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`

- [ ] **Step 1: Write failing tests** for a selected venue with zero spaces while another venue has spaces. Assert a plain empty state, no empty-state create button, and no view controls or floor plan.
- [ ] **Step 2: Write a dashboard test** asserting the mobile venue selector and `空间总览` eyebrow share one row; desktop search/title grid classes remain unchanged.
- [ ] **Step 3: Implement** empty rendering from `visibleSpaces.length`, not global `spaces.length`. Keep the header plus button as the only creation entry.
- [ ] **Step 4: Recompose the dashboard header** as a three-row mobile grid (`eyebrow + venue`, title, search) and the existing two-column desktop grid (`eyebrow/title`, venue/search).
- [ ] **Step 5: Run** space/dashboard tests and commit with `fix: refine venue empty and dashboard layout`.

### Task 3: Independent Floor-Plan Width and Length Resizing

**Files:**
- Modify: `apps/web/src/features/spaces/SpaceMap.tsx`
- Modify: `apps/web/src/features/spaces/SpaceMap.test.tsx`
- Modify: `apps/web/src/features/spaces/space-layout.ts`
- Modify: `apps/web/src/features/spaces/space-layout.test.ts`

- [ ] **Step 1: Write failing pointer and keyboard tests** for a right-edge width handle and bottom-edge length handle; assert one axis changes while the other remains fixed.
- [ ] **Step 2: Extend interaction state** with `axis: 'width' | 'height' | 'both'`; calculate deltas with `constrainResize`, zeroing the unused axis.
- [ ] **Step 3: Render three accessible handles** (`调整…宽度`, `调整…长度`, `调整…大小`) only during layout editing, each with touch-safe hit areas and pointer capture.
- [ ] **Step 4: Verify** each pointer-up persists exactly one `SpacePosition` through `onLayoutChange`.
- [ ] **Step 5: Run** layout tests and commit with `feat: resize floor plan by axis`.

### Task 4: Mobile Feedback Primitives

**Files:**
- Create: `apps/web/src/components/MobileFeedbackProvider.tsx`
- Create: `apps/web/src/components/MobileFeedbackProvider.test.tsx`
- Create: `apps/web/src/components/MobileAlert.tsx`
- Create: `apps/web/src/components/MobileActionSheet.tsx`
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`

- [ ] **Step 1: Write failing component tests** for a top notice that auto-dismisses, a blocking alert with retry/cancel, and a bottom action sheet with primary/secondary recovery actions.
- [ ] **Step 2: Implement a context API** exposing `notify`, `alert`, and `actionSheet`; use portals, focus management, Escape handling, safe-area padding, and `aria-live`/`alertdialog` semantics.
- [ ] **Step 3: Mount the provider** once inside `AppShell`. Restrict visual rendering to mobile with `lg:hidden`; do not alter desktop navigation or content grid.
- [ ] **Step 4: Run** component and AppShell tests; commit with `feat: add mobile feedback system`.

### Task 5: Replace Mobile Inline Operation Feedback

**Files:**
- Modify: `apps/web/src/components/PageState.tsx`
- Modify: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxDetailPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: `apps/web/src/features/media/AuthorizedImage.tsx`
- Test: corresponding `*.test.tsx` files

- [ ] **Step 1: Add failing mobile feedback tests**: creation/upload success uses notice; blocking load error uses alert; upload failure uses action sheet; retry progress stays in the action control, not as page text.
- [ ] **Step 2: Route mutation outcomes** through `useMobileFeedback`. Preserve inline field validation because it belongs next to the invalid control.
- [ ] **Step 3: Keep desktop inline states** under `hidden lg:*` equivalents and mobile dialogs under `lg:hidden`, so desktop behavior and layout remain unchanged.
- [ ] **Step 4: Ensure retained cached content remains visible** behind non-blocking alerts and retries do not discard forms or query cache.
- [ ] **Step 5: Run** affected tests and commit with `refactor: use app-style mobile feedback`.

### Task 6: Apple-Style Mobile Visual Audit

**Files:**
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: authenticated page components under `apps/web/src/features/**/**Page.tsx`
- Modify: `apps/web/src/styles.css` only for shared mobile primitives that cannot be expressed locally
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: Add E2E assertions** for 44pt minimum controls, safe-area navigation, grouped inset cards, mobile sheets, and absence of horizontal overflow at 320/360/390/768px.
- [ ] **Step 2: Apply mobile-only classes** for iOS large-title hierarchy, 16–20px gutters, grouped backgrounds, continuous-style rounded cards, subdued separators, and bottom-tab geometry. Prefix all changed desktop-sensitive rules with responsive `lg:` restoration.
- [ ] **Step 3: Remove redundant mobile header actions** where the same primary action already exists in the title row or system sheet; keep desktop controls unchanged.
- [ ] **Step 4: Run** `npm test -- --run && npm run typecheck && npm run lint && npm run build`.
- [ ] **Step 5: Run** `npm run test:e2e`; expect all non-conditional tests to pass on desktop Chromium, Pixel, and iPhone.
- [ ] **Step 6: Request code review**, fix all Critical/Important findings, and commit with `feat: align mobile app interaction`.
