# Task 3 report: venue shared workflows

## Delivered

- Added migration `202608090003_venue_shared_workflows.sql`.
  - `search_my_items` and `search_my_inventory` retain their existing signatures and result fields while resolving inventory through `can_access_venue`. `search_my_inventory` is a security-definer read constrained by that explicit venue predicate, allowing its published AI branch to cross the packing tables' owner-only RLS without exposing inaccessible rows.
  - `item_movements` is readable only when the item is currently in an accessible venue. Take-out, return, and same-venue moves use `can_edit_venue_content`; cross-venue moves require ownership of both source and target venues.
  - Normal media upload, confirmation, and download RPCs resolve access through box -> space -> venue. Upload rows and R2 object keys use the venue owner as their canonical owner. Private downloads require current venue access; public-box downloads remain available to anonymous callers.
- Added `021_venue_shared_workflows.test.sql` with 29 pgTAP assertions covering formal and published-AI shared/private search isolation, both asymmetric cross-venue ownership denials, movement boundaries and history visibility, shared private-box scanning, media key ownership, upload/confirm/download authorization, revoked membership, anonymous private-box isolation, and anonymous public-media download preservation.
- Updated browser-facing database types to mark `media_uploads` as RPC-only for insert/update, matching its revoked table privileges.

## Verification

- `npm run typecheck`: passed after installing the lockfile dependencies in the isolated worktree.
- `git diff --check`: passed.
- `npm run test:db`: could not run pgTAP. The Supabase CLI reached the local connection step but PostgreSQL was not listening at `127.0.0.1:54322` (`ECONNREFUSED`). This was retried for the RED and final/GREEN runs; no pgTAP results are claimed.
- Review follow-up: static coverage now includes the AI branch under a shared member, source-only and target-only cross-venue owners, and the public anonymous media path. The database remains unavailable, so those assertions have not been executed locally.

## Follow-up

Start the local Supabase stack (for example, `supabase start`) and rerun `npm run test:db` before merging. The new test is intentionally included in that command and is expected to exercise the migration together with existing search, media, and movement coverage.
