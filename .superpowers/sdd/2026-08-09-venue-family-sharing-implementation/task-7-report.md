# Task 7 report: single-use venue invitation join flow

## Delivered

- Added a tab-scoped invite-token helper. It reads only `#token=…`, immediately strips the fragment with `history.replaceState`, and stores the token only in `sessionStorage` under `nomo-pending-venue-invite`. It never uses `localStorage`.
- Added the public `/join/venue` route outside `RequireAuth`. The join page inspects the pending token, presents venue and owner context while anonymous, restores sign-in/registration to the join route, and accepts only an active eligible invitation after authentication.
- Added explicit UI states for missing, expired, used, revoked, full, already-member, and owner invitations. A successful acceptance clears the tab token, invalidates `['venues']` and `['venue-access']`, then enters `/app`.
- Added a reusable invitation dialog with a QR URL containing the raw token only in its fragment, copy/share actions, no-share copy fallback, revoke action, busy protection, escape and focus handling via `ResponsiveEditorDialog`, and mobile safe-area padding.
- Centralized strict return-target validation for login and registration: only a single slash-prefixed internal path is accepted; protocol-relative and absolute targets return to `/app`. Registration preserves the target for both immediate sessions and the sign-in link.
- Added complete `venueSharing` Chinese/English catalog entries and targeted coverage for tokens, join states, auth restoration, route placement, dialog affordances, and translations.

## Verification

- RED: `npm test -- --run src/features/venues/venue-invite-session.test.ts src/features/venues/JoinVenuePage.test.tsx src/features/venues/VenueInviteDialog.test.tsx src/features/auth/LoginPage.test.tsx src/features/auth/RegisterPage.test.tsx src/app/router.test.tsx` failed as expected because the three invite modules and public route did not exist and registration did not preserve `returnTo`.
- GREEN: focused invite/auth/router/i18n suite — 7 files, 37 tests passed.
- Full web suite: `npm test -- --run` — 102 files, 690 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `git diff --check` — passed.

## Scope

- Member-management UI remains deliberately out of scope for this task.
