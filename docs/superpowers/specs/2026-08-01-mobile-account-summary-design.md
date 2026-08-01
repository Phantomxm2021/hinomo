# Mobile Account Summary Design

## Goal

Make the `/app/me` tab an uncluttered account summary and move avatar editing to a dedicated second-level account page.

## Interaction

- The account summary card shows the current avatar, display name, and authenticated email address.
- Selecting the complete card opens `/app/me/account`.
- The summary no longer exposes avatar upload, nor the read-only nickname and email rows.
- `/app/me/account` shows the avatar uploader at the top and read-only nickname and email rows beneath it.
- Language preference and sign-out remain on `/app/me`; desktop account-menu dialogs remain unchanged.

## Data and Error Handling

Both pages use the existing profile/avatar React Query keys and profile API. Avatar uploads invalidate the shared profile and avatar queries, so the summary refreshes automatically after returning. Existing mobile feedback is used for upload errors and success.

## Acceptance Criteria

- The summary card exposes the email alongside the display name and links to the second-level page.
- No avatar file input or identity detail rows appear on `/app/me`.
- The second-level page alone provides the avatar upload control and read-only identity information.
