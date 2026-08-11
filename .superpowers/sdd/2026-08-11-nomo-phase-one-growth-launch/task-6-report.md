# Task 6 report — activation lifecycle instrumentation

## Delivered

- Instrumented confirmed-success boundaries for space, box, and manual item creation, passing onboarding context from the applicable onboarding UI flows.
- Instrumented terminal AI analysis completion with an in-mount `${session.id}:${session.current_revision}:${session.status}` dedupe key.
- Instrumented settled search, successful QR-label PDF rendering, and valid parsed Nomo QR scans.
- All event payloads use only the closed `GrowthEventMap` properties and obtain `first` from `firstGrowthOccurrence()`.

## Tests added

- Success and failure cases for spaces, boxes, manual items, PDF rendering, search settlement, and QR scanning.
- AI terminal-session test covers polling-repeat deduplication; queued sessions emit nothing.
- Search and scanner tests explicitly assert content-bearing query/decoded URL values are absent from analytics mock arguments.

## Validation

- Focused plus affected component tests: 13 files, 236 tests passed.
- `npm run typecheck --workspace=@nomo/web` passed.
- `npm run lint --workspace=@nomo/web` passed.
- `npm run build --workspace=@nomo/web` passed. Vite reported pre-existing environment/chunk-size warnings only.
- Privacy scan found only the intentional compile-time negative type assertion in `apps/web/src/lib/analytics.test.ts`; no instrumented event payload contains forbidden content.

## Scope notes

- No Task 7 or Task 8 documentation was added or modified.

## Fix round 1

- Search capture now requires both enabled queries to be successful and no longer fetching, which prevents emitting from cached data while a refetch is in flight or fails.
- AI completion deduplication now uses only the session ID and revision, so a `partial_failed` to `ready` transition for the same revision cannot emit twice.
- Scanner coverage now asserts no event immediately after an invalid QR, before exercising a valid QR; decoded QR content remains excluded from payload assertions.
- Revalidated affected focused tests (39 passing), TypeScript typecheck, and lint.
