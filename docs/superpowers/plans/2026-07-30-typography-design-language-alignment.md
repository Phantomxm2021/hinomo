# Typography and Design Language Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Nomo’s typography and supporting visual language with the approved warm-family reference across authenticated desktop and mobile pages.

**Architecture:** Define semantic font, type-scale, radius, border, and elevation tokens in Tailwind’s theme, then consume those tokens through a small set of repeated page-heading and surface patterns. Preserve the existing React structure, responsive breakpoints, data flow, and interaction behavior.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Vitest, Testing Library, Playwright.

---

### Task 1: Lock the visual language in theme tokens

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] Add failing assertions for the approved system font stack and semantic display, page-title, section-title, body, caption, border, and elevation tokens.
- [ ] Run `npm run test -- --run src/visual-system.test.ts` and confirm the new assertions fail because the semantic tokens are missing.
- [ ] Add the tokens to `@theme`, update base body/headings to use them, and keep the existing warm-family color values unchanged.
- [ ] Run the visual-system test, typecheck, and lint.

### Task 2: Align the shell, dashboard, and shared overlays

**Files:**
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`
- Modify: `apps/web/src/components/GlobalFindBar.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/features/profile/UserAccountMenu.tsx`
- Modify: `apps/web/src/components/ConfirmDialog.tsx`
- Modify: `apps/web/src/components/PageState.tsx`

- [ ] Add failing class-contract assertions for the display title, neutral eyebrow, section headings, card labels, navigation text, account menu, and dialog title.
- [ ] Run the focused tests and confirm the old ad-hoc utilities fail the new contracts.
- [ ] Replace the ad-hoc sizes and weights with the new semantic typography utilities; align search height, card border/radius, and overlay elevation to the reference.
- [ ] Run focused tests and verify desktop/mobile contracts remain intact.

### Task 3: Align business-page hierarchy

**Files:**
- Modify: `apps/web/src/features/spaces/SpacesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/items/ItemForm.tsx`
- Modify: `apps/web/src/features/search/SearchPage.tsx`
- Modify: `apps/web/src/features/scanner/ScannerPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: relevant co-located tests

- [ ] Add failing assertions that every management page uses the same neutral eyebrow, page-title, section-title, field-label, and metadata hierarchy.
- [ ] Run focused tests and confirm inconsistent page-specific typography fails.
- [ ] Apply semantic utilities without changing page structure, actions, queries, or mutations.
- [ ] Run the full Vitest suite, typecheck, lint, production build, and Playwright responsive suite.
- [ ] Compare computed typography and spacing against the approved desktop reference at 1024px and 1440px, then record any intentional responsive differences.
