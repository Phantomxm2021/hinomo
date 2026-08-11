# Continuous Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Carry a new user from their first space through their first box and first item without a dismissible or dead-end onboarding step.

**Architecture:** Existing space, box, and item data remain the only source of onboarding progress. URL parameters onboarding, space, and createItem only continue an active action; every stage reuses its current route and dialog. A small optional dismissible prop on ResponsiveEditorDialog prevents premature exit from the existing onboarding dialog.

**Tech Stack:** React 19, React Router, TanStack Query, React Hook Form, Vitest, Testing Library, TypeScript.

---

## File structure

- apps/web/src/components/ResponsiveEditorDialog.tsx: optional non-dismissible behavior; defaults unchanged.
- apps/web/src/features/dashboard/OnboardingWelcomeDialog.tsx and DashboardPage.tsx: strong guide and Dashboard recovery.
- apps/web/src/features/spaces/SpacesPage.tsx: space success/cancel continuation.
- apps/web/src/features/boxes/BoxForm.tsx, CreateBoxModal.tsx, BoxesPage.tsx, and PublicBoxPage.tsx: box prefill, box success continuation, and first-item guide.
- Corresponding existing test files: TDD coverage for each transition and regression boundary.

### Task 1: Make the existing onboarding dialog non-dismissible

**Files:**

- Modify: apps/web/src/components/ResponsiveEditorDialog.tsx
- Modify: apps/web/src/components/ResponsiveEditorDialog.test.tsx
- Modify: apps/web/src/features/dashboard/OnboardingWelcomeDialog.tsx
- Modify: apps/web/src/features/dashboard/OnboardingWelcomeDialog.test.tsx

- [ ] **Step 1: Write failing dialog tests**

Render ResponsiveEditorDialog with dismissible={false}; assert no close button, Escape, or backdrop click calls onClose. Keep the existing default dismissal test as the compatibility assertion.

    render(<ResponsiveEditorDialog open title="新手指南" busy={false} dismissible={false} onClose={onClose}><button>继续</button></ResponsiveEditorDialog>)
    expect(screen.queryByRole('button', { name: '关闭新手指南' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    fireEvent.mouseDown(screen.getByTestId('editor-dialog-backdrop'))
    expect(onClose).not.toHaveBeenCalled()

- [ ] **Step 2: Verify the test fails**

Run: npm test -- --run src/components/ResponsiveEditorDialog.test.tsx

Expected: failure because dismissible does not exist and the dialog can still close.

- [ ] **Step 3: Implement the guarded close path**

Add dismissible?: boolean with default true. Render the close button only when it is true, and make Escape/backdrop call a shared close() that requires both dismissible and !busy. Do not alter programmatic onClose calls from CTA handlers, focus trapping, or inert restoration.

    const close = useCallback(() => {
      if (dismissible && !busy) onClose()
    }, [busy, dismissible, onClose])

Add actionHref?: string to OnboardingWelcomeDialog, resolve it before progress.actionHref, and pass dismissible={false}. The CTA still calls onClose() followed by onStart(resolvedActionHref).

- [ ] **Step 4: Verify focused tests pass**

Run: npm test -- --run src/components/ResponsiveEditorDialog.test.tsx src/features/dashboard/OnboardingWelcomeDialog.test.tsx

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

    git add apps/web/src/components/ResponsiveEditorDialog.tsx apps/web/src/components/ResponsiveEditorDialog.test.tsx apps/web/src/features/dashboard/OnboardingWelcomeDialog.tsx apps/web/src/features/dashboard/OnboardingWelcomeDialog.test.tsx
    git commit -m "feat: keep onboarding guide active"

### Task 2: Resume any incomplete step on Dashboard

**Files:**

- Modify: apps/web/src/features/dashboard/DashboardPage.tsx
- Modify: apps/web/src/features/dashboard/DashboardPage.test.tsx

- [ ] **Step 1: Write failing recovery tests**

Use a profile whose onboarding_welcome_seen_at is already populated. Test data with one space/no box must open the box guide; data with one box/no item must open the item guide. Neither case may call markOnboardingWelcomeSeen again.

- [ ] **Step 2: Verify the test fails**

Run: npm test -- --run src/features/dashboard/DashboardPage.test.tsx

Expected: the existing onboarding_welcome_seen_at condition suppresses the dialog.

- [ ] **Step 3: Separate exposure recording from eligibility**

Keep allItemTotal === 0 and the existing account-wide progress derivation as eligibility. Remove onboarding_welcome_seen_at from the automatic-open condition; only call recordWelcomeSeen() when no timestamp exists.

Build CTA URLs with progress:

    const onboardingActionHref = onboardingProgress.currentStep === 'space'
      ? '/app/spaces?create=1&onboarding=space'
      : onboardingProgress.currentStep === 'box'
        ? '/app/boxes?create=1&onboarding=box'
        : onboardingProgress.actionHref

When Dashboard is reached as /app?onboarding=box&space=<id>, append the encoded space value to the box action URL. Ordinary Dashboard use leaves it absent.

- [ ] **Step 4: Verify and commit**

Run: npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/features/dashboard/OnboardingWelcomeDialog.test.tsx

    git add apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/dashboard/DashboardPage.test.tsx
    git commit -m "feat: resume incomplete onboarding on dashboard"

### Task 3: Continue after creating or cancelling a first space

**Files:**

- Modify: apps/web/src/features/spaces/SpacesPage.tsx
- Modify: apps/web/src/features/spaces/SpacesPage.test.tsx

- [ ] **Step 1: Write failing router tests**

At /app/spaces?create=1&onboarding=space, mock createSpace as { id: 'space-new' }, submit valid values, and expect /app?onboarding=box&space=space-new. Add a cancel test expecting /app?onboarding=space.

- [ ] **Step 2: Verify the tests fail**

Run: npm test -- --run src/features/spaces/SpacesPage.test.tsx

Expected: the editor only closes and remains on the space route.

- [ ] **Step 3: Branch on the existing URL marker only**

Capture createMutation.mutateAsync(input). When creating and onboarding=space, navigate with replace:

    navigate('/app?onboarding=box&space=' + encodeURIComponent(created.id), { replace: true })

In closeEditor, when that marker is present and no mutation is busy, navigate to /app?onboarding=space. Keep ordinary create/edit success, cancel, toast, and focus paths unchanged.

- [ ] **Step 4: Verify and commit**

Run: npm test -- --run src/features/spaces/SpacesPage.test.tsx

    git add apps/web/src/features/spaces/SpacesPage.tsx apps/web/src/features/spaces/SpacesPage.test.tsx
    git commit -m "feat: continue onboarding after space creation"

### Task 4: Prefill the new space and continue after a first box

**Files:**

- Modify: apps/web/src/features/boxes/BoxForm.tsx
- Modify: apps/web/src/features/boxes/CreateBoxModal.tsx
- Modify: apps/web/src/features/boxes/BoxesPage.tsx
- Modify: apps/web/src/features/boxes/BoxForm.test.tsx
- Modify: apps/web/src/features/boxes/CreateBoxModal.test.tsx
- Modify: apps/web/src/features/boxes/BoxesPage.test.tsx

- [ ] **Step 1: Write failing prefill and success-route tests**

Test BoxForm initialSpaceId="space-new" renders #box-space with that selected value. At /app/boxes?create=1&onboarding=box&space=space-new, finish mocked creation { public_id: 'box-new' } and expect /b/box-new?onboarding=item. Assert no transient BoxCreationNextStep appears.

- [ ] **Step 2: Verify the tests fail**

Run: npm test -- --run src/features/boxes/BoxForm.test.tsx src/features/boxes/CreateBoxModal.test.tsx src/features/boxes/BoxesPage.test.tsx

Expected: the select remains blank and creation stays on the catalogue.

- [ ] **Step 3: Add the smallest prop chain and branch**

Add initialSpaceId?: string from CreateBoxModal to BoxForm. In create mode, initialize space_id from it without overriding edit mode or a user-modified selection. BoxesPage passes it only for onboarding=box.

On CreateBoxModal.onCompleted, branch first when onboarding=box:

    navigate('/b/' + encodeURIComponent(box.public_id) + '?onboarding=item', { replace: true })

Do not set createdBox, start the success timer, or render BoxCreationNextStep in this branch. Cancellation returns to /app?onboarding=box and preserves a present space parameter.

- [ ] **Step 4: Verify and commit**

Run: npm test -- --run src/features/boxes/BoxForm.test.tsx src/features/boxes/CreateBoxModal.test.tsx src/features/boxes/BoxesPage.test.tsx

    git add apps/web/src/features/boxes/BoxForm.tsx apps/web/src/features/boxes/CreateBoxModal.tsx apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxForm.test.tsx apps/web/src/features/boxes/CreateBoxModal.test.tsx apps/web/src/features/boxes/BoxesPage.test.tsx
    git commit -m "feat: continue onboarding after box creation"

### Task 5: Open item recording and finish the flow

**Files:**

- Modify: apps/web/src/features/boxes/PublicBoxPage.tsx
- Modify: apps/web/src/features/boxes/PublicBoxPage.test.tsx

- [ ] **Step 1: Write failing item-guide tests**

At /b/box-new?onboarding=item, mock a writable empty box. Assert a non-dismissible item guide appears; its CTA opens the existing ItemEditorDialog. Canceling removes createItem but returns to the guide. Trigger first-item onSaved, then assert onboarding and createItem are absent and no guide remains.

- [ ] **Step 2: Verify the tests fail**

Run: npm test -- --run src/features/boxes/PublicBoxPage.test.tsx

Expected: neither query parameter is currently recognized.

- [ ] **Step 3: Reuse the current dialog and editor**

Import OnboardingWelcomeDialog and getOnboardingProgress. Derive onboardingItem only when onboarding=item and box.items.length === 0. The guide action URL is /b/<publicId>?onboarding=item&createItem=1; an effect opens the existing editor for createItem=1.

Clear only createItem in the editor close callback. In refreshItems, after existing invalidations, remove both parameters with replace when onboardingItem was active. Do not modify ordinary item creation or editing.

- [ ] **Step 4: Verify and commit**

Run: npm test -- --run src/features/boxes/PublicBoxPage.test.tsx src/features/items/ItemEditorDialog.test.tsx src/features/items/ItemForm.test.tsx

    git add apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx
    git commit -m "feat: guide first item recording"

### Task 6: Verify the complete feature

**Files:** No source changes expected.

- [ ] **Step 1: Run the complete web suite**

Run: npm test -- --run

Expected: all web tests pass.

- [ ] **Step 2: Run static and production checks**

Run each command independently:

    npm run typecheck
    npm run lint
    npm run build
    git diff --check

Expected: each exits with code 0; record a non-failing Vite chunk-size warning separately if present.

- [ ] **Step 3: Review scope**

Run: git diff main...HEAD --stat && git status --short

Expected: only the specification, this plan, and files named above have changed.
