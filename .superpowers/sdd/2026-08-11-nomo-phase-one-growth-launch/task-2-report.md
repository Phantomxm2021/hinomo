# Task 2 report — public 3-Box Reset campaign page

## Status

Complete in the focused commit described below, subject to the operational email-alias and demo-media follow-ups in **Concerns**.

## Delivered

- Added the public `/3-box-reset` route outside the protected `/app` tree.
- Added a localized, focused conversion page: compact brand header, hero, demo media, three-step workflow, iPhone/Android Home Screen guidance, free offer, Founding Lifetime offer, repeated CTA, and legal/support footer.
- CTA routing uses `/app` for authenticated visitors and `/register?campaign=three_box_reset` when signed out.
- Added consent-gated `landing_view` analytics for the current campaign visit. It uses `useSyncExternalStore` with the existing consent subscription and emits only campaign, locale, derived device category, and first-occurrence state after consent becomes accepted.
- Added required `VITE_PUBLIC_SUPPORT_EMAIL` schema validation and documented `support@hinomo.space`; both public marketing footers now use the configured `mailto:` link.
- Added the test-environment value in `apps/web/vite.config.ts` so imports of the validated public env remain executable in unit tests.
- The demo uses the required `/marketing/three-box-reset-demo.mp4` source and `/landing/hero-home-v2.jpg` poster. On media load failure, it leaves the visitor with an image-preview fallback instead of a broken media surface.

## Test-driven evidence

The focused test command was run before implementation and failed as expected:

```text
Failed to resolve import "./ThreeBoxResetPage"
expected undefined to be "/3-box-reset"
```

The resulting tests assert the English visible-copy contract, registration attribution, offer ordering after both demo and workflow sections, configured support address, public route placement, and deferred consent analytics capture.

## Final verification

```text
npm run test --workspace=@nomo/web -- --run src/features/marketing/ThreeBoxResetPage.test.tsx src/features/marketing/LandingPage.test.tsx src/app/router.test.tsx
```

Result: `3 passed` test files, `8 passed` tests (exit 0).

```text
npm run typecheck --workspace=@nomo/web
npm run lint --workspace=@nomo/web
npm run build
git diff --check
```

Result: all commands exited 0. The build retained two existing warnings: undefined `%VITE_PUBLIC_APP_ORIGIN%` index-html substitution in this local environment, and a >500 kB generated chunk warning.

## Concerns

- Creating/verifying the `support@hinomo.space` alias, routing it to the founder inbox, and validating a reply’s SPF/DKIM requires access to the email/DNS provider and mailbox. Those operational steps were not available in this worktree; do not deploy until they are completed.
- `/marketing/three-box-reset-demo.mp4` intentionally does not exist yet. The page handles that failure with its poster fallback, but the launch is not media-ready until the planned binary is supplied.
- Vitest emitted Node’s experimental localStorage-file warning; the test installs a browser-storage shim and all assertions passed.
