# Global Apple Feedback and Reusable Venue Invites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify operation errors into one Apple-style desktop/mobile alert system and make venue invitations latest-only, reusable by multiple members until expiry/revocation/full capacity.

**Architecture:** Keep `MobileFeedbackProvider` as the compatibility shell while introducing one shared `AppleAlert` renderer and a typed feedback API. Normalize known Supabase errors before they reach UI. Extend the venue invite database model with a reusable flag and acceptance history; make `create_venue_invite` atomically revoke active invites and create the latest token under the existing venue advisory lock. Frontend mutations remain serialized and only replace the displayed QR/link after a successful RPC.

**Tech Stack:** React 18, TypeScript, TanStack Query, React Router, Tailwind utility classes, Supabase/Postgres PL/pgSQL, pgTAP, Vitest, Playwright.

---

## File Map

- Create: `apps/web/src/components/AppleAlert.tsx` — shared cross-device alert dialog, focus/escape/scroll behavior.
- Modify: `apps/web/src/components/MobileFeedbackProvider.tsx` — render the shared alert for both breakpoints and dedupe by alert key.
- Modify: `apps/web/src/components/mobile-feedback.ts` — add typed `FeedbackErrorOptions`, `error`, `confirm`, and stable dismissal semantics while preserving existing call sites.
- Modify: `apps/web/src/components/ResponsiveOperationError.tsx` — become a compatibility adapter that opens the shared alert instead of rendering a desktop-only duplicate.
- Modify: `apps/web/src/components/MobileAlert.tsx`, `apps/web/src/components/MobileFeedbackProvider.test.tsx`, `apps/web/src/components/ResponsiveOperationError.test.tsx` — migrate and prove shared behavior.
- Create: `apps/web/src/lib/feedback-errors.ts` and `apps/web/src/lib/feedback-errors.test.ts` — recursive Supabase/network error classification and localized message keys.
- Modify: `apps/web/src/app/providers.tsx` — mount the cross-device provider at the existing application boundary.
- Modify: `apps/web/src/features/auth/ForgotPasswordPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `ResetPasswordPage.tsx`, `apps/web/src/features/boxes/BoxForm.tsx`, `BoxesPage.tsx`, `PublicBoxPage.tsx`, `apps/web/src/features/credits/CreditsPage.tsx`, `apps/web/src/features/items/ItemForm.tsx`, `apps/web/src/features/packing/PackingCapturePage.tsx`, `apps/web/src/features/qr-print/PrintPage.tsx`, `apps/web/src/features/scanner/ScannerPage.tsx`, `apps/web/src/features/search/SearchPage.tsx`, and `apps/web/src/features/spaces/SpacesPage.tsx` only where they currently create duplicate inline operation errors; preserve field validation and page `PageState`.
- Create: `supabase/migrations/202608090006_reusable_venue_invites.sql` — forward-only reusable invite schema and RPC changes.
- Modify: `supabase/tests/database/019_venue_family_sharing.test.sql`, `supabase/tests/database/007_api_privileges.test.sql` — reusable invite, acceptance-history, latest-only, and privilege contracts.
- Modify: `apps/web/src/lib/database.types.ts`, `apps/web/src/lib/database.types.test-d.ts` — generated-style table/RPC type additions.
- Modify: `apps/web/src/features/venues/venue-sharing.api.ts`, `apps/web/src/features/venues/venue-sharing.api.test.ts` — invite result/status types and RPC mapping.
- Modify: `apps/web/src/features/venues/VenueCardMenu.tsx`, `VenueMembersPage.tsx`, `VenueInviteDialog.tsx` and their tests — serialized create/revoke/share behavior and Apple error routing.
- Modify: `apps/web/src/i18n/messages.ts`, `apps/web/src/i18n/messages.test.ts` — bilingual alert and reusable-invite copy.
- Modify/Create: `apps/web/e2e/box-entitlement.spec.ts` or a focused `apps/web/e2e/venue-family-sharing.spec.ts` plus mock routes — desktop/iPhone/Pixel invite replacement and multi-member acceptance flows.

## Task 1: Define failing feedback contracts

**Files:**
- Modify: `apps/web/src/components/MobileFeedbackProvider.test.tsx`
- Create: `apps/web/src/lib/feedback-errors.test.ts`
- Modify: `apps/web/src/components/ResponsiveOperationError.test.tsx`

- [ ] **Step 1: Write failing tests for the shared alert contract.** Assert that `FeedbackProvider`/compatibility provider renders one `role="alertdialog"` at desktop and mobile widths, focuses the primary action, restores focus after dismissal, closes on Escape, prevents duplicate identical alerts, and supports cancel/retry buttons.

- [ ] **Step 2: Write failing error-normalizer tests.** Use errors shaped as `{ code: 'venue_member_limit_reached' }`, nested `{ cause: { message: 'venue_invite_expired' } }`, `{ code: '42501' }`, `TypeError('Failed to fetch')`, and an unknown Error. Assert each maps to a stable message key and never exposes raw Supabase text.

- [ ] **Step 3: Run the focused RED suite.**

  Run: `npm test -- --run src/components/MobileFeedbackProvider.test.tsx src/components/ResponsiveOperationError.test.tsx src/lib/feedback-errors.test.ts`

  Expected: FAIL because the shared provider/error classifier does not yet expose the new API and desktop currently renders a separate implementation.

- [ ] **Step 4: Commit the RED contract.**

  ```bash
  git add apps/web/src/components/MobileFeedbackProvider.test.tsx apps/web/src/components/ResponsiveOperationError.test.tsx apps/web/src/lib/feedback-errors.test.ts
  git commit -m "test: define global apple feedback contracts"
  ```

## Task 2: Implement the shared Apple alert layer

**Files:**
- Create: `apps/web/src/components/AppleAlert.tsx`
- Modify: `apps/web/src/components/mobile-feedback.ts`
- Modify: `apps/web/src/components/MobileFeedbackProvider.tsx`
- Modify: `apps/web/src/components/MobileAlert.tsx`
- Modify: `apps/web/src/components/ResponsiveOperationError.tsx`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/components/MobileFeedbackProvider.test.tsx`, `apps/web/src/components/ResponsiveOperationError.test.tsx`

- [ ] **Step 1: Implement `AppleAlert` with the existing overlay z-index.** Render a portal with `role="alertdialog"`, `aria-modal`, generated title/description IDs, Apple-style centered card, optional cancel/primary actions, focus capture, body-scroll lock, Escape cancellation, and focus restoration. Do not close by clicking the backdrop on destructive/retry alerts.

- [ ] **Step 2: Extend the feedback API without breaking current consumers.** Add:

  ```ts
  type FeedbackErrorOptions = {
    key: string
    title: string
    message?: string
    retry?: () => void | Promise<void>
  }
  type MobileFeedbackApi = {
    notify: (message: string) => void
    showAlert: (options: MobileAlertOptions) => void
    showActionSheet: (options: MobileSheetOptions) => void
    error: (options: FeedbackErrorOptions) => void
    confirm: (options: MobileAlertOptions) => void
    dismiss: () => void
  }
  ```

  `showAlert` remains an alias-compatible path during migration. All new `error` and `confirm` calls replace the current alert state instead of queueing another alert with the same key.

- [ ] **Step 3: Make `MobileFeedbackProvider` render `AppleAlert` at all breakpoints.** Remove the desktop-only duplicate portal from `ResponsiveOperationError`; keep that component as an adapter which calls `feedback.error` and returns `null`. Keep `MobileActionSheet` unchanged except for shared overlay precedence.

- [ ] **Step 4: Run the focused GREEN suite.**

  Run: `npm test -- --run src/components/MobileFeedbackProvider.test.tsx src/components/ResponsiveOperationError.test.tsx src/lib/feedback-errors.test.ts`

  Expected: all new and existing feedback tests PASS; no duplicate `alertdialog` exists at either viewport.

- [ ] **Step 5: Commit the shared layer.**

  ```bash
  git add apps/web/src/components/AppleAlert.tsx apps/web/src/components/MobileAlert.tsx apps/web/src/components/MobileFeedbackProvider.tsx apps/web/src/components/ResponsiveOperationError.tsx apps/web/src/components/mobile-feedback.ts apps/web/src/app/providers.tsx apps/web/src/components/MobileFeedbackProvider.test.tsx apps/web/src/components/ResponsiveOperationError.test.tsx apps/web/src/lib/feedback-errors.test.ts
  git commit -m "feat: unify operation feedback as apple alerts"
  ```

## Task 3: Normalize errors and migrate operation consumers

**Files:**
- Create: `apps/web/src/lib/feedback-errors.ts`
- Modify: operation-error consumers listed in the File Map
- Modify: `apps/web/src/i18n/messages.ts`, `apps/web/src/i18n/messages.test.ts`
- Test: affected feature tests that currently assert inline `role="alert"` operation errors.

- [ ] **Step 1: Implement the normalizer.** Walk `error`, `cause`, `message`, `details`, and `code` with cycle protection. Map stable domain codes first, then `42501`, fetch/network failures, and finally `common.operationError`; return `{ titleKey, messageKey, retryable }`.

- [ ] **Step 2: Add bilingual keys.** Add Apple-alert titles/messages for network failure, permission denied, invite member limit, expired/revoked/missing invite, save/delete/share failure, and retry/cancel/OK labels. Keep field-level validation keys unchanged.

- [ ] **Step 3: Replace duplicate operation-error renderers.** For a query with retry, call `feedback.error({ key: 'boxes.refresh', title: t('common.operationFailed'), message: t('boxes.refreshError'), retry: () => void boxesQuery.refetch() })`; for a one-shot mutation omit `retry`. Use each consumer’s existing query/mutation names. Remove only duplicate operation-error JSX; keep `PageState` for initial page loading/empty/error and keep `role="alert"` beside invalid form fields.

- [ ] **Step 4: Add a regression for global replacement.** Trigger two different feature errors in the same provider and assert the latest alert replaces the previous one; trigger the same key twice and assert only one dialog exists.

- [ ] **Step 5: Run affected GREEN checks.**

  Run: `npm test -- --run src/components src/features/auth src/features/boxes src/features/items src/features/packing src/features/search src/features/spaces src/features/venues src/features/credits src/features/scanner src/features/qr-print src/i18n/messages.test.ts`

  Expected: all affected tests PASS with one shared `alertdialog` behavior.

- [ ] **Step 6: Commit the consumer migration.**

  ```bash
  git add apps/web/src apps/web/src/i18n/messages.ts
  git commit -m "refactor: route operation errors through global feedback"
  ```

## Task 4: Add reusable latest-only invite database behavior

**Files:**
- Create: `supabase/migrations/202608090006_reusable_venue_invites.sql`
- Modify: `supabase/tests/database/019_venue_family_sharing.test.sql`
- Modify: `supabase/tests/database/007_api_privileges.test.sql`
- Modify: `apps/web/src/lib/database.types.ts`, `apps/web/src/lib/database.types.test-d.ts`

- [ ] **Step 1: Add RED pgTAP contracts before the migration.** Extend 019 with assertions for: new invites are reusable; creating invite B revokes active invite A; invite A cannot be accepted after replacement; invite B accepts for member A and member B; same member returns `already_member`; capacity stops the next accept; expired/revoked/replacement states are distinct; acceptance history records both members. Extend 007 to deny direct access to the new acceptance table and assert authenticated execute only for the RPCs.

- [ ] **Step 2: Run the database RED command.**

  Run: `npm run test:db`

  Expected: the new assertions fail because the migration and acceptance table do not exist. If local Postgres is unavailable, record the exact connection refusal and continue with static SQL review; do not claim pgTAP passed.

- [ ] **Step 3: Implement the forward-only migration.** Add `reusable boolean not null default false` to `public.venue_invites` and a private `venue_invite_acceptances` table keyed by `(invite_id, user_id)`. Replace `create_venue_invite` body under the existing advisory lock so it revokes active invitations, inserts a `reusable = true` invite, writes audit, and returns only the new token. Update `accept_venue_invite` to allow repeated acceptance only for `reusable = true`, re-check capacity on every call, insert one membership plus one acceptance row, and preserve `already_member`, expiry, revocation, owner, and full errors. Keep pre-existing accepted invites single-use by leaving their `reusable` default false.

- [ ] **Step 4: Update list/inspect/revoke status and privileges.** Active reusable invites report `active` until expiry, revoke, or full capacity; direct table access remains denied; authenticated users can only execute the public RPCs. Add matching generated-style table/RPC types and compile-time assertions.

- [ ] **Step 5: Run GREEN/static checks.**

  Run: `npm run test:db` and `npm run typecheck`

  Expected: pgTAP passes when Supabase is running; otherwise the report records the runtime blocker while TypeScript and SQL static checks pass.

- [ ] **Step 6: Commit the database contract.**

  ```bash
  git add supabase/migrations/202608090006_reusable_venue_invites.sql supabase/tests/database/019_venue_family_sharing.test.sql supabase/tests/database/007_api_privileges.test.sql apps/web/src/lib/database.types.ts apps/web/src/lib/database.types.test-d.ts
  git commit -m "feat: make venue invites reusable and latest-only"
  ```

## Task 5: Wire the invitation API and latest-only UI

**Files:**
- Modify: `apps/web/src/features/venues/venue-sharing.api.ts`
- Modify: `apps/web/src/features/venues/venue-sharing.api.test.ts`
- Modify: `apps/web/src/features/venues/VenueCardMenu.tsx`
- Modify: `apps/web/src/features/venues/VenueMembersPage.tsx`
- Modify: `apps/web/src/features/venues/VenueInviteDialog.tsx`
- Modify: `apps/web/src/features/venues/VenuesPage.test.tsx`, `apps/web/src/features/venues/VenueMembersPage.test.tsx`, `apps/web/src/features/venues/VenueInviteDialog.test.tsx`

- [ ] **Step 1: Add RED API/UI tests.** Assert the API parses a reusable invite result; clicking the create button ten times while the promise is pending calls the RPC once; a second completed creation replaces the displayed token; the invite list has at most one active row; copy/share controls are disabled while busy; share failure calls `feedback.error` rather than rendering raw Supabase text.

- [ ] **Step 2: Extend invite types and API mapping.** Add `reusable`/`accepted_count` only where returned by the RPC, keep token data out of query caches, and preserve `isVenueInviteError` classification for capacity/expiry/revocation/full errors.

- [ ] **Step 3: Implement serialized latest-only creation.** Keep a single `invitePending` guard in both card menu and member page. On success replace local invite state and invalidate `venue-invites`; on error leave an existing invite visible and call the shared feedback API. Ensure closing a menu/dialog cannot create a second request or restore an older token.

- [ ] **Step 4: Update the invite dialog.** Show copy/share buttons against the latest token only; disable both while their promise is pending; route clipboard/share exceptions to `feedback.error`; show copy/share affordances and “可邀请多位家庭成员” copy for reusable invites; keep revoke as a destructive confirmation handled by `AppleAlert`.

- [ ] **Step 5: Run GREEN checks.**

  Run: `npm test -- --run src/features/venues/venue-sharing.api.test.ts src/features/venues/VenuesPage.test.tsx src/features/venues/VenueMembersPage.test.tsx src/features/venues/VenueInviteDialog.test.tsx src/components/MobileFeedbackProvider.test.tsx`

  Expected: all tests PASS; rapid clicks produce one RPC call and the latest invite replaces the old UI state.

- [ ] **Step 6: Commit the invite UI.**

  ```bash
  git add apps/web/src/features/venues apps/web/src/i18n/messages.ts
  git commit -m "feat: support reusable latest venue invitations"
  ```

## Task 6: Add browser and release verification

**Files:**
- Modify/Create: `apps/web/e2e/venue-family-sharing.spec.ts`, `apps/web/e2e/mock-backend.ts`

- [ ] **Step 1: Add RED browser scenarios.** Cover desktop, iPhone, and Pixel: owner opens card menu, creates an invite, taps create repeatedly, sees one latest QR; second creation invalidates the first; two separate authenticated member contexts accept the same QR; the third/fourth accept is blocked only when the five-seat limit is reached; copy/share failure opens the Apple alert.

- [ ] **Step 2: Update mock backend state.** Track invite `token`, `reusable`, `revokedAt`, `expiresAt`, and accepted user IDs per venue. Reject replaced tokens, allow distinct users until capacity, return `already_member` for repeats, and make direct invite writes return 403 so browser flows use the RPC path.

- [ ] **Step 3: Run focused GREEN browser checks.**

  Run: `npm run test:e2e -- e2e/venue-family-sharing.spec.ts --project=chromium --project=iphone --project=pixel`

  Expected: all new invite scenarios pass on all three projects.

- [ ] **Step 4: Run the full verification suite.**

  ```bash
  npm run typecheck
  npm run lint
  npm test -- --run
  npm run build
  npm run test:e2e
  npm run test:db
  git diff --check HEAD
  ```

  Expected: typecheck, lint, Vitest, build, and E2E exit 0. DB tests must either pass or report the concrete local Supabase/Postgres blocker; no blocked command may be represented as passed.

- [ ] **Step 5: Commit verification-only changes.**

  ```bash
  git add apps/web/e2e/venue-family-sharing.spec.ts apps/web/e2e/mock-backend.ts
  git commit -m "test: verify reusable venue invite flows"
  ```

## Self-review checklist

- Spec coverage: AppleAlert and global provider are Tasks 1–3; latest-only and reusable invite semantics are Tasks 4–5; multi-device acceptance and release checks are Task 6.
- No raw Supabase error is intentionally exposed; known error codes map through `feedback-errors.ts`.
- `create_venue_invite` and `accept_venue_invite` keep their public signatures; new behavior is forward-only and old accepted invites remain single-use.
- Feedback API names are consistent across Tasks 2, 3, and 5 (`error`, `confirm`, `dismiss`); invitation state names are consistent (`invitePending`, `invite`, `reusable`).
- Field validation and initial page `PageState` remain explicitly out of the global-alert migration.
