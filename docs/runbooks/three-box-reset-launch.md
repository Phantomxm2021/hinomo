# Three-Box Reset launch runbook

This is the release gate for the English Three-Box Reset. Perform Test Mode first; do not promote while a required check is blank, failed, or records sensitive data. The launch record must never contain secrets, card data, household photos, item names, search queries, QR contents, email addresses, or addresses.

## 1. Test environment database gate

- [ ] Record the target Test Supabase project ref and the currently applied migration list.
- [ ] Apply only pending migrations, in repository order, using the deployment guide’s forward-only sequence.
- [ ] Verify the schema migration table lists every expected migration and record the result.
- [ ] Verify a controlled Test account can complete signup, create a space, create a box, create an item, search it, and print/download a label.
- [ ] For any specific account created before the growth-credit signup migration, follow the [historical credits backfill runbook](./growth-credits-backfill.md); never add user IDs to Git or run a blanket backfill migration.
- [ ] Run `npm run test:db`. If local Supabase is unavailable, mark this a release blocker and run it in the configured staging environment before promotion.

## 2. Stripe Test Mode prices and mapping

- [ ] Create or verify four USD one-time Test Mode Price objects: 20 Credits, 100 Credits, 500 Credits, and the US$9 unlimited-box founder offer.
- [ ] Record their non-secret Price IDs in the launch record.
- [ ] Verify the existing server mapping uses `STRIPE_CREDIT_20_PRICE_ID`, `STRIPE_CREDIT_100_PRICE_ID`, `STRIPE_CREDIT_500_PRICE_ID`, and `STRIPE_BOXES_UNLIMITED_PRICE_ID`; do not rename variables or place Stripe secrets in the web app.
- [ ] Verify Test Mode secret, webhook secret, and public origin are isolated from Live Mode.

## 3. Checkout and webhook gate

- [ ] Deploy `billing-checkout` and `stripe-webhook`; record their Function versions.
- [ ] Confirm webhook subscriptions include `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `charge.refunded`.
- [ ] Complete founder checkout once and confirm exactly one unlimited-box entitlement and one 20-Credit promotional grant.
- [ ] Replay the same Stripe Event/Checkout Session and verify no duplicate entitlement or grant.
- [ ] Complete one full refund; verify future box creation is revoked and unused founder bonus credits are reversed without deleting existing boxes.
- [ ] Observe a partial refund without automatic entitlement/credit revocation; record it for manual review.

## 4. Cloudflare Pages configuration gate

- [ ] Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` point to the target environment.
- [ ] Verify `VITE_PUBLIC_APP_ORIGIN` is the public target origin.
- [ ] Verify `VITE_PUBLIC_SUPPORT_EMAIL` is the launch support inbox.
- [ ] Verify `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` are set only when approved; neither value is placed in the launch record.
- [ ] Build and deploy the Pages release; record the deployment ID.

## 5. PostHog privacy and funnel gate

- [ ] On a fresh browser, verify there is no PostHog request before consent.
- [ ] Choose `No thanks`, repeat the campaign registration path, and verify no analytics request or event is sent.
- [ ] Choose `Allow analytics` in a separate controlled run and verify session replay remains disabled.
- [ ] Create the named primary funnel as unique users in this order: `landing_view → signup_completed → space_created → box_created → first_item_created → purchase_completed`.
- [ ] Create the named depth funnel: `first_item_created → ai_analysis_completed → first_search_completed|qr_scanned`.
- [ ] Allowlist only: `landing_view`, `signup_completed`, `space_created`, `box_created`, `first_item_created`, `ai_analysis_completed`, `first_search_completed`, `qr_downloaded`, `qr_scanned`, `checkout_started`, and `purchase_completed`.
- [ ] Inspect test event properties and confirm no household photos, item names, search terms, QR contents, emails, addresses, payment data, or other forbidden content appears.

## 6. Real-device browser gate

- [ ] Complete the English flow on an iPhone Safari device; record device model, OS/browser version, timestamp, operator, pass/fail, and non-sensitive test identifiers.
- [ ] Complete the English flow on an Android Chrome device; record device model, OS/browser version, timestamp, operator, pass/fail, and non-sensitive test identifiers.
- [ ] On each device, verify install copy, page layout, consent controls, campaign CTA, and `/register?campaign=three_box_reset` routing.

## 7. PWA, QR, PDF, and AI gate

- [ ] Add the PWA to the iPhone Home Screen and Android Home Screen; launch it once from each icon.
- [ ] Grant camera permission, scan a controlled QR label, and confirm it opens the intended box.
- [ ] Download a QR-label PDF and inspect the label, QR, box name, and space for the controlled account only.
- [ ] Complete one successful AI packing flow, review/correct one result, and verify the success state.
- [ ] Force or use a controlled AI failure and verify reserved credit is released; do not use customer content to test this.

## 8. Production canary gate

- [ ] Create a new controlled production canary account after forward-only migrations and release deployment are complete.
- [ ] Complete the campaign through first item, search, QR/PDF, and consent paths.
- [ ] Make one controlled real founder payment and one controlled real refund; record only permitted Stripe identifiers and outcomes.
- [ ] Verify the payment grants exactly one entitlement and exactly one 20-Credit founder promotional grant, and the refund behavior matches the Test Mode observation.

## 9. Rollback gate

- [ ] Stop campaign links and scheduled posts before rolling back the application.
- [ ] Restore the prior Cloudflare Pages deployment and record its deployment ID.
- [ ] Keep database migrations forward-only; never rollback by deleting schema or ledgers.
- [ ] Disable the PostHog key in Pages if analytics must stop.
- [ ] Preserve Stripe Checkout, webhook-event, entitlement, credit, and refund ledgers for reconciliation.

## 10. Launch record

Create one controlled release record containing only:

- [ ] deployment ID and public origin;
- [ ] migration list;
- [ ] Function versions;
- [ ] Stripe Price IDs;
- [ ] Test event/session IDs and allowed non-sensitive Stripe identifiers;
- [ ] device/browser and version;
- [ ] operator, timestamp, and result for each check; and
- [ ] unresolved risks, owner, and promotion decision.

Never record secrets, API keys, webhook secrets, customer data, card data, household photos, item names, searches, QR contents, emails, or addresses.

## Sign-off

- [ ] All required Test Mode checks pass.
- [ ] iPhone Safari and Android Chrome English flows pass.
- [ ] `npm run test:db` passes in local Supabase or configured staging.
- [ ] The approved real demo MP4 is present at `apps/web/public/marketing/three-box-reset-demo.mp4`, or launch is blocked and the site fallback remains enabled.
- [ ] A release owner records the final go/no-go decision and unresolved risks.
