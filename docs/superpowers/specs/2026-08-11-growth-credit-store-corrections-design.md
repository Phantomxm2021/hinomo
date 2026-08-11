# Growth credits and store corrections design

## Goal

Correct the Phase One registration/commerce experience so it does not imply a subscription, historical accounts can be credited safely, and every current one-time product is visible with one consistent USD price set.

## Confirmed decisions

- Marketing contact opt-in remains optional email communication, not a subscription. Chinese copy will say the user can stop receiving these emails at any time; English copy will use the equivalent wording.
- New users created after the launch-credit migration receive 10 promotional Credits valid for 30 days through the existing idempotent `auth.users` trigger.
- The pre-migration account shown by the operator receives one explicit service-role backfill grant of 10 promotional Credits valid for 30 days. The backfill is idempotent and addressed by user ID/source reference; it is not a blanket grant to every historical account.
- The Credits page becomes the visible one-time product catalogue: 20 Credits for US$2.99, 100 Credits for US$9.99, 500 Credits for US$34.99, and Unlimited Boxes for US$9 one-time. The existing Boxes-page paywall remains as a contextual entry point.
- Current USD prices are authoritative for Phase One. Stale HK$38 terms copy must be replaced with US$9 in both locales. The final Stripe Test/Live Price objects must still be checked manually because secrets and remote Price IDs are not stored in the repository.

## Architecture and data flow

The server remains the authority for price mapping and entitlement fulfillment. The client sends only the existing checkout action (`credits_20`, `credits_100`, `credits_500`, or `boxes_unlimited`); Edge Functions map that action to server-only Price ID environment variables. The Credits page reuses the existing `startBoxUnlimitedCheckout` API for the new catalogue card, so no client-side amount or Price ID is introduced.

The historical correction is an operator-only SQL/service-role operation that calls `public.grant_credits` with `kind = promotional`, 10 credits, a 30-day expiry, and a source reference such as `backfill:<user_uuid>:growth-launch-v1`. The unique `(kind, source_reference)` constraint makes a retry safe. The user ID must be resolved outside the client from the controlled account; no email or personal data is committed to Git.

## UI and legal consistency

- Register opt-in copy will not use `subscription`, `订阅`, or `unsubscribe` terminology.
- The product catalogue will show all four one-time products and the no-auto-renewal boundary.
- Terms and authoritative payment docs will show the same four USD prices. Historical design/archive references may remain explicitly historical, but active legal copy must not conflict with the current UI.

## Verification

- Add a registration copy regression test that rejects subscription wording and asserts the new opt-out wording in both locales.
- Add Credits-page tests for all four visible products, exact prices, and the unlimited-box checkout action.
- Add/extend SQL pgTAP coverage for the backfill source/reference idempotency and 10-credit/30-day values without granting to arbitrary client callers.
- Run focused Vitest, typecheck, lint, build, Deno source tests, and the database suite where Supabase is available.
- Manually verify the controlled historical user has exactly one promotional backfill grant and that a fresh post-migration signup receives exactly one signup grant.
