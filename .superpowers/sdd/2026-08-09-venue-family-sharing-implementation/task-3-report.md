# Task 3 report: venue shared workflows

## Delivered

- Added migration `202608090003_venue_shared_workflows.sql`.
  - `search_my_items` and `search_my_inventory` retain their existing signatures and result fields while resolving formal inventory through `can_access_venue`.
  - `item_movements` is readable only when the item is currently in an accessible venue. Take-out, return, and same-venue moves use `can_edit_venue_content`; cross-venue moves require ownership of both source and target venues.
  - Normal media upload, confirmation, and download RPCs resolve access through box -> space -> venue. Upload rows and R2 object keys use the venue owner as their canonical owner. Private downloads require current venue access; public-box downloads remain available to anonymous callers.
- Added `021_venue_shared_workflows.test.sql` with 25 pgTAP assertions covering shared/private search isolation, movement boundaries and history visibility, shared private-box scanning, media key ownership, upload/confirm/download authorization, revoked membership, and anonymous private-box isolation.
- Updated browser-facing database types to mark `media_uploads` as RPC-only for insert/update, matching its revoked table privileges.

## Verification

- `npm run typecheck`: passed after installing the lockfile dependencies in the isolated worktree.
- `git diff --check`: passed.
- `npm run test:db`: could not run pgTAP. The Supabase CLI reached the local connection step but PostgreSQL was not listening at `127.0.0.1:54322` (`ECONNREFUSED`). This was retried for the RED and final/GREEN runs; no pgTAP results are claimed.

## Follow-up

Start the local Supabase stack (for example, `supabase start`) and rerun `npm run test:db` before merging. The new test is intentionally included in that command and is expected to exercise the migration together with existing search, media, and movement coverage.
