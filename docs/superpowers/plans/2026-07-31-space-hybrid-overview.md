# Space Hybrid Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the compact space list with a polished card catalogue and an optional persistent 2D household overview.

**Architecture:** Keep `SpacesPage` responsible for queries and mutations, extract presentational `SpaceCard` and interactive `SpaceMap` components, and persist optional percentage-based positions in a separately migrated Supabase table. If layout storage is unavailable, the map uses deterministic automatic positions and the existing space workflow remains usable.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, TanStack Query 5, Supabase Postgres/RLS, Vitest, Testing Library, Playwright.

---

### Task 1: Add secure optional layout persistence

**Files:**
- Create: `supabase/migrations/202607310001_space_layouts.sql`
- Modify: `apps/web/src/lib/database.types.ts`
- Modify: `apps/web/src/features/spaces/spaces.api.ts`
- Modify: `apps/web/src/features/spaces/spaces.api.test.ts`

- [x] Add failing API tests that map layout rows, tolerate a missing layout table by returning `[]`, and upsert the signed-in owner’s percentages.
- [x] Run `npm run test -- --run src/features/spaces/spaces.api.test.ts` and confirm the new tests fail.
- [x] Add `space_layouts` with owner-only RLS, percentage checks, updated-at trigger and authenticated grants.
- [x] Add manual database types plus `listSpaceLayouts()` and `saveSpaceLayout()`; only missing-table/schema-cache errors may fall back to `[]`.
- [x] Re-run the API tests and typecheck.

### Task 2: Build the reusable card and 2D map

**Files:**
- Create: `apps/web/src/features/spaces/space-visuals.ts`
- Create: `apps/web/src/features/spaces/SpaceCard.tsx`
- Create: `apps/web/src/features/spaces/SpaceMap.tsx`
- Create: `apps/web/src/features/spaces/SpaceMap.test.tsx`

- [x] Add failing tests for stable 1–12 room auto-layout, room-specific graphics, correct box-filter links and arrow-key 2% movement.
- [x] Run the focused test and confirm the components/helpers are missing.
- [x] Implement deterministic percentage positions, warm room surfaces, a responsive card, and a relative 2D canvas.
- [x] Clamp and snap coordinates before invoking `onLayoutChange(spaceId, position)`; never access Supabase from the visual component.
- [x] Re-run focused tests, lint and typecheck.

### Task 3: Integrate both views into `SpacesPage`

**Files:**
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/spaces/SpacesPage.test.tsx`

- [x] Add failing tests for default card view, card/plan segmented control, local preference, layout edit mode and persistence mutation.
- [x] Run the focused page tests and confirm the current compact rows fail the new contract.
- [x] Query optional layouts, render `SpaceCard` in a 1/2/3-column catalogue, render `SpaceMap` in plan mode, and save changes with a dedicated mutation.
- [x] Preserve the existing create/edit/delete dialog, focus isolation, blocked deletion and query invalidation behavior unchanged.
- [x] Re-run all space page tests.

### Task 4: Verify responsive behavior and hand off SQL

**Files:**
- Modify: `apps/web/e2e/core-flow.spec.ts`
- Modify: `docs/superpowers/reports/2026-07-30-layout-style-followup-audit.md`

- [x] Extend E2E coverage to switch views at desktop and mobile widths, verify the plan contains the created room, and assert no horizontal overflow.
- [x] Run full Vitest, typecheck, lint and production build.
- [x] Run Playwright desktop/iPhone/Pixel and confirm all journeys pass.
- [x] Record the design rationale, fallback behavior and SQL handoff requirement in the audit report.
- [x] Commit the implementation without executing the Supabase migration; the user will run the supplied SQL.
