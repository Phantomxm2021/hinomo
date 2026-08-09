# Venue invite and activity modal implementation plan

## Goal

Remove the visible invitation-revoke controls and change the venue-card “家庭成员” and “最近活动” actions from route navigation to Apple-style in-place dialogs, while preserving existing member/activity data contracts, permission cleanup, retry behavior, and the compatibility activity deep link.

## Architecture

- Keep `VenueCardMenu` as the interaction owner for menu open/close and the selected overlay.
- Reuse `ResponsiveEditorDialog` for the two overlays so focus trapping, Escape, backdrop behavior, body scroll locking, desktop/mobile presentation, and focus restoration stay consistent with the rest of the app.
- Extract query/mutation/rendering bodies from the route pages into modal-safe content components. The route pages remain thin compatibility wrappers and keep their existing URLs. Modal content reports `busy` through an `onBusyChange` callback so the outer dialog can block backdrop/Escape dismissal during a mutation or initial activity request.
- Keep invite creation, QR generation, copy, share, reusable-invite copy, and global Apple feedback. Remove only visible revoke UI and its UI-only mutation wiring; keep the revoke RPC/API and historical backend behavior intact.

## Tech Stack

React, TypeScript, React Router, TanStack Query, Vitest/Testing Library, existing `ResponsiveEditorDialog`, existing i18n and global Apple feedback provider.

## Task 1 — Remove visible invitation revoke actions

Files:

- `apps/web/src/features/venues/VenueInviteDialog.tsx`
- `apps/web/src/features/venues/VenueInviteDialog.test.tsx`
- `apps/web/src/features/venues/VenueMembersPage.tsx`
- `apps/web/src/features/venues/VenueMembersPage.test.tsx`

Steps:

1. Add RED assertions that the invite dialog has no revoke button/danger footer in both Chinese and English, and that the members page active-invite row has no revoke action.
2. Keep tests for QR loading/retry, copy/share mutex, reusable-invite copy, and invite-create errors unchanged or move them to the smallest affected fixture.
3. Remove `VenueInviteDialog` revoke state, confirmation handler, revoke mutation call, and revoke-only explanatory markup. Do not delete `revokeVenueInvite` from the API or database contracts.
4. Remove the members-page visible active-invite revoke state, mutation, confirmation/retry handlers, and button. Preserve active-invite status/count/expiry and invite creation.
5. Run focused invite/member tests and typecheck; commit as `refactor: remove visible venue invite revoke actions`.

## Task 2 — Extract reusable members content and add the members dialog

Files:

- `apps/web/src/features/venues/VenueMembersPage.tsx`
- `apps/web/src/features/venues/VenueMembersPanel.tsx` (new)
- `apps/web/src/features/venues/VenueMembersPage.test.tsx`
- `apps/web/src/features/venues/VenueMembersPanel.test.tsx` (new, if extraction needs isolated coverage)
- `apps/web/src/features/venues/VenueCardMenu.tsx`

Steps:

1. Add RED tests for selecting “家庭成员” from a venue-card menu: the menu closes immediately, a dialog appears without changing `window.location`, the dialog has a close button, and member content/actions still render.
2. Add RED tests for Escape, backdrop click, focus restoration, and mutation-pending behavior. Backdrop/Escape must not close while remove-member or leave-venue confirmation/mutation is pending.
3. Extract the current access/member/invite queries, owner/member controls, leave/remove confirmations, invite creation, access-denied cleanup, and retry page states into `VenueMembersPanel` with a presentation mode suitable for a dialog. Keep query keys and mutation callbacks unchanged; expose `onBusyChange` and include remove/leave/invite mutation pending state in it.
4. Make `VenueMembersPage` render the panel as the existing full-page route, preserving `/app/venues/:venueId/members` and its current route tests.
5. Add `membersOpen` state to `VenueCardMenu`; replace the members `Link` with a menu button that closes the menu before opening the modal. Render `ResponsiveEditorDialog` with the venue name/title, a `membersBusy` state updated by the panel callback, and the panel as children.
6. Run focused card/member tests and typecheck; commit as `feat: open venue members in place`.

## Task 3 — Extract reusable activity content and add the activity dialog

Files:

- `apps/web/src/features/venues/VenueActivityPage.tsx`
- `apps/web/src/features/venues/VenueActivityPanel.tsx` (new)
- `apps/web/src/features/venues/VenueActivityPage.test.tsx`
- `apps/web/src/features/venues/VenueActivityPanel.test.tsx` (new, if extraction needs isolated coverage)
- `apps/web/src/features/venues/VenueCardMenu.tsx`
- `apps/web/src/app/router.test.tsx` (only if route assertions need explicit compatibility coverage)

Steps:

1. Add RED tests for selecting “最近活动” from the venue-card menu: the menu closes, an in-place dialog opens, the URL remains the app venue URL, and the dialog title/close control are present.
2. Add RED tests that filters preserve the existing actor/event values, reset the infinite-query cursor, load more with the final `(created_at, id)` tuple, deduplicate entries, and show all five localized event labels.
3. Add RED tests for ordinary load errors with retry and `venue_access_denied` cache removal plus safe navigation. Verify the dialog cannot be dismissed through backdrop/Escape while an activity request is in flight, but can close normally after it settles.
4. Extract the existing activity query, filters, tuple pagination, dedupe, formatter, departed-member display, and permission cleanup into `VenueActivityPanel`. Keep the route page as a wrapper around the panel so the deep link remains valid; expose `onBusyChange` and report initial/load-more/refetch activity requests while they are pending.
5. Add `activityOpen` state to `VenueCardMenu`; replace the activity `Link` with a menu button that closes the menu before opening the modal. Render the panel in `ResponsiveEditorDialog` with a venue-specific title and an `activityBusy` state updated by the panel callback.
6. Run focused activity/card/router tests and typecheck; commit as `feat: open venue activity in place`.

## Task 4 — Integration verification and review

Files to inspect:

- `apps/web/src/features/venues/VenueCardMenu.tsx`
- `apps/web/src/features/venues/VenueInviteDialog.tsx`
- `apps/web/src/features/venues/VenueMembersPanel.tsx`
- `apps/web/src/features/venues/VenueActivityPanel.tsx`
- `apps/web/src/features/venues/VenueMembersPage.tsx`
- `apps/web/src/features/venues/VenueActivityPage.tsx`
- affected tests and i18n files only when required by the implementation

Steps:

1. Run the focused suites for venues, members, activity, invite dialog, and router compatibility.
2. Run the full web Vitest suite, web typecheck, lint, and production build.
3. Run `git diff --check` and inspect the final diff for stale revoke buttons, route changes, duplicate query keys, modal focus regressions, or accidental backend/API deletion.
4. If a test exposes a regression, add a failing regression test first, make the smallest fix, and rerun the affected suite.
5. Write the final implementation report with test evidence and any environment-only blockers; commit verification changes separately from feature changes when practical.

## Definition of done

- No visible revoke action remains in the invite dialog or member invite list, while revoke API/database behavior remains available.
- Venue-card member/activity actions open Apple-style dialogs in place, close the menu immediately, and do not navigate.
- Existing member mutations, activity filters/pagination, retry behavior, access-denied cleanup, and activity deep-link route remain functional.
- Focus, Escape, backdrop, pending mutation, i18n, typecheck, lint, tests, and build are verified.
