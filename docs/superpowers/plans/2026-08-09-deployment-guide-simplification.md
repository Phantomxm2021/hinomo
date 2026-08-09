# Deployment Guide Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deployment runbook usable for the current Nomo release without requiring operators to understand historical migrations.

**Architecture:** Replace the front of `docs/runbooks/deployment.md` with a short current-release path: identify environment, inspect migration state, apply the staged migration order, configure secrets, verify, and publish. Move legacy/specialized detail into a clearly labeled appendix in a separate archive document, while linking back to the quick path.

**Tech Stack:** Markdown, Supabase SQL Editor, Stripe, Cloudflare Pages/R2, existing repository documentation tests.

---

### Task 1: Rewrite the operator-facing quick path

**Files:**
- Modify: `docs/runbooks/deployment.md`
- Create: `docs/runbooks/deployment-details-archive.md`

- [x] **Step 1: Preserve the existing detailed runbook as an archive**

Copy the current specialized sections (AI packing, AI Credits/Stripe, box entitlement, observability, rollback, and historical migration notes) into `deployment-details-archive.md`, label it as reference-only, and add a link to the current quick path.

- [x] **Step 2: Write the current release quick path**

Make `deployment.md` lead with the current release baseline, a migration-status query, the exact staged order (`202608090001` through `202608090005`), secrets/configuration checklist, test-mode acceptance, production switch, and rollback pointer. Each section must say who performs it and what success looks like.

- [x] **Step 3: Add a “which version do I start from?” decision**

Document that operators should run the read-only migration query first, start after the latest applied migration, and never rerun an applied migration. Explicitly call out the two staged exceptions: box entitlement `002 → 004 → 005 → functions → frontend/cache drain → 003`, and venue sharing `001 → 002 → 003 → 004 → 005`.

- [x] **Step 4: Validate documentation contracts**

Run the existing legal/documentation tests, `git diff --check`, and a link/heading scan. Confirm that all required Stripe delayed-payment events, paid-only HK$38 box checkout, invite kill switch, and forward-only rollback instructions remain discoverable from the quick path or its archive link.

- [x] **Step 5: Commit the documentation change**

```bash
git add docs/runbooks/deployment.md docs/runbooks/deployment-details-archive.md
git commit -m "docs: simplify current deployment runbook"
```
