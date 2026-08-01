# Mobile Account Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move mobile avatar editing out of the “我的” tab into a dedicated account details route while keeping the tab as an account summary.

**Architecture:** `MyPage` continues to own locale and sign-out actions, but renders a navigation card for account identity. A new `AccountDetailsPage` owns profile/avatar loading and avatar upload. Both use the same React Query keys so the identity remains synchronized.

**Tech Stack:** React, React Router, TanStack Query, Vitest, Testing Library, Tailwind CSS.

---

### Task 1: Verify the summary contract

**Files:**
- Modify: `apps/web/src/features/profile/MyPage.test.tsx`

- [ ] **Step 1: Write the failing summary test**

```tsx
expect(await screen.findByText('lin@example.com')).toBeInTheDocument()
expect(screen.getByRole('link', { name: /林家.*lin@example.com/ })).toHaveAttribute('href', '/app/me/account')
expect(screen.queryByLabelText('更换头像')).not.toBeInTheDocument()
expect(screen.queryByLabelText('昵称')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and verify it fails because the avatar uploader and identity rows are still on the summary.**

Run: `npm test -- --run src/features/profile/MyPage.test.tsx`

- [ ] **Step 3: Replace the summary identity group with a `Link` card showing avatar, display name, email, and a chevron.**

- [ ] **Step 4: Run the focused test and verify it passes.**

Run: `npm test -- --run src/features/profile/MyPage.test.tsx`

### Task 2: Add the account details page

**Files:**
- Create: `apps/web/src/features/profile/AccountDetailsPage.tsx`
- Create: `apps/web/src/features/profile/AccountDetailsPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

- [ ] **Step 1: Write a failing page test that expects the avatar upload label and read-only nickname/email values.**

```tsx
expect(await screen.findByLabelText('更换头像')).toBeInTheDocument()
expect(screen.getByLabelText('昵称')).toHaveAttribute('readonly')
expect(screen.getByLabelText('邮箱')).toHaveValue('lin@example.com')
```

- [ ] **Step 2: Run the focused test and verify it fails because the route component does not exist.**

Run: `npm test -- --run src/features/profile/AccountDetailsPage.test.tsx`

- [ ] **Step 3: Implement `AccountDetailsPage` with existing profile/avatar queries, `AvatarUploadControl`, upload mutation invalidation, and mobile feedback. Register it at `/app/me/account`.**

- [ ] **Step 4: Run profile tests and verify they pass.**

Run: `npm test -- --run src/features/profile/MyPage.test.tsx src/features/profile/AccountDetailsPage.test.tsx`

### Task 3: Verify and commit

**Files:**
- Modify: `apps/web/src/features/profile/MyPage.tsx`
- Create: `apps/web/src/features/profile/AccountDetailsPage.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Tests: `apps/web/src/features/profile/MyPage.test.tsx`, `apps/web/src/features/profile/AccountDetailsPage.test.tsx`

- [ ] **Step 1: Run all frontend tests, lint, and build.**

Run: `npm test -- --run && npm run lint && npm run build`

- [ ] **Step 2: Inspect staged changes with `git diff --cached --check`.**

- [ ] **Step 3: Commit the focused account-summary change.**

```bash
git commit -m "feat: move avatar editing to account details"
```
