# Task 8 report: venue family member management

## Delivered

- Added the protected `/app/venues/:venueId/members` page and route.
- The page fetches venue access and members in parallel. Owners additionally load active invites, can create an invite that opens the production `VenueInviteDialog`, revoke unused invites, and remove members after an explicit data/history-preserving confirmation.
- Raw invite credentials are held only in local component state. Every dialog close callback clears that state, including the dialog's revoke close path; invite creation deliberately bypasses React Query mutation state so the raw token is not retained in its cache.
- Members can view the roster and leave with a confirmation that explains their data/history remains. Successful remove/leave actions invalidate venues, access, membership, activity, spaces, boxes, items, and search data. Leaving also clears the venue cache and replaces navigation with `/app`.
- Any `venue_access_denied` result from the access, member, or owner-invite request removes the relevant venue caches and replaces navigation with `/app`, preventing retries of revoked access.
- Added shared-venue identification in venue cards and switcher entries, including the owner name. Member cards lead to the member page rather than the editor; owners retain editing and receive a family-members link.
- Added `family`, `history`, `share`, and `copy` icons, Chinese/English copy, and no activity link or route (Task 10 remains responsible for that surface).

## Verification

- RED: the new focused Task 8 tests failed before implementation for the missing page/route/icons/shared behavior. Review follow-up RED also failed for both serial member loading and raw invite tokens retained in mutation state.
- Final focused suite: `npm test -- --run src/features/venues/VenueMembersPage.test.tsx src/features/venues/VenuesPage.test.tsx src/features/venues/VenueSwitcher.test.tsx src/components/AppIcon.test.tsx src/app/router.test.tsx src/i18n/messages.test.ts` — 20 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Full web suite: `npm test -- --run` — 104 files, 705 tests passed.
- `git diff --check` — passed.

## Review follow-up

- The final review identified that revoked access could occur after the initial access lookup, that `useMutation` retained a raw invite token after close, and that member loading was unnecessarily serialized. The member page now handles denial from every access-dependent query, does not store the raw token in a mutation cache, and starts member loading in parallel with access lookup. Regression coverage was added for each behavior.
