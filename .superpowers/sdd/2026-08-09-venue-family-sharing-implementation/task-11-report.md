# Task 11 report — venue family sharing release acceptance

## Delivered

- Added a shared-state, per-Playwright-page mock backend for members, invites, activity and packing-session ownership. Direct writes to `venue_members` and `venue_invites` are explicitly rejected; member attempts to delete boxes are rejected.
- Added `e2e/venue-family-sharing.spec.ts`: owner invite, member fragment acceptance, shared venue switcher, shared private-box QR URL, member content work, owner quota with no member purchase entry point, activity actor, dangerous-operation rejection and stale membership redirect.
- Added `npm run test:venue-sharing-concurrency`. It accepts only `localhost`/`127.0.0.1`, never logs tokens, creates disposable owner plus five members, verifies final-seat invite reservation and concurrent one-time acceptance, and deletes fixtures in `finally`.
- Updated Chinese and English privacy/terms disclosures and bumped `LEGAL_POLICY_VERSION` to `2026-08-09`.
- Added the release migration order, controlled health SQL, Test Mode checks, analytics boundary and forward-only rollback instructions to the deployment runbook.

## Verification evidence

| Command | Result |
| --- | --- |
| `npx playwright test e2e/venue-family-sharing.spec.ts --reporter=line` | Passed: 3 projects (desktop Chromium, iPhone, Pixel), 11.3s. |
| `npm test -- --run src/features/legal/LegalDocumentPage.test.tsx` | Passed: 3 tests. |
| `npm run typecheck --workspace=@nomo/web -- --pretty false` | Passed. |
| `npm run lint` | Passed (`oxlint`, no output/errors). |
| `git diff --check` | Passed (no output). |
| `node --check scripts/test-venue-sharing-concurrency.mjs` | Passed. |

## Honest blockers / not run

- `npm run test:venue-sharing-concurrency` was invoked but cannot run in this worktree because `SUPABASE_URL` is not configured. It exited before any connection or fixture creation with `missing SUPABASE_URL`; no secret or token was logged. Re-run with local `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` only.
- The full DB suite, full Vitest suite, worker suites, production build and full existing Playwright suite were not run in this task worktree. They remain release-gate commands from the deployment brief, not claims of success in this report.

## Review-fix evidence

- Replaced direct RPC calls for member movement and packing with the real UI: inventory search, the canonical `/b/<public-id>` QR-label URL, the item action sheet, target-box selector, responsive box creation, and responsive AI-packing action. Direct `fetch` remains only for the explicit bypass-denial cases.
- The E2E mock now returns a credit summary per authenticated user, exposes the nested `venue_id` needed by the real access-summary query, keeps packing `owner_id` separate from `created_by`, and explicitly rejects member DELETE attempts for boxes, spaces, and venues. The activity assertion now checks the member actor, item, source box, and target box.
- Fixed the active-invite health query to aggregate `venue_members` and active `venue_invites` separately before joining, so member×invite joins cannot inflate either count.
- Declared `@supabase/supabase-js` at the root used by the concurrency runner and declared/checked Node.js 20+; the runner still refuses a missing or non-local Supabase configuration before fixtures are created.

| Command | Result |
| --- | --- |
| `npx playwright test e2e/venue-family-sharing.spec.ts --reporter=line` | Passed: 3 projects (desktop Chromium, iPhone, Pixel), 16.9s. |
| `npm test -- --run src/features/legal/LegalDocumentPage.test.tsx` | Passed: 3 tests. |
| `npm run typecheck --workspace=@nomo/web -- --pretty false` | Passed. |
| `npm run lint` | Passed (`oxlint`, no output/errors). |
| root dependency/runtime assertion; `node --check scripts/test-venue-sharing-concurrency.mjs` | Passed. |
| `git diff --check` | Passed (no output). |

### Review-fix RED evidence

- The revised desktop E2E initially timed out waiting for the item action because the mock box response omitted `spaces.venue_id`; without it, the real access-summary query cannot enable member content actions. It passed after that server-shape gap was fixed. The all-project run then exposed the desktop-only packing trigger; the spec now uses the responsive action sheet on iPhone and Pixel, and the final all-project run passed.

## Final whole-branch review fix wave

- Hardened direct shared-content writes: a direct space or layout parent change now requires ownership of both source and target venues, while low-risk owner field edits remain compatible. Direct `items.box_id` updates are explicitly revoked so item moves cannot bypass `move_item` availability, note and movement-history invariants; the item trigger retains a both-owner defense in depth.
- Made revocation observable and cache-safe in the web client. Stable `venue_access_denied` and SQLSTATE `42501` values are recognized through recursive `cause` chains; zero-row item UPDATE/DELETE responses become stable 42501 denials. Capture and checklist queries/mutations forward raw failures, checklist polling performs an access-summary preflight, and the purge covers box-by-id, packing sessions/photos/detected items/evidence/promotions and signed packing media URLs.
- Added directional in/out activity messages in Chinese and English so cross-venue snapshots do not invent deleted endpoints.
- Added the fail-closed `VITE_ENABLE_VENUE_INVITES` build flag. The owner invite panel and invite query stay closed unless it is exactly `true`; Playwright explicitly enables it to preserve the full invite-flow assertions. The deployment runbook now documents closed-first deployment, staging smoke, production enablement, frontend rollback and reversible forward-migration RPC revocation.

### Final-wave verification evidence

| Command | Result |
| --- | --- |
| Focused migration/venue/item/packing/activity/member Vitest set | Passed: 8 files, 82 tests. |
| Adjacent real-component/i18n Vitest set | Passed: 4 files, 29 tests. |
| `npm test -- --run` | Passed: 108 files, 745 tests. |
| `npx playwright test e2e/venue-family-sharing.spec.ts --workers=1 --reporter=line` | Passed: desktop Chromium, iPhone and Pixel; 3 tests in 33.7s. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed (`oxlint`, no output/errors). |
| `npm run build --workspace=@nomo/web` | Passed; existing large-chunk advisory only. |
| `git diff --check` | Passed. |

### Final-wave honest blocker

- `npm run test:db` was invoked after the migration changes, but the local Supabase PostgreSQL endpoint refused `127.0.0.1:54322`. The new pgTAP privilege/asymmetric-owner cases therefore have source-contract coverage and are committed, but their live database execution remains a release-environment gate; no DB-pass claim is made here.
