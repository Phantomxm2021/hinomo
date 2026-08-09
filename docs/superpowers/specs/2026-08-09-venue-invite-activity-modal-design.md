# Venue invite and activity modal design

## Goal

Simplify venue management without removing server-side safety controls:

- Remove the visible “Revoke invitation” action from invite surfaces.
- Open family members and recent activity from the venue management card as Apple-style overlays instead of navigating away.

## Interaction

The venue card remains the primary entry point. Its menu closes immediately after a menu action is selected.

The owner invite dialog keeps QR, copy, and share actions, expiry/reusable guidance, loading, retry, and global Apple feedback. It no longer renders a revoke button or revoke-specific explanatory footer. The revoke RPC and historical status handling remain available to backend/operational flows.

The “Family members” and “Recent activity” menu items open modal overlays in place. The members overlay reuses the existing member query and owner/member actions except visible invite revocation. The activity overlay reuses the existing activity query, member/event filters, tuple cursor pagination, departed-member labels, access-denied cleanup, and retryable errors. Both overlays:

- use the existing Apple visual language;
- trap focus, close with Escape and an explicit close button;
- close on backdrop click only when no mutation is pending;
- keep the current venue context and invalidate/remove the same venue-scoped query keys on revocation.

The existing `/app/venues/:venueId/activity` route remains as a compatibility/deep-link entry point and continues to render the activity page.

## Component boundaries

- `VenueCardMenu` owns menu state and overlay selection, and passes the selected venue id into overlay content.
- `VenueMembersPage` is split or adapted into a reusable modal-safe members view without changing its query/mutation contracts.
- `VenueActivityPage` is split or adapted into a reusable modal-safe activity view without changing its query/pagination contracts.
- `VenueInviteDialog` keeps only invite sharing actions and reusable-invite status copy.
- A shared responsive overlay primitive is preferred when it preserves existing focus, Escape, and responsive behavior; otherwise the existing dialog primitives are reused directly.

## Error and permission behavior

Non-revocation failures continue through the global Apple feedback layer with retry where the existing operation is retryable. `venue_access_denied` continues to remove venue-scoped caches and navigate safely to `/app`; the modal must not leave stale member/activity data visible after revocation.

## Acceptance tests

- Invite dialog has no visible revoke action in Chinese or English; QR/copy/share and retry behavior remain covered.
- Selecting members or activity closes the card menu and opens an in-place dialog without changing the URL.
- Activity filters reset pagination, load-more uses the existing tuple cursor, and five event labels remain localized.
- Members/activity overlays close via close button, Escape, and backdrop where allowed, and preserve focus restoration.
- Ordinary errors show the Apple alert; access denial clears venue caches and safely navigates.
- Existing deep-link activity route remains green.
