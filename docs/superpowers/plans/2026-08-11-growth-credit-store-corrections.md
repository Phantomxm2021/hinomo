# Growth credits and store corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove subscription wording, expose all Phase One one-time products with consistent USD prices, and provide a safe idempotent operation to credit the pre-migration controlled account.

**Architecture:** Keep Stripe Price IDs and amounts server-controlled. Add the existing unlimited-box checkout action to the Credits catalogue without introducing a client Price ID. Keep the signup trigger for post-migration users and document a service-role-only, user-scoped backfill for historical accounts.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Supabase Postgres/pgTAP, Markdown runbooks, Stripe Checkout Edge Functions.

---

### Task 1: Remove subscription wording and synchronize active legal prices

**Files:**
- Modify: `apps/web/src/i18n/messages.ts` registration opt-in copy in both locale trees
- Modify: `apps/web/src/content/legal/terms.zh-CN.md`
- Modify: `apps/web/src/content/legal/terms.en-US.md`
- Modify: `docs/ai-credits-stripe.md`
- Test: `apps/web/src/features/auth/RegisterPage.test.tsx`
- Test: `apps/web/src/features/legal/LegalDocumentPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

  Add assertions that the rendered registration opt-in copy contains the new “stop receiving emails” meaning in Chinese and English and contains none of `订阅`, `取消订阅`, or `unsubscribe`. Add legal assertions that the active terms show US$9 for Unlimited Boxes and do not show the stale HK$38 amount.

- [ ] **Step 2: Run focused tests to verify they fail**

  Run `npm run test --workspace=@nomo/web -- --run src/features/auth/RegisterPage.test.tsx src/features/legal/LegalDocumentPage.test.tsx`.

  Expected: FAIL because the current Chinese/English opt-in strings use unsubscribe wording and both terms files still state HK$38.

- [ ] **Step 3: Implement the minimal copy changes**

  Change the Chinese registration opt-in to `接收整理建议和一次性创始人优惠。我可以随时停止接收这些邮件。` and the English copy to `Email me setup tips and the one-time founder offer. I can stop receiving these emails at any time.` Replace active terms references to HK$38 with US$9. Update `docs/ai-credits-stripe.md` only where its current authoritative USD table or explanation conflicts with the active product copy; leave clearly labeled historical archive material unchanged.

- [ ] **Step 4: Run focused tests to verify they pass**

  Run the same Vitest command and expect all targeted tests to pass.

- [ ] **Step 5: Commit**

  Run `git add apps/web/src/i18n/messages.ts apps/web/src/content/legal/terms.zh-CN.md apps/web/src/content/legal/terms.en-US.md docs/ai-credits-stripe.md apps/web/src/features/auth/RegisterPage.test.tsx apps/web/src/features/legal/LegalDocumentPage.test.tsx && git commit -m "fix: align one-time commerce copy"`.

---

### Task 2: Add a visible four-product one-time catalogue

**Files:**
- Modify: `apps/web/src/features/credits/CreditsPage.tsx`
- Modify: `apps/web/src/features/credits/credits.api.ts`
- Modify: `apps/web/src/i18n/messages.ts`
- Test: `apps/web/src/features/credits/CreditsPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

  Extend the Credits page tests to render the page with a successful summary and assert visible product cards/buttons for `20 Credits — US$2.99`, `100 Credits — US$9.99`, `500 Credits — US$34.99`, and `Unlimited Boxes — US$9 one-time`. Assert clicking the unlimited button calls the existing `startBoxUnlimitedCheckout` action and that the page copy says one-time/no auto-renewal.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run `npm run test --workspace=@nomo/web -- --run src/features/credits/CreditsPage.test.tsx`.

  Expected: FAIL because the current page renders only the three Credits packs and has no unlimited-box product card.

- [ ] **Step 3: Implement the minimal catalogue entry**

  Reuse `startBoxUnlimitedCheckout` from `box-entitlements.api.ts` through a small mutation on `CreditsPage`. Add localized product title, description, exact US$9 one-time price, and no-auto-renewal copy. Do not pass an amount or Stripe Price ID from the client. Keep the existing Boxes-page paywall and purchase confirmation flow unchanged.

- [ ] **Step 4: Run focused tests and typecheck**

  Run `npm run test --workspace=@nomo/web -- --run src/features/credits/CreditsPage.test.tsx` and `npm run typecheck --workspace=@nomo/web`; expect both to pass.

- [ ] **Step 5: Commit**

  Run `git add apps/web/src/features/credits/CreditsPage.tsx apps/web/src/features/credits/credits.api.ts apps/web/src/i18n/messages.ts apps/web/src/features/credits/CreditsPage.test.tsx && git commit -m "feat: show unlimited boxes in product catalogue"`.

---

### Task 3: Document and verify the historical Credits backfill

**Files:**
- Create: `docs/runbooks/growth-credits-backfill.md`
- Modify: `supabase/tests/database/024_growth_launch_credits.test.sql`
- Modify: `docs/runbooks/three-box-reset-launch.md`

- [ ] **Step 1: Write the failing database assertions**

  Extend the pgTAP source/fixture coverage to assert that the historical operation uses `public.grant_credits` with `kind = promotional`, amount 10, expiry exactly 30 days, and a per-user `backfill:<uuid>:growth-launch-v1` source reference. Assert that the operation is service-role-only and that repeating the same source reference leaves one grant and one transaction.

- [ ] **Step 2: Run the focused database test to verify the environment/result**

  Run `npm run test:db`. Expected in an environment with Supabase/Docker: the database suite passes. If unavailable, record the exact environment blocker in the task report and continue with static SQL review; do not claim the database test passed.

- [ ] **Step 3: Add the operator-only backfill runbook**

  Document the safe sequence: identify the controlled user ID outside Git, confirm the signup migration is applied, call `public.grant_credits` through a service-role SQL session with `promotional`, `10`, `now()`, `now() + interval '30 days'`, and `backfill:<user_uuid>:growth-launch-v1`, then query `credit_grants` and `credit_transactions` to verify one row each. State that the user ID, email, service-role key, and query output containing personal data must not be committed.

- [ ] **Step 4: Add the launch gate reference**

  Link the backfill runbook from the Three-Box Reset launch gate and state that historical seed users require this explicit operation; the signup trigger covers only users inserted after migration deployment.

- [ ] **Step 5: Run available verification and commit**

  Run `git diff --check`, focused source/SQL checks, and any available `npm run test:db`; then commit with `git add docs/runbooks/growth-credits-backfill.md docs/runbooks/three-box-reset-launch.md supabase/tests/database/024_growth_launch_credits.test.sql && git commit -m "docs: add historical credits backfill runbook"`.

---

### Final verification

- [ ] Run `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`, `npm run typecheck:billing`, `npm run typecheck:worker`, `npm run test:worker`, and the focused Credits/register/legal tests.
- [ ] Run the focused Playwright growth smoke and confirm all four product labels are visible in the authenticated Credits page.
- [ ] Run `git diff --check` and confirm `git status --short` is clean.
- [ ] Manually run the controlled historical-user SQL operation with service role and record only aggregate/non-sensitive verification results.
