# Task 5 report: venue activity feed

## Delivered

- Added `202608090005_venue_activity.sql`.
  - Adds the five-value `venue_activity_event` enum and nullable `venue_id` / `event_code` columns to `activity_logs`, with a partial tuple index for product-feed rows. Legacy rows receive a venue only when their live `box_id` relationship resolves it; no event code is inferred.
  - Adds a private, non-client-executable activity writer that accepts an explicit actor and rejects snapshot fields outside the feed whitelist. It records the actor display name at write time.
  - Adds transaction-local item and box triggers for creation, deletion, quantity changes, and moves. A single mutation which changes item box and quantity emits both appropriate product events. Cross-venue moves make one source `out` record and one destination `in` record, omitting the other venue's private names; same-venue moves retain both names.
  - Extends packing promotion finalization to use `requested_by` as the actor for its service-role item-created event, without impersonating an actor when no explicit requester exists.
  - Adds authenticated `list_venue_activity` with current venue access enforcement, actor/event filters, a validated `(created_at, id)` cursor, a 1–50 row limit, and `actor_is_current` derived from the current owner/member relationship.
- Added `023_venue_activity.test.sql` with 33 pgTAP assertions covering event creation, actor and deletion snapshots, non-product updates, quantity and same-venue movement fields, owner cross-venue item/box privacy, current/revoked/outsider access, historical actor status, and cursor ordering.
- Updated browser database types and compile-time declarations for activity columns, the enum, and the list RPC.

## Verification

- RED `npm run test:db`: blocked before pgTAP can execute. The local Supabase CLI could not connect to PostgreSQL at `127.0.0.1:54322` (`ECONNREFUSED`).
- `npm run typecheck`: passed after `npm install` in the isolated worktree; no dependency files changed.
- Final/GREEN `npm run test:db`: blocked by the same unavailable local PostgreSQL service. No database-test success is claimed.
- `git diff --check`, including the new migration and test files: passed.

## Follow-up

Start the local Supabase stack (for example, `supabase start`) and rerun `npm run test:db` before merging. This is required to validate the migration syntax and execute 023 alongside the existing database suite.

## Review follow-up

- Replaced the legacy `activity_logs` select policy for product rows: `event_code IS NOT NULL` now requires a non-null `venue_id` and current `can_access_venue(venue_id)`; only `event_code IS NULL` rows retain the actor/box-owner compatibility path. This prevents a departed member from reading product rows directly through `actor_id`.
- Expanded 023 from 33 to 42 assertions. It now covers direct-table revocation, actor/event filters, limits 0 and 51, half-cursors, a combined item box-plus-quantity update emitting both event codes, and service-role promotion attribution through `requested_by`.
- Fresh evidence after the review changes: `npm run typecheck` passed; `git diff --check` passed; the expanded `npm run test:db` attempt remained blocked before pgTAP by `ECONNREFUSED 127.0.0.1:54322`. No database-test success is claimed.
