# Venue Invite Card Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let venue owners invite family members directly from each venue card, with an obvious disabled state when the rollout flag is off.

**Architecture:** Add a small `VenueInviteQuickAction` component that owns invite creation state and reuses the existing QR/share dialog. Restructure owner venue cards into a non-nested card plus action row; keep member cards read-only. Add bilingual labels and focused component/page regression coverage.

**Tech Stack:** React, React Router, TanStack Query, existing venue invite API/dialog, Vitest Testing Library, Tailwind utility classes.

---

### Task 1: Add the direct invite action and card layout

**Files:**
- Create: `apps/web/src/features/venues/VenueInviteQuickAction.tsx`
- Modify: `apps/web/src/features/venues/VenuesPage.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Test: `apps/web/src/features/venues/VenuesPage.test.tsx`

- [x] **Step 1: Write failing tests** for an owner card's direct invite action, disabled rollout state, and member card's absence of invite controls.
- [x] **Step 2: Run the focused test and verify the expected failures.**
- [x] **Step 3: Implement the quick-action component and restructure owner cards without nested interactive elements.
- [x] **Step 4: Run focused tests, typecheck, lint, and diff checks.
- [x] **Step 5: Commit with `feat: expose venue invites on cards`.
