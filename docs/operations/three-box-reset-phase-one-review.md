# Three-Box Reset Phase One review

**Review type:** anonymized day-14 template and current decision record
**Review date:** 2026-08-11
**Cohort window:** `[YYYY-MM-DD]` to `[YYYY-MM-DD]`
**Decision owner:** `[role, not a person]`
**Data status:** insufficient / not yet collected

This record is intentionally aggregate-only. The repository contains no external
cohort, payment, support, or analytics data, so this review does not invent
counts, rates, revenue, or times. Complete the bracketed fields from the
aggregate scorecard, PostHog funnels, support log, and Stripe records only.

## Current decision

**Decision: extend the private cohort by seven days.**

The minimum qualified setup sample cannot be verified here: no external cohort
was executed and fewer than 10 qualified users actually attempting setup has
not been disproved with an aggregate scorecard. This is a recruitment/sample
decision, not a conclusion that the product has failed. Do not add public
traffic, schedule the public weekly content cadence, or change pricing/free
credits during this extension.

| Decision field | Current record |
| --- | --- |
| Decision | Extend private cohort by seven days |
| Effective date | 2026-08-11 |
| Next review date | `[2026-08-18]` |
| Qualified users attempting setup | Unknown — external scorecard required |
| Basic activations | Unknown — external scorecard required |
| Paid users / refunds | Unknown — Stripe aggregate required |
| Unresolved P0/P1 issue | Unknown — launch/support review required |
| Owner | `[growth/product role]` |
| Actions | Recruit the private cohort, collect the aggregate scorecard, reconcile funnels, then rerun this review |

## Data boundary and reconciliation

Use one fixed UTC date range and the same channel definitions for every source.
PostHog is a consented, unique-user view; the operational scorecard is an
aggregate count by date and channel. Neither source should contain email
addresses, names, household content, item names, search text, QR contents,
payment details, or support transcripts.

For each stage, record the two source counts and calculate:

```text
discrepancy % = abs(PostHog unique users - operational count)
                / max(PostHog unique users, operational count, 1) × 100
```

Treat a result **over 10%** as an investigation, not as permission to edit one
source until it matches the other. Check, in order:

1. consent coverage (declined/unset visitors are absent from PostHog);
2. anonymous-to-authenticated identity merges and duplicate accounts;
3. exact event eligibility and first-occurrence rules;
4. timezone/date-window and channel attribution differences;
5. retries, blocked requests, ad/privacy extensions, and missing operational rows.

Record the explanation and the source of truth for the next run. Never add
household content to “correct” an event or export it to analytics.

| Funnel stage | PostHog unique users | Operational count | Discrepancy % | Explanation / owner / due date |
| --- | ---: | ---: | ---: | --- |
| Visitor → signup | Unknown | Unknown | N/A | `[investigation]` |
| Signup → basic ≤24h | Unknown | Unknown | N/A | `[investigation]` |
| Basic → deep | Unknown | Unknown | N/A | `[investigation]` |
| Basic → paid | Unknown | Unknown | N/A | `[investigation]` |

## Phase One metric sheet

Use unique users for user-to-user rates. Keep the numerator and denominator in
the same cohort and date window; write `N/A` when a denominator is zero and
`Unknown` when the source has not been collected.

| Metric | Definition | Numerator | Denominator | Result | Source / owner |
| --- | --- | ---: | ---: | ---: | --- |
| Visitor → signup | Signups divided by campaign visitors | Unknown | Unknown | Unknown | PostHog + scorecard / `[role]` |
| Signup → basic activation ≤24h | A signup with first space, box, and item saved within 24 hours divided by signups | Unknown | Unknown | Unknown | PostHog + scorecard / `[role]` |
| Basic → deep activation | Deep activations within seven days divided by basic activations | Unknown | Unknown | Unknown | PostHog + scorecard / `[role]` |
| Basic activation → paid | Genuine paid users divided by basic activations | Unknown | Unknown | Unknown | Stripe + scorecard / `[role]` |
| Revenue (gross USD) | Settled gross USD from the cohort in the window, before refunds | Unknown | — | Unknown | Stripe / `[role]` |
| Refunds (USD and count) | Refunded USD and number of refunded payments in the window | Unknown | — | Unknown | Stripe / `[role]` |
| Support hours / basic activation | Logged guided-support hours divided by basic activations | Unknown | Unknown | Unknown | Support log + scorecard / `[role]` |
| Deep activations / founder hour by channel | Deep activations attributed to a channel divided by founder hours spent on that channel | Unknown | Unknown | Unknown | Scorecard + time log / `[role]` |

For this review, a **basic activation** is one space, one box, and one saved
real item within 24 hours of signup. A **deep activation** is a basic user who
also completes the value loop within seven days: AI packing completion plus a
successful search or QR scan. A **genuine paid user** is a settled, non-refunded
customer; a pending or fully refunded checkout does not count.

### Current sample classification

- Qualified users attempting setup: **Unknown**.
- Basic activations: **Unknown**.
- Deep activations: **Unknown**.
- Paid users: **Unknown**.
- Revenue, refunds, support hours, and founder hours: **Unknown**.
- Conclusion: **sample insufficient; extend private recruitment seven days**.

## Decision rules

Apply the first rule whose complete evidence is available. If the sample is too
small to evaluate a product rule, keep the cohort private and collect the
missing evidence rather than interpreting the missing value as zero.

### Proceed to public weekly distribution

Proceed only when **all** conditions hold:

- at least 10 basic activations;
- at least 1 genuine paid user;
- no unresolved P0/P1 privacy, payment, or data-integrity issue; and
- median guided setup is at most 20 minutes.

Current status: **not evaluated; do not proceed**.

### Repair activation before adding traffic

Use this when signup-to-basic activation is below 30%. Choose the single
largest observed funnel break and run one one-variable two-week experiment.
Do not add traffic during that experiment.

Current status: **not evaluated; denominator unknown**.

### Repair value or offer before adding traffic

Use this when at least 10 users deeply activate but nobody pays. Interview at
least five of those users, then test exactly one of value framing, the free
boundary, or price. Do not combine those variables.

Current status: **not evaluated; deep and paid counts unknown**.

### Extend the private cohort by seven days

Use this when fewer than 10 qualified users actually attempt setup. Treat it
as a recruitment sample problem, not a product conclusion. This is the
current decision because the attempt count is not available and no external
cohort data exists in this environment.

## Extension actions and owners

Complete these during the seven-day extension. Use role labels only; do not
put personal data in this document.

| Action | Owner role | Due | Evidence |
| --- | --- | --- | --- |
| Send 20–30 individual, context-specific invitations; disclose “I built Nomo” | `[growth role]` | `[YYYY-MM-DD]` | Aggregate invitations and qualified conversations by channel |
| Guide cohorts of at most five users; offer a 15-minute setup or async help | `[support role]` | Daily | Aggregate support hours and basic attempts |
| Send D0/D2/D7/D7–10 only where contact opt-in is recorded | `[lifecycle role]` | Daily | Counts only; no addresses or message transcripts |
| Record the aggregate scorecard by date and channel | `[analytics role]` | Daily | Scorecard snapshot |
| Reconcile PostHog and operational counts; investigate >10% differences | `[analytics role]` | `[YYYY-MM-DD]` | Completed reconciliation table |
| Repeat day-14 decision review | `[growth/product role]` | `[2026-08-18]` | Updated decision and sign-off |

## Conditional two-week cadence

This cadence is **not scheduled under the current extension decision**. Create a
schedule only after the decision is “Proceed to public weekly distribution.”
If proceeding, the exact cadence is:

- publish exactly two original, no-face English videos per week;
- adapt each video to TikTok, Shorts, Reels, and Pinterest;
- complete ten high-intent community conversations;
- guide at most five users at a time;
- review the funnel once during the two weeks;
- keep month-one cash spend under US$50; and
- run no paid ads.

| Cadence owner | Start | End | Scheduled? | Review evidence |
| --- | --- | --- | --- | --- |
| `[growth role]` | `[YYYY-MM-DD]` | `[YYYY-MM-DD]` | No — proceed gate not met | `[link or aggregate record]` |

## Sign-off

| Role | Decision / notes | Date |
| --- | --- | --- |
| Growth/product owner | Extend private cohort by seven days; `[notes]` | `[YYYY-MM-DD]` |
| Analytics owner | Reconciliation complete or blockers listed: `[notes]` | `[YYYY-MM-DD]` |
| Support owner | Support themes and hours recorded without personal data: `[notes]` | `[YYYY-MM-DD]` |
| Finance/billing owner | Revenue/refund aggregate verified or unavailable: `[notes]` | `[YYYY-MM-DD]` |
