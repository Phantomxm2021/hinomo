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
