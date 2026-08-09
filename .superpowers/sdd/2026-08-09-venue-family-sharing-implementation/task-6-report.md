# Task 6 report: account-isolated venue sharing data layer

## Delivered

- Added `AccountQueryBoundary` inside `AuthProvider` and before locale/router rendering. It returns no account subtree while the authenticated user id changes, clears the `QueryClient` in a layout effect, and only then permits rendering. The regression tests cover account-to-account switches and logout with private `['venues']` data already cached.
- Added `venue-sharing.api.ts` with typed access, member, invite, and invite-preview models plus RPC wrappers for all sharing operations. Single-row RPCs reject missing results explicitly. Recognized invite-domain errors are normalized to stable `VenueInviteErrorCode` values without granting fallback access.
- Switched `listVenues()` to `list_accessible_venues` and added owner, role, owner-display-name, membership-count, and maximum-member fields to `VenueSummary`.
- Scoped selected-venue local storage to `nomo-selected-venue-id:<userId>`. The dashboard, spaces, and boxes consumers now provide the authenticated user id. A user transition reloads that user’s selection before persisting any fallback, preventing one user’s preferred venue from replacing another’s stored choice.
- Updated existing test fixtures and page test wrappers to represent the expanded venue summary and authenticated selection context. No invite/member/activity interface was added.

## Verification

- RED: `npm test -- --run src/app/AccountQueryBoundary.test.tsx src/features/venues/venue-sharing.api.test.ts src/features/venues/venues.api.test.ts` failed as expected: the two new modules were unresolved and `listVenues` still used the table query.
- GREEN and affected consumers: `npm test -- --run src/app/AccountQueryBoundary.test.tsx src/features/venues/venue-sharing.api.test.ts src/features/venues/venues.api.test.ts src/features/spaces/SpacesPage.test.tsx src/features/boxes/BoxesPage.test.tsx src/features/dashboard/DashboardPage.test.tsx` — 123 passed.
- Complete web suite: `npm test -- --run` — 99 files, 663 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `git diff --check` — passed.

## Review follow-up

- Expanded `VenueInviteErrorCode` and its normalizer to preserve every relevant domain error emitted by the sharing RPCs in migration `202608090001`: `venue_invite_missing`, `venue_owner_cannot_join`, `venue_owner_cannot_remove`, `venue_member_not_found`, and `venue_owner_cannot_leave`, in addition to the originally covered codes.
- Added parameterized regression coverage proving each code is exposed on the thrown error and recognized by `isVenueInviteError`.
- RED: the five new cases failed because their raw RPC errors had no stable `code` property. Final focused verification passed: 24 tests across the account boundary, sharing API, and venue API; `npm run typecheck`, `npm run lint`, and `git diff --check` also passed.
