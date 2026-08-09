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
