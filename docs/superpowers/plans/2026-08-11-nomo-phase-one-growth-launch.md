# Nomo Phase One Growth Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In 14 days, make the English “3-Box Reset” acquisition loop safe, measurable, and purchasable, then privately guide enough high-intent users to reach 10 basic activations and at least 1 real payment.

**Architecture:** Keep the existing product onboarding as the activation path and add a focused public campaign page in front of it. Grant launch credits in Postgres, keep Stripe prices and fulfillment server-controlled, and send only explicit content-free events to a consent-gated PostHog client. Treat launch operations—support, demo media, outreach, interviews, metric review, and rollback—as versioned runbooks with the same release gate as code.

**Tech Stack:** React 19, React Router 7, TypeScript 6, Vite 8, Vitest, Playwright, Supabase Auth/Postgres/Edge Functions, pgTAP, Stripe Checkout/Webhooks, PostHog JavaScript SDK, Cloudflare Pages.

## Global Constraints

- Cold-start language is English; every new product string must still have matching `en-US` and `zh-CN` entries.
- The campaign promise is exactly `Pack once. Find anything later.` and the campaign name is exactly `The 3-Box Reset`.
- The campaign primary CTA is exactly `Organize 3 boxes free`.
- Free accounts retain the existing maximum of 3 simultaneously held boxes and require no payment card.
- Every new account receives exactly 10 promotional AI Credits, expiring exactly 30 days after the grant becomes effective.
- Founding Lifetime costs US$9 once, unlocks unlimited boxes, includes exactly 20 non-expiring promotional AI Credits, and never renews automatically.
- AI packs cost US$2.99 for 20 Credits, US$9.99 for 100 Credits, and US$34.99 for 500 Credits; purchased Credits do not expire.
- The first-100 price transition is monitored manually in Phase One; automated inventory reservation, referral rewards, professional dashboards, lifecycle-email automation, and paid ads are out of scope.
- Product analytics is opt-in. Before consent, no PostHog request or queued event may occur.
- Session replay, autocapture, automatic page views, and automatic page-leave capture remain disabled everywhere.
- Analytics must never receive photos, item names, search text, QR content, signed URLs, storage paths, invite tokens, email addresses, display names, or payment details.
- Analytics properties are limited to campaign, language, device category, first-occurrence boolean, contact-consent boolean, controlled product/action enums, onboarding boolean, result-presence boolean, and confirmation enum.
- App and billing logs must not contain household content or payment details.
- Public promotion is blocked until the real-device English flow `campaign → registration → space → box → item/AI → search/QR → checkout → fulfillment` passes in Stripe Test Mode.
- Phase One targets: 10 basic activations and at least 1 real paid user by day 14. A basic activation means space + box + real item within 24 hours of signup.

---

## Phase One outcome and critical path

The work is intentionally ordered so that no traffic is sent into an unmeasurable or unfulfillable funnel:

```text
Measurement contract and consent
  → campaign page and registration attribution
  → launch credits
  → USD checkout and founder fulfillment
  → lifecycle event wiring
  → support/demo/runbook
  → staging and real-device gate
  → private seed recruitment
  → day-14 decision
```

Promotion begins only after Tasks 1–8 are complete. Tasks 9–10 are the actual first cohort, not additional product development.

## File structure map

### New focused files

- `apps/web/src/lib/analytics.ts`: the only PostHog import; typed event contract, consent state, initialization, identify/reset, and capture API.
- `apps/web/src/lib/analytics.test.ts`: proves no capture before consent and verifies property allowlists.
- `apps/web/src/components/AnalyticsConsentBanner.tsx`: public/app consent prompt with accept and decline controls.
- `apps/web/src/components/AnalyticsConsentBanner.test.tsx`: consent UI behavior and persistence.
- `apps/web/src/features/marketing/ThreeBoxResetPage.tsx`: focused public campaign page.
- `apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx`: English offer, CTA, trust, install guidance, and pricing-order assertions.
- `apps/web/public/marketing/three-box-reset-demo.mp4`: final 30–45 second product demonstration exported at 1080×1920 H.264/AAC.
- `supabase/migrations/202608110002_growth_launch_credits.sql`: idempotent signup promotional grant trigger.
- `supabase/tests/database/024_growth_launch_credits.test.sql`: signup grant, expiry, idempotency, and permissions contract.
- `docs/operations/three-box-reset-support.md`: exact human follow-up/support templates and interview record format.
- `docs/operations/three-box-reset-content.md`: demo shot list, launch posts, community disclosure, and first four video scripts.
- `docs/runbooks/three-box-reset-launch.md`: environment, Stripe, PostHog, real-device, release, monitoring, and rollback checklist.
- `apps/web/e2e/growth-launch.spec.ts`: browser-level campaign-to-activation and consent checks using the existing mock backend.

### Existing files changed by responsibility

- `apps/web/package.json`, `package-lock.json`: add `posthog-js`.
- `apps/web/.env.example`, `apps/web/src/lib/env.ts`: optional public PostHog config and public support email.
- `apps/web/src/app/providers.tsx`, `apps/web/src/features/auth/AuthProvider.tsx`: mount consent UI and synchronize stable auth ID with analytics.
- `apps/web/src/app/router.tsx`, `apps/web/src/app/router.test.tsx`: expose `/3-box-reset` outside auth/app routes.
- `apps/web/src/i18n/messages.ts`: matching English and Chinese campaign, consent, registration opt-in, offer, and support copy.
- `apps/web/src/features/auth/auth.schemas.ts`, `RegisterPage.tsx`, `RegisterPage.test.tsx`: optional growth-contact consent, safe campaign attribution, and signup event.
- `apps/web/src/features/profile/GeneralSettingsPanel.tsx`, `GeneralSettingsPage.test.tsx`: persistent analytics preference control.
- `apps/web/src/content/legal/privacy.en-US.md`, `privacy.zh-CN.md`, `apps/web/src/features/legal/legal-policy.ts`: disclose consent-controlled analytics and update policy version.
- `apps/web/src/features/spaces/spaces.api.ts`, `spaces.api.test.ts`: `space_created`.
- `apps/web/src/features/boxes/boxes.api.ts`, `boxes.api.test.ts`, `box-entitlements.api.ts`, `box-entitlements.api.test.ts`, `BoxesPage.tsx`, `BoxesPage.test.tsx`, `BoxLimitPaywall.tsx`, `BoxLimitPaywall.test.tsx`: box, checkout, purchase events and US$9 offer.
- `apps/web/src/features/items/items.api.ts`, `items.api.test.ts`: `first_item_created`.
- `apps/web/src/features/packing/PackingChecklistSection.tsx`, `PackingChecklistSection.test.tsx`: completed AI analysis event.
- `apps/web/src/features/search/SearchPage.tsx`, `SearchPage.test.tsx`: completed search event without search text.
- `apps/web/src/features/qr-print/PrintPage.tsx`, `PrintPage.test.tsx`: successful QR PDF download event.
- `apps/web/src/features/scanner/ScannerPage.tsx`, `ScannerPage.test.tsx`: valid Nomo QR scan event without decoded content.
- `apps/web/src/features/credits/CreditsPage.tsx`, `CreditsPage.test.tsx`, `credits.api.ts`: USD pack copy and checkout/purchase events.
- `supabase/functions/billing-checkout/index.ts`, `index_test.ts`: controlled founding-offer metadata.
- `supabase/functions/stripe-webhook/index.ts`, `index_test.ts`: idempotent founder bonus and refund revocation.
- `supabase/tests/database/014_ai_packing_sessions.test.sql`, `016_ai_credits.test.sql`, `022_venue_shared_packing.test.sql`: isolate prior exact-balance fixtures from automatic signup credits.
- `docs/ai-credits-stripe.md`, `docs/runbooks/deployment.md`: authoritative USD pricing and deployment order.

---

### Task 1: Create a consent-gated, content-free analytics boundary

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Modify: `apps/web/.env.example`
- Modify: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/analytics.ts`
- Create: `apps/web/src/lib/analytics.test.ts`
- Create: `apps/web/src/components/AnalyticsConsentBanner.tsx`
- Create: `apps/web/src/components/AnalyticsConsentBanner.test.tsx`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/features/auth/AuthProvider.tsx`
- Modify: `apps/web/src/features/profile/GeneralSettingsPanel.tsx`
- Test: `apps/web/src/features/profile/GeneralSettingsPage.test.tsx`

**Interfaces:**
- Consumes: optional `VITE_POSTHOG_KEY`, optional `VITE_POSTHOG_HOST`, and browser `localStorage`.
- Produces: `GrowthEventMap`, `captureGrowthEvent<K>()`, `firstGrowthOccurrence()`, `setAnalyticsConsent()`, `getAnalyticsConsent()`, `subscribeAnalyticsConsent()`, `identifyAnalyticsUser()`, and `resetAnalyticsUser()`.

- [ ] **Step 1: Install the browser SDK**

Run: `npm install posthog-js --workspace=@nomo/web`

Expected: `apps/web/package.json` and `package-lock.json` add one production dependency and install succeeds without peer-dependency errors.

- [ ] **Step 2: Write failing analytics boundary tests**

Add tests that mock `posthog-js/dist/module.no-external` and assert:

```ts
expect(getAnalyticsConsent()).toBe('unset')
captureGrowthEvent('landing_view', {
  campaign: 'three_box_reset', language: 'en-US', device: 'mobile', first: true,
})
expect(mockCapture).not.toHaveBeenCalled()

setAnalyticsConsent('accepted')
expect(mockInit).toHaveBeenCalledWith('phc_test', expect.objectContaining({
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
  opt_out_capturing_by_default: true,
}))

identifyAnalyticsUser('00000000-0000-4000-8000-000000000001')
expect(mockIdentify).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001')
resetAnalyticsUser()
expect(mockReset).toHaveBeenCalled()
```

Also use `// @ts-expect-error` compile assertions for forbidden properties such as `{ search_text: 'cable' }` and invalid product enums.

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `npm test -- --run apps/web/src/lib/analytics.test.ts apps/web/src/components/AnalyticsConsentBanner.test.tsx apps/web/src/features/profile/GeneralSettingsPage.test.tsx`

Expected: FAIL because the analytics module and consent UI do not exist.

- [ ] **Step 4: Implement the exact event and property contract**

Use this public type surface in `analytics.ts`:

```ts
export type AnalyticsConsent = 'unset' | 'accepted' | 'declined'
export type DeviceCategory = 'mobile' | 'tablet' | 'desktop'
export type CheckoutProduct = 'founding_lifetime' | 'credits_20' | 'credits_100' | 'credits_500'

export type GrowthEventMap = {
  landing_view: { campaign: 'three_box_reset'; language: 'en-US' | 'zh-CN'; device: DeviceCategory; first: boolean }
  signup_completed: { campaign: 'three_box_reset' | 'organic'; language: 'en-US' | 'zh-CN'; contact_opt_in: boolean }
  space_created: { onboarding: boolean; first: boolean }
  box_created: { onboarding: boolean; first: boolean }
  first_item_created: { onboarding: boolean; method: 'manual' | 'ai'; first: boolean }
  ai_analysis_completed: { result: 'ready' | 'partial'; first: boolean }
  first_search_completed: { has_results: boolean; first: boolean }
  qr_downloaded: { format: 'pdf'; first: boolean }
  qr_scanned: { destination: 'box'; first: boolean }
  checkout_started: { product: CheckoutProduct }
  purchase_completed: { product: CheckoutProduct; confirmation: 'checkout_return' | 'entitlement_confirmed' }
}

export function captureGrowthEvent<K extends keyof GrowthEventMap>(
  name: K,
  properties: GrowthEventMap[K],
): void

export type FirstGrowthEventName = Exclude<keyof GrowthEventMap, 'checkout_started' | 'purchase_completed'>
export function firstGrowthOccurrence(name: FirstGrowthEventName): boolean
```

Initialize only after stored or newly accepted consent, call `posthog.opt_in_capturing()`, and never buffer pre-consent calls. Use `defaults: '2026-05-30'`, `persistence: 'localStorage+cookie'`, `person_profiles: 'identified_only'`, and the explicit disabling flags from the test. If either PostHog env value is absent, methods remain safe no-ops. `firstGrowthOccurrence(name)` returns `true` without writing while consent is not accepted; after consent it returns `true` once per browser and writes `nomo-growth-first:<name>=1`, then returns `false`.

- [ ] **Step 5: Implement consent UI and auth identity synchronization**

Mount `AnalyticsConsentBanner` once inside `AppProviders`. It appears only for `unset`, says analytics is optional and content-free, and has `Allow analytics` and `No thanks` buttons. Add an analytics row to `GeneralSettingsPanel` whose select values are `accepted` and `declined`, so a user can change the decision later.

In `LiveAuthProvider`, call `identifyAnalyticsUser(liveAuthState.session.user.id)` only when a session exists and consent is accepted; call `resetAnalyticsUser()` when the session becomes null. Do not pass email or user metadata.

- [ ] **Step 6: Run focused tests and static checks**

Run: `npm test -- --run apps/web/src/lib/analytics.test.ts apps/web/src/components/AnalyticsConsentBanner.test.tsx apps/web/src/features/profile/GeneralSettingsPage.test.tsx apps/web/src/features/auth/AuthProvider.test.tsx`

Expected: PASS.

Run: `npm run typecheck && npm run lint`

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/.env.example apps/web/src/lib/env.ts apps/web/src/lib/analytics.ts apps/web/src/lib/analytics.test.ts apps/web/src/components/AnalyticsConsentBanner.tsx apps/web/src/components/AnalyticsConsentBanner.test.tsx apps/web/src/app/providers.tsx apps/web/src/features/auth/AuthProvider.tsx apps/web/src/features/profile/GeneralSettingsPanel.tsx apps/web/src/features/profile/GeneralSettingsPage.test.tsx
git commit -m "feat: add consent-gated growth analytics"
```

---

### Task 2: Publish the focused 3-Box Reset campaign page

**Files:**
- Create: `apps/web/src/features/marketing/ThreeBoxResetPage.tsx`
- Create: `apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/router.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/src/features/marketing/LandingPage.tsx`
- Modify: `apps/web/.env.example`
- Modify: `apps/web/src/lib/env.ts`

**Interfaces:**
- Consumes: `captureGrowthEvent('landing_view', ...)`, `useI18n()`, `useAuth()`, `LanguageSwitcher`, and `VITE_PUBLIC_SUPPORT_EMAIL`.
- Produces: public route `/3-box-reset`; CTA attribution through `/register?campaign=three_box_reset`; support mail link.

- [ ] **Step 1: Write campaign page and route tests**

The English render must assert all of these visible contracts:

```ts
expect(screen.getByRole('heading', { name: 'Pack once. Find anything later.' })).toBeVisible()
expect(screen.getByText('The 3-Box Reset')).toBeVisible()
expect(screen.getByRole('link', { name: 'Organize 3 boxes free' }))
  .toHaveAttribute('href', '/register?campaign=three_box_reset')
expect(screen.getByText(/10 AI Credits/)).toBeVisible()
expect(screen.getByText(/No card required/)).toBeVisible()
expect(screen.getByText(/US\$9/)).toBeVisible()
expect(screen.getByText(/one-time/)).toBeVisible()
expect(screen.getByText(/Add Nomo to your Home Screen/)).toBeVisible()
```

Also assert that the founder offer appears after the workflow/demo section in DOM order, the support link is `mailto:` with the configured public email, and `matchRoutes(router.routes, '/3-box-reset')` resolves outside `/app`.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- --run apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx apps/web/src/app/router.test.tsx`

Expected: FAIL because the route and page do not exist.

- [ ] **Step 3: Build the page as one focused conversion path**

Create these sections in this order:

1. Compact Nomo brand header, language switcher, login link.
2. Hero with the exact promise, moving/garage/basement/attic context, primary CTA, `No card required`.
3. Demo media with a `<video controls playsInline preload="metadata">` using `/marketing/three-box-reset-demo.mp4` and existing `/landing/hero-home-v2.jpg` as poster.
4. Three-step workflow: photograph contents, label the box, search or scan later.
5. Browser/PWA trust section with iPhone Safari and Android Chrome add-to-home-screen instructions.
6. Free offer: three boxes and 10 expiring AI Credits.
7. Founding Lifetime: US$9 once, unlimited boxes, 20 bonus Credits, no subscription.
8. Repeated primary CTA, privacy/terms/support footer.

Authenticated visitors use `/app`; signed-out visitors use `/register?campaign=three_box_reset`. Subscribe to consent with `useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getAnalyticsConsent)` and fire `landing_view` when the state becomes `accepted`, with only campaign, locale, derived device category, and `first: firstGrowthOccurrence('landing_view')`. This ensures accepting on the campaign page records the current visit without retaining a pre-consent event.

- [ ] **Step 4: Add support configuration**

Extend the env schema with:

```ts
VITE_PUBLIC_SUPPORT_EMAIL: z.string().email(),
VITE_POSTHOG_KEY: z.string().min(1).optional(),
VITE_POSTHOG_HOST: z.string().url().optional(),
```

Create and verify the public alias `support@hinomo.space`, route it to the founder's monitored inbox, and set the example value to `support@hinomo.space`. Add the same support link to the existing landing-page footer so both public entry points are operable. Do not deploy this task until a test message to the alias is received and a reply passes SPF/DKIM checks in the receiving mailbox.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- --run apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx apps/web/src/features/marketing/LandingPage.test.tsx apps/web/src/app/router.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript and Vite build exit 0; the missing demo media is not considered launch-ready until Task 7 supplies the file.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/marketing/ThreeBoxResetPage.tsx apps/web/src/features/marketing/ThreeBoxResetPage.test.tsx apps/web/src/app/router.tsx apps/web/src/app/router.test.tsx apps/web/src/i18n/messages.ts apps/web/src/features/marketing/LandingPage.tsx apps/web/.env.example apps/web/src/lib/env.ts
git commit -m "feat: add three box reset campaign page"
```

---

### Task 3: Add optional contact consent and safe campaign attribution to registration

**Files:**
- Modify: `apps/web/src/features/auth/auth.schemas.ts`
- Modify: `apps/web/src/features/auth/RegisterPage.tsx`
- Modify: `apps/web/src/features/auth/RegisterPage.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`

**Interfaces:**
- Consumes: query parameter `campaign=three_box_reset` and `captureGrowthEvent('signup_completed', ...)`.
- Produces: Supabase signup metadata `growth_contact_opt_in_at: string | null` and `signup_campaign: 'three_box_reset' | 'organic'`.

- [ ] **Step 1: Write failing registration tests**

Extend `RegisterPage.test.tsx` to assert that contact consent is optional, unchecked by default, and never blocks signup. For a campaign signup with the box checked, assert:

```ts
expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
  options: { data: expect.objectContaining({
    signup_campaign: 'three_box_reset',
    growth_contact_opt_in_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
  }) },
}))
expect(mockCaptureGrowthEvent).toHaveBeenCalledWith('signup_completed', {
  campaign: 'three_box_reset', language: 'en-US', contact_opt_in: true,
})
```

Add a second assertion that an unrecognized query value becomes `organic` and an unchecked box stores `null`.

- [ ] **Step 2: Run the registration test and confirm failure**

Run: `npm test -- --run apps/web/src/features/auth/RegisterPage.test.tsx`

Expected: FAIL because the field and metadata are absent.

- [ ] **Step 3: Implement registration consent and attribution**

Extend the form schema with `growthContactOptIn: z.boolean()` and default it to `false`. Render a separate optional checkbox after legal consent using copy equivalent to `Email me setup tips and the one-time founder offer. I can unsubscribe anytime.` Do not combine this with mandatory legal consent.

Allow only the literal `three_box_reset`; map every other value to `organic`. After a successful `signUp`, call `identifyAnalyticsUser(data.user.id)` when `data.user?.id` exists, then capture the event; do not send the email or display name.

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- --run apps/web/src/features/auth/RegisterPage.test.tsx apps/web/src/features/task8-english-smoke.test.tsx`

Expected: PASS.

```bash
git add apps/web/src/features/auth/auth.schemas.ts apps/web/src/features/auth/RegisterPage.tsx apps/web/src/features/auth/RegisterPage.test.tsx apps/web/src/i18n/messages.ts
git commit -m "feat: capture growth contact consent at signup"
```

---

### Task 4: Grant every new user 10 expiring launch Credits

**Files:**
- Create: `supabase/migrations/202608110002_growth_launch_credits.sql`
- Create: `supabase/tests/database/024_growth_launch_credits.test.sql`
- Modify: `supabase/tests/database/014_ai_packing_sessions.test.sql`
- Modify: `supabase/tests/database/016_ai_credits.test.sql`
- Modify: `supabase/tests/database/022_venue_shared_packing.test.sql`
- Modify: `docs/ai-credits-stripe.md`
- Modify: `docs/runbooks/deployment.md`

**Interfaces:**
- Consumes: `auth.users`, `public.credit_grants`, `public.credit_transactions`, and their existing unique constraints.
- Produces: idempotent helper `private.grant_growth_launch_credits(uuid, timestamptz)`, trigger function `private.grant_growth_launch_credits_on_signup()`, and trigger `auth_user_grant_growth_launch_credits`.

- [ ] **Step 1: Add the failing pgTAP contract**

In `024_growth_launch_credits.test.sql`, create a dedicated Supabase test user, clear authentication, and assert:

```sql
select is((select original_credits from public.credit_grants where user_id = tests.get_supabase_uid('growth-credit-user')), 10, 'new user receives ten credits');
select is((select kind::text from public.credit_grants where user_id = tests.get_supabase_uid('growth-credit-user')), 'promotional', 'signup grant is promotional');
select ok((select expires_at between effective_at + interval '30 days' - interval '5 seconds' and effective_at + interval '30 days' + interval '5 seconds' from public.credit_grants where user_id = tests.get_supabase_uid('growth-credit-user')), 'grant expires in thirty days');
select is((select count(*)::integer from public.credit_transactions where user_id = tests.get_supabase_uid('growth-credit-user') and kind = 'grant'), 1, 'one grant ledger row exists');
select ok(not has_table_privilege('authenticated', 'public.credit_grants', 'insert'), 'client cannot self-grant credits');
```

Call `private.grant_growth_launch_credits(tests.get_supabase_uid('growth-credit-user'), pg_catalog.now())` twice as `postgres` and assert the grant and ledger counts remain one.

- [ ] **Step 2: Run the database test and confirm failure**

Run: `npm run test:db`

Expected: FAIL in `024_growth_launch_credits.test.sql` because new users do not receive the promotional grant.

- [ ] **Step 3: Implement the idempotent trigger**

Create an ordinary private `security definer` helper with `set search_path = pg_catalog` and signature:

```sql
private.grant_growth_launch_credits(p_user_id uuid, p_effective_at timestamptz)
returns void
```

Insert this grant shape inside the helper:

```sql
insert into public.credit_grants (
  user_id, kind, original_credits, remaining_credits,
  effective_at, expires_at, source_reference
) values (
  p_user_id, 'promotional', 10, 10,
  p_effective_at, p_effective_at + interval '30 days',
  'signup:' || p_user_id || ':growth-launch-v1'
)
on conflict (kind, source_reference) do nothing
returning id into grant_id;
```

Declare `grant_id uuid;`. When it is non-null, insert this ledger row:

```sql
insert into public.credit_transactions (
  user_id, grant_id, kind, credit_amount, idempotency_key, description
) values (
  p_user_id, grant_id, 'grant', 10,
  'grant:promotional:signup:' || p_user_id || ':growth-launch-v1',
  'Nomo launch credits'
)
on conflict (idempotency_key) do nothing;
```

Create `private.grant_growth_launch_credits_on_signup()` as a trigger function that performs `private.grant_growth_launch_credits(new.id, pg_catalog.now())` and returns `new`. Revoke all access to both functions from `public`, `anon`, and `authenticated`; then attach the trigger after insert on `auth.users`.

- [ ] **Step 4: Isolate old exact-balance fixtures**

Immediately after switching to `postgres` in database tests 014, 016, and 022, delete automatic launch transactions and grants for only those test user IDs before inserting each test’s intended grants. Delete transactions before grants because of references. Preserve the new dedicated 024 assertions.

- [ ] **Step 5: Update authoritative credit and deployment docs**

Document the exact 10-Credit/30-day grant, migration order after `202608110001_onboarding_completion.sql`, and one read-only production verification query scoped to a controlled test user. State that the migration affects users created after deployment only; any earlier seed-user grant requires an explicit service-role operation recorded by source reference.

- [ ] **Step 6: Run database tests and commit**

Run: `npm run test:db`

Expected: all pgTAP files pass.

```bash
git add supabase/migrations/202608110002_growth_launch_credits.sql supabase/tests/database/024_growth_launch_credits.test.sql supabase/tests/database/014_ai_packing_sessions.test.sql supabase/tests/database/016_ai_credits.test.sql supabase/tests/database/022_venue_shared_packing.test.sql docs/ai-credits-stripe.md docs/runbooks/deployment.md
git commit -m "feat: grant expiring launch credits on signup"
```

---

### Task 5: Switch checkout to USD launch pricing and fulfill the founder bonus safely

**Files:**
- Modify: `apps/web/src/features/credits/CreditsPage.tsx`
- Modify: `apps/web/src/features/credits/CreditsPage.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxLimitPaywall.tsx`
- Modify: `apps/web/src/features/boxes/BoxLimitPaywall.test.tsx`
- Modify: `apps/web/src/features/credits/credits.api.ts`
- Modify: `apps/web/src/features/credits/credits.api.test.ts`
- Modify: `apps/web/src/features/boxes/box-entitlements.api.ts`
- Modify: `apps/web/src/features/boxes/box-entitlements.api.test.ts`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `supabase/functions/billing-checkout/index.ts`
- Modify: `supabase/functions/billing-checkout/index_test.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts`
- Modify: `supabase/functions/stripe-webhook/index_test.ts`
- Modify: `docs/ai-credits-stripe.md`
- Modify: `docs/runbooks/deployment.md`

**Interfaces:**
- Consumes: existing checkout actions and server-side Stripe Price ID environment variables.
- Produces: controlled metadata `offer_code='founding_lifetime_v1'`; promotional grant source `founding-lifetime-bonus:<checkout-session-id>`; exact USD UI.

- [ ] **Step 1: Write failing UI and API tests**

Assert exact visible prices `US$2.99`, `US$9.99`, `US$34.99`, and `US$9 one-time`; assert founder copy includes `20 bonus AI Credits`, `unlimited boxes`, and `no subscription`.

Mock `captureGrowthEvent` and assert each redirect API captures `checkout_started` only after a valid server URL is returned and before `window.location.assign`. Assert `BoxesPage` captures `purchase_completed` only after `getVenueBoxPlanSummary()` returns `unlimited_boxes: true`.

- [ ] **Step 2: Write failing Edge Function source tests**

Add assertions for:

```ts
assertContains(source, "metadata.offer_code = 'founding_lifetime_v1'", 'Founder checkout must carry a controlled offer code')
assertContains(source, "p_kind: 'promotional'", 'Founder bonus must be promotional')
assertContains(source, 'founding-lifetime-bonus:${session.id}', 'Founder bonus source must be checkout-idempotent')
assertContains(source, "p_credit_amount: 20", 'Founder bonus must contain twenty credits')
assertContains(source, "p_expires_at: null", 'Founder bonus must not expire')
```

Refund tests must require both `revoke_account_entitlement` and `revoke_unused_credits` for a full Founding Lifetime refund.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npm test -- --run apps/web/src/features/credits/CreditsPage.test.tsx apps/web/src/features/credits/credits.api.test.ts apps/web/src/features/boxes/BoxLimitPaywall.test.tsx apps/web/src/features/boxes/box-entitlements.api.test.ts apps/web/src/features/boxes/BoxesPage.test.tsx`

Expected: FAIL on old HKD prices and missing analytics.

Run: `deno test --config supabase/functions/deno.json supabase/functions/billing-checkout/index_test.ts supabase/functions/stripe-webhook/index_test.ts`

Expected: FAIL on missing founder metadata/bonus/refund handling.

- [ ] **Step 4: Update the client price and purchase contracts**

Change only display prices; clients continue sending controlled action names and never Price IDs. Capture Credits `purchase_completed` on `checkout=success` with `confirmation: 'checkout_return'`. Capture Founding Lifetime completion after entitlement polling confirms unlimited boxes with `confirmation: 'entitlement_confirmed'`. Include no session ID in analytics.

- [ ] **Step 5: Add controlled founder fulfillment**

For `boxes_unlimited`, add the literal controlled offer code in checkout metadata. In the webhook, validate both entitlement code and offer code. After `grant_account_entitlement` returns a non-tombstoned result, call:

```ts
await database.rpc('grant_credits', {
  p_user_id: userId,
  p_kind: 'promotional',
  p_credit_amount: 20,
  p_effective_at: new Date().toISOString(),
  p_expires_at: null,
  p_source_reference: `founding-lifetime-bonus:${session.id}`,
  p_description: 'Founding Lifetime bonus',
})
```

Run this even when the entitlement result is `duplicate_active`; credit uniqueness makes replay idempotent. Do not run it for a tombstoned/refunded source. On full refund, revoke the entitlement and call `revoke_unused_credits` with kind `promotional` and the same founder-bonus source. Keep partial refunds in manual review.

- [ ] **Step 6: Update Stripe operations documentation**

Replace HKD amounts with the four exact USD amounts in both authoritative docs. Require separate Test and Live one-time Price objects, preserving existing env variable names. Add a read-only founder count query based on successful active Stripe entitlements and operational thresholds: review at 80, prepare the US$19 Price at 90, stop new US$9 promotion at 100. Phase One does not automate slot reservation.

- [ ] **Step 7: Run tests, typechecks, and commit**

Run: `npm test -- --run apps/web/src/features/credits/CreditsPage.test.tsx apps/web/src/features/credits/credits.api.test.ts apps/web/src/features/boxes/BoxLimitPaywall.test.tsx apps/web/src/features/boxes/box-entitlements.api.test.ts apps/web/src/features/boxes/BoxesPage.test.tsx`

Run: `npm run typecheck:billing && deno test --config supabase/functions/deno.json supabase/functions/billing-checkout/index_test.ts supabase/functions/stripe-webhook/index_test.ts`

Expected: all pass.

```bash
git add apps/web/src/features/credits apps/web/src/features/boxes/BoxLimitPaywall.tsx apps/web/src/features/boxes/BoxLimitPaywall.test.tsx apps/web/src/features/boxes/box-entitlements.api.ts apps/web/src/features/boxes/box-entitlements.api.test.ts apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/i18n/messages.ts supabase/functions/billing-checkout/index.ts supabase/functions/billing-checkout/index_test.ts supabase/functions/stripe-webhook/index.ts supabase/functions/stripe-webhook/index_test.ts docs/ai-credits-stripe.md docs/runbooks/deployment.md
git commit -m "feat: launch USD founder offer"
```

---

### Task 6: Instrument the activation lifecycle without household content

**Files:**
- Modify/Test: `apps/web/src/features/spaces/spaces.api.ts`, `spaces.api.test.ts`
- Modify/Test: `apps/web/src/features/boxes/boxes.api.ts`, `boxes.api.test.ts`
- Modify/Test: `apps/web/src/features/items/items.api.ts`, `items.api.test.ts`
- Modify/Test: `apps/web/src/features/packing/PackingChecklistSection.tsx`, `PackingChecklistSection.test.tsx`
- Modify/Test: `apps/web/src/features/search/SearchPage.tsx`, `SearchPage.test.tsx`
- Modify/Test: `apps/web/src/features/qr-print/PrintPage.tsx`, `PrintPage.test.tsx`
- Modify/Test: `apps/web/src/features/scanner/ScannerPage.tsx`, `ScannerPage.test.tsx`

**Interfaces:**
- Consumes: `captureGrowthEvent()` from Task 1 and existing mutation/query success boundaries.
- Produces: seven activation events using only properties declared in `GrowthEventMap`.

- [ ] **Step 1: Write failing success-only event tests**

For each boundary, mock `captureGrowthEvent` and assert one positive and one negative case:

- successful `createSpace` → `space_created`; RPC error → no event;
- successful `createBox` → `box_created`; RPC error → no event;
- successful `createItem` → `first_item_created` with `method: 'manual'`; insert error → no event;
- a session transitioning to `ready` or `partial_failed` → one `ai_analysis_completed`; queued polling repeats → no duplicate for the same session revision;
- resolved search results → `first_search_completed` with only `has_results`; assert the query string is absent from mock call arguments;
- resolved `renderLabelsPdf` → `qr_downloaded`; PDF error → no event;
- valid parsed Nomo box path → `qr_scanned`; invalid QR → no event and no decoded content in analytics.

Pass onboarding state explicitly from the UI call sites where available; use `false` elsewhere. Derive `first` from per-event local markers managed by a helper in `analytics.ts`, not by querying household records.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- --run apps/web/src/features/spaces/spaces.api.test.ts apps/web/src/features/boxes/boxes.api.test.ts apps/web/src/features/items/items.api.test.ts apps/web/src/features/packing/PackingChecklistSection.test.tsx apps/web/src/features/search/SearchPage.test.tsx apps/web/src/features/qr-print/PrintPage.test.tsx apps/web/src/features/scanner/ScannerPage.test.tsx`

Expected: FAIL on missing event calls.

- [ ] **Step 3: Implement events at confirmed-success boundaries**

Do not place event calls before awaited operations. For the packing effect, keep a `Set<string>` key of `${session.id}:${session.current_revision}:${session.status}` so polling cannot emit the same terminal revision twice in one mount. For search, emit only after both enabled queries have settled without initial errors. For scanner, emit after `parseNomoBoxPath` returns a path and before navigation, passing only `{ destination: 'box', first }`.

- [ ] **Step 4: Run focused tests and privacy scan**

Run the same focused test command from Step 2.

Expected: PASS.

Run:

```bash
rg -n "captureGrowthEvent" apps/web/src | rg "name|email|query|search_text|object_key|public_id|session_id|token|url"
```

Expected: no event payload contains forbidden fields; any output should be an import or unrelated local variable and must be manually checked.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/spaces apps/web/src/features/boxes/boxes.api.ts apps/web/src/features/boxes/boxes.api.test.ts apps/web/src/features/items apps/web/src/features/packing/PackingChecklistSection.tsx apps/web/src/features/packing/PackingChecklistSection.test.tsx apps/web/src/features/search apps/web/src/features/qr-print/PrintPage.tsx apps/web/src/features/qr-print/PrintPage.test.tsx apps/web/src/features/scanner/ScannerPage.tsx apps/web/src/features/scanner/ScannerPage.test.tsx apps/web/src/lib/analytics.ts apps/web/src/lib/analytics.test.ts
git commit -m "feat: instrument activation funnel"
```

---

### Task 7: Align privacy disclosure and human support operations

**Files:**
- Modify: `apps/web/src/content/legal/privacy.en-US.md`
- Modify: `apps/web/src/content/legal/privacy.zh-CN.md`
- Modify: `apps/web/src/features/legal/legal-policy.ts`
- Modify: `apps/web/src/features/legal/LegalDocumentPage.test.tsx`
- Create: `docs/operations/three-box-reset-support.md`

**Interfaces:**
- Consumes: optional signup contact consent and the analytics behavior from Task 1.
- Produces: accurate public disclosure and repeatable human communication.

- [ ] **Step 1: Write the failing legal test**

Assert both locales disclose that analytics is optional, that it uses a third-party product analytics provider, and that household photos, item names, search terms, QR contents, and payment details are excluded. Assert the visible effective date and `LEGAL_POLICY_VERSION` are `2026-08-11`.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- --run apps/web/src/features/legal/LegalDocumentPage.test.tsx`

Expected: FAIL on the old policy date/content.

- [ ] **Step 3: Update both policies accurately**

State that PostHog product analytics starts only after user consent, users can change the choice in General Settings, and session replay is disabled. Do not claim certifications, encryption properties, retention periods, or deletion guarantees not already implemented and verified.

- [ ] **Step 4: Write the exact support playbook**

The support document must contain ready-to-send English templates for:

- D0 welcome/quick start: three numbered actions and one support reply invitation;
- D2 stalled user: one question asking where they got stuck, sent only with contact consent;
- D7 value test: ask the user to search for one packed item and scan one label;
- D7–10 founder offer: one message, no fake scarcity, US$9 once, unlimited boxes + 20 Credits;
- payment issue acknowledgement with a request for Checkout Session ID but no card/payment details;
- AI recognition issue acknowledgement that requests box/session timing but not household photos by email;
- 15-minute interview script with five questions about trigger, prior method, setup friction, find-back moment, and willingness to pay;
- response SLA of 48 hours and a hard cap of five simultaneously guided users.

The document must say: do not contact users without opt-in; never paste emails or household content into PostHog; record feedback only as anonymized theme, severity, lifecycle stage, and whether it blocks activation.

- [ ] **Step 5: Test and commit**

Run: `npm test -- --run apps/web/src/features/legal/LegalDocumentPage.test.tsx`

Expected: PASS.

```bash
git add apps/web/src/content/legal/privacy.en-US.md apps/web/src/content/legal/privacy.zh-CN.md apps/web/src/features/legal/legal-policy.ts apps/web/src/features/legal/LegalDocumentPage.test.tsx docs/operations/three-box-reset-support.md
git commit -m "docs: add launch privacy and support operations"
```

---

### Task 8: Produce the demo, launch content, end-to-end check, and release runbook

**Files:**
- Create: `docs/operations/three-box-reset-content.md`
- Create: `apps/web/public/marketing/three-box-reset-demo.mp4`
- Create: `apps/web/e2e/growth-launch.spec.ts`
- Create: `docs/runbooks/three-box-reset-launch.md`
- Modify: `docs/runbooks/deployment.md`

**Interfaces:**
- Consumes: completed Tasks 1–7 and existing Playwright mock backend.
- Produces: final campaign media, deterministic browser smoke coverage, and the release gate.

- [ ] **Step 1: Write the 38-second demo production sheet**

Use this exact timeline in `three-box-reset-content.md`:

| Time | Visual | On-screen English copy |
|---|---|---|
| 0–3s | Three identical closed storage boxes | `Which box has the HDMI cable?` |
| 3–9s | Put real objects into Box 1 | `Pack normally.` |
| 9–15s | Take two in-app packing photos | `Photograph what went in.` |
| 15–22s | Show AI checklist, correct one result | `Nomo builds the list.` |
| 22–27s | Download/print and attach QR label | `Label the box.` |
| 27–33s | Search `HDMI cable`; show the box/space result | `Find anything later.` |
| 33–38s | Scan the label, then campaign CTA | `Try the free 3-Box Reset.` |

Record only self-owned household objects, use English UI, hide email/address/browser account UI, and use no user data. Export H.264/AAC, 1080×1920, 30 fps, 38 seconds ±3 seconds, fast-start enabled, and place it at the exact public path.

- [ ] **Step 2: Add the first four source scripts and channel adaptations**

Document four no-face videos with exact hook, six-shot sequence, caption, community disclosure, and CTA:

1. `I packed 37 items without typing their names.`
2. `Which box has the HDMI cable?`
3. `The system I wish I had before moving.`
4. `QR labels are useless if setup takes hours.`

For each, include 9:16 TikTok/Reels/Shorts copy and a 2:3 Pinterest version. Every CTA goes only to `/3-box-reset`; no platform gets a different offer in Phase One.

- [ ] **Step 3: Write and run the failing Playwright growth smoke**

Cover:

```ts
test('campaign explains the offer and starts registration without analytics before consent', async ({ page }) => {
  const posthogRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('posthog')) posthogRequests.push(request.url())
  })
  await page.goto('/3-box-reset')
  await expect(page.getByRole('heading', { name: 'Pack once. Find anything later.' })).toBeVisible()
  expect(posthogRequests).toEqual([])
  await page.getByRole('button', { name: 'No thanks' }).click()
  await page.getByRole('link', { name: 'Organize 3 boxes free' }).first().click()
  await expect(page).toHaveURL(/\/register\?campaign=three_box_reset/)
})
```

Add an authenticated mock flow that creates one space, one box, and one item and reaches the search/print affordances without console errors.

Run: `npm run test:e2e -- --grep "campaign explains|growth activation"`

Expected before final wiring: FAIL; after adapting to the existing mock backend: PASS.

- [ ] **Step 4: Write the exact launch runbook**

The runbook must have checkbox sections for:

1. Test environment migrations and database verification.
2. Four Test Mode USD Price objects and the existing server env mapping.
3. Checkout/Webhook deploy, event subscriptions, founder bonus, replay, full refund, and partial-refund observation.
4. Cloudflare Pages vars: Supabase, public origin, support email, PostHog key/host.
5. PostHog consent test, session replay disabled, named funnel, and exact event allowlist.
6. English iPhone Safari and Android Chrome real-device runs.
7. PWA add-to-home-screen, camera permission, QR scan, PDF download, AI success/failure-credit-release.
8. Production canary account and one controlled real payment/refund.
9. Rollback: stop campaign links, restore prior Cloudflare deployment, keep forward-only migrations, disable PostHog key, preserve Stripe/Webhook ledgers.
10. Launch record fields: deployment ID, migration list, Function versions, Price IDs, test event/session IDs, device/browser, operator, result, and unresolved risks; never record secrets.

Define the PostHog funnel as unique users in this order: `landing_view → signup_completed → space_created → box_created → first_item_created → purchase_completed`, with a second depth funnel `first_item_created → ai_analysis_completed → first_search_completed|qr_scanned`.

- [ ] **Step 5: Run repository verification**

Run:

```bash
npm run typecheck
npm run typecheck:billing
npm run typecheck:worker
npm run lint
npm test -- --run
npm run build
deno test --config supabase/functions/deno.json supabase/functions/billing-checkout/index_test.ts supabase/functions/stripe-webhook/index_test.ts
npm run test:worker
npm run test:e2e
npm run test:db
```

Expected: all available checks exit 0. If local Supabase is unavailable, record `npm run test:db` as a release blocker and run it in the configured staging environment before promotion.

- [ ] **Step 6: Perform the real-device gate**

Complete every checkbox in `docs/runbooks/three-box-reset-launch.md` in Stripe Test Mode on one iPhone Safari and one Android Chrome device. Save only pass/fail, timestamps, device/browser version, and non-sensitive Stripe identifiers in the launch record.

Expected: the complete English flow passes twice; session replay remains absent; events contain no forbidden data; successful founder checkout grants exactly one entitlement and one 20-Credit promotional grant.

- [ ] **Step 7: Commit**

```bash
git add docs/operations/three-box-reset-content.md apps/web/public/marketing/three-box-reset-demo.mp4 apps/web/e2e/growth-launch.spec.ts docs/runbooks/three-box-reset-launch.md docs/runbooks/deployment.md
git commit -m "test: add three box reset launch gate"
```

---

### Task 9: Run the private seed cohort on days 10–13

**Files:**
- Modify after each session: `docs/operations/three-box-reset-support.md` only when a reusable support answer changes.
- Record outside Git: the minimal cohort scorecard described below; do not store personal data in the repository.

**Interfaces:**
- Consumes: production campaign page, support templates, PostHog funnel, and five-user concurrency cap.
- Produces: at least 10 basic activations, qualitative friction themes, and the first opportunity for a real paid conversion.

- [ ] **Step 1: Recruit only high-intent users**

Find people who are currently moving or organizing a garage, basement, attic, or seasonal storage. Send 20–30 individual, context-specific invitations over four days. Start with personal network and rule-compliant community replies. Disclose `I built Nomo` before sharing the link. Do not mass-DM, buy lists, impersonate users, or pay for traffic.

- [ ] **Step 2: Onboard in cohorts of at most five**

Offer a 15-minute setup session or asynchronous support. Ask each participant to use real boxes and objects. The completion target is one space, one box, and one real item within 24 hours; the depth target is three boxes or AI plus search/scan within seven days.

- [ ] **Step 3: Follow up according to consent and lifecycle**

Use D0 for every participant through the channel they initiated. Use D2, D7, and D7–10 email templates only when `growth_contact_opt_in_at` exists. Send the founder offer once, only after demonstrated product value.

- [ ] **Step 4: Record the minimal daily scorecard**

Record only aggregate counts by date and channel:

```text
qualified conversations
campaign visits
signups
basic activations within 24h
deep activations within 7d
checkout starts
paid users
gross USD revenue
support hours
top three anonymized friction themes
```

Do not export emails, household content, search text, or QR data into the scorecard.

- [ ] **Step 5: Enforce the no-feature-detour rule**

Fix immediately only if the issue blocks registration, the first space/box/item, AI completion, search/QR, checkout, security, privacy, or data integrity. Log other requests. A new feature enters design only after the same blocking need appears independently at least five times.

---

### Task 10: Make the day-14 decision

**Files:**
- Create after cohort completion: `docs/operations/three-box-reset-phase-one-review.md`

**Interfaces:**
- Consumes: aggregate cohort scorecard, PostHog funnels, support themes, paid/refund records, and time spent.
- Produces: one explicit decision—proceed, repair activation, or repair value/offer.

- [ ] **Step 1: Reconcile the funnel**

Compare PostHog unique-user counts with aggregate operational counts. Investigate discrepancies larger than 10% as consent/identity/event-definition differences; do not “correct” analytics by adding household content.

- [ ] **Step 2: Calculate the Phase One metrics**

The review must include:

```text
visitor → signup
signup → basic activation within 24h
basic → deep activation
basic activation → paid
revenue
refunds
support hours per basic activation
deep activations per founder hour by channel
```

- [ ] **Step 3: Apply the decision rule**

- **Proceed to public weekly distribution** when there are at least 10 basic activations, at least 1 genuine paid user, no unresolved P0/P1 privacy/payment/data-integrity issue, and median guided setup is at most 20 minutes.
- **Repair activation before adding traffic** when signup-to-basic-activation is below 30%; choose the single largest observed funnel break and run a one-variable two-week experiment.
- **Repair value or offer before adding traffic** when at least 10 users deeply activate but nobody pays; interview at least five of them and test only one of value framing, free boundary, or price.
- **Extend the private cohort by seven days** when fewer than 10 qualified users actually attempt setup; this is a recruitment sample problem, not yet a product conclusion.

- [ ] **Step 4: Set the next two-week operating cadence only if proceeding**

Schedule exactly two original no-face English videos per week, adapt each to TikTok/Shorts/Reels/Pinterest, complete ten high-intent community conversations, guide at most five users, and review the funnel once. Keep cash spend under US$50 in month one and run no paid ads.

- [ ] **Step 5: Commit the anonymized review**

```bash
git add docs/operations/three-box-reset-phase-one-review.md
git commit -m "docs: review first three box reset cohort"
```

---

## Definition of Phase One complete

Phase One is complete only when all of the following are true:

- Tasks 1–8 are merged and deployed.
- Test and Live Stripe Price IDs are server-configured for the exact USD offers.
- A new production account receives 10 expiring Credits once.
- One Test Mode Founding Lifetime payment/replay/refund cycle is verified.
- English iPhone and Android real-device flows pass.
- PostHog receives only consented allowlisted events and no session replay.
- Support email is reachable and the 48-hour response workflow is active.
- The final campaign demo is visible on `/3-box-reset`.
- At least 10 qualified users complete basic activation, or the review explicitly classifies the sample as insufficient and extends private recruitment.
- The day-14 review chooses one next action and does not mix pricing, copy, and free-credit changes in the same experiment.
