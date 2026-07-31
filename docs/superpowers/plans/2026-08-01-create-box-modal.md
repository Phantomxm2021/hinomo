# Create Box Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every in-app create-box page transition with an accessible URL-driven modal over the boxes list while preserving the existing form, R2 upload, and QR success workflow.

**Architecture:** Extract the current form workflow into a reusable `BoxForm` component. Keep `BoxFormPage` as the edit-route wrapper, add `CreateBoxModal` for dialog behavior, and let `BoxesPage` derive modal state from `?create=1`. Redirect the legacy create route to the query-driven boxes URL.

**Tech Stack:** React 19, TypeScript 6, React Router 7, TanStack Query 5, React Hook Form, Tailwind CSS 4, Vitest, Testing Library, Playwright.

---

### Task 1: Extract a reusable box form without changing behavior

**Files:**
- Create: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.test.tsx`

- [ ] **Step 1: Add a failing wrapper contract test**

Mock `BoxForm` in `BoxFormPage.test.tsx` and verify the route wrapper passes the edit identifier:

```tsx
expect(mockBoxForm).toHaveBeenCalledWith(
  expect.objectContaining({ boxId: 'box-1', presentation: 'page' }),
  undefined,
)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test -- --run src/features/boxes/BoxFormPage.test.tsx
```

Expected: failure because `BoxForm` does not exist and `BoxFormPage` still owns the workflow.

- [ ] **Step 3: Move the existing workflow into `BoxForm`**

Define the reusable boundary in `BoxForm.tsx`:

```tsx
type BoxFormProps = {
  boxId?: string
  presentation: 'page' | 'modal'
  onBusyChange?: (busy: boolean) => void
  onCreated?: (box: CreatedBox) => void
  onDone?: () => void
}

export function BoxForm({
  boxId,
  presentation,
  onBusyChange,
  onCreated,
  onDone,
}: BoxFormProps) {
  const editing = Boolean(boxId)
  // Preserve the current form, upload, retry, QR, and edit behavior.
}
```

Use `presentation` only to choose page framing versus modal content framing. Call `onBusyChange` from an effect using create/update mutation state and `isUploadPending(mediaUpload.stage)`. Call `onCreated(box)` immediately after the database record is created. Add a “完成” button to the create success result only when `onDone` is present.

- [ ] **Step 4: Reduce `BoxFormPage` to the edit wrapper**

```tsx
export function BoxFormPage() {
  const { boxId } = useParams<{ boxId: string }>()
  return <BoxForm boxId={boxId} presentation="page" />
}
```

- [ ] **Step 5: Re-run the form tests, typecheck, and lint**

Run:

```bash
npm run test -- --run src/features/boxes/BoxFormPage.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands pass and existing create/edit/upload/QR behavior remains covered.

- [ ] **Step 6: Commit the extraction**

```bash
git add apps/web/src/features/boxes/BoxForm.tsx apps/web/src/features/boxes/BoxFormPage.tsx apps/web/src/features/boxes/BoxFormPage.test.tsx
git commit -m "refactor: extract reusable box form"
```

### Task 2: Build the accessible create modal

**Files:**
- Create: `apps/web/src/features/boxes/CreateBoxModal.tsx`
- Create: `apps/web/src/features/boxes/CreateBoxModal.test.tsx`

- [ ] **Step 1: Write failing dialog behavior tests**

Cover these observable contracts:

```tsx
expect(screen.getByRole('dialog', { name: '创建箱子' })).toHaveAttribute('aria-modal', 'true')
expect(document.querySelector('[data-app-shell]')).toHaveAttribute('inert')
expect(document.body.style.overflow).toBe('hidden')
```

Also verify Escape, backdrop and the close button call `onClose`; Tab wraps inside the dialog; `busy=true` prevents every dismissal path; and the component restores shell attributes/body overflow on unmount.

- [ ] **Step 2: Run the modal test and verify RED**

Run:

```bash
npm run test -- --run src/features/boxes/CreateBoxModal.test.tsx
```

Expected: failure because `CreateBoxModal` does not exist.

- [ ] **Step 3: Implement `CreateBoxModal` as a portal**

Use this public interface:

```tsx
type CreateBoxModalProps = {
  open: boolean
  onClose: () => void
  onCreated: (box: CreatedBox) => void
  onDone: () => void
}
```

The component owns a `busy` state updated by `BoxForm.onBusyChange`, portals to `document.body`, applies `inert`/`aria-hidden` to `[data-app-shell]`, locks body scrolling, and renders:

```tsx
<section role="dialog" aria-modal="true" aria-labelledby="create-box-modal-title">
  <h2 id="create-box-modal-title">创建箱子</h2>
  <button type="button" aria-label="关闭创建箱子" disabled={busy}>...</button>
  <BoxForm presentation="modal" onBusyChange={setBusy} onCreated={onCreated} onDone={onDone} />
</section>
```

Use bottom-sheet alignment on mobile and centered alignment at `sm`; cap height with `max-h-[calc(100dvh-1.5rem)]` and allow internal vertical scrolling.

- [ ] **Step 4: Re-run modal tests and adjacent form tests**

Run:

```bash
npm run test -- --run src/features/boxes/CreateBoxModal.test.tsx src/features/boxes/BoxFormPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit the modal**

```bash
git add apps/web/src/features/boxes/CreateBoxModal.tsx apps/web/src/features/boxes/CreateBoxModal.test.tsx
git commit -m "feat: add create box modal"
```

### Task 3: Drive the modal from the boxes URL and migrate entry points

**Files:**
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/app/AppShell.test.tsx`

- [ ] **Step 1: Add failing URL-driven modal tests**

Render `BoxesPage` at `/app/boxes?space=space-1&create=1` and verify the modal opens. Close it and assert the resulting location is `/app/boxes?space=space-1`. Verify `onCreated` invalidates `['boxes']` and “完成” closes the modal.

Add routing assertions that:

```tsx
expect(createLink).toHaveAttribute('href', '/app/boxes?create=1')
```

for the dashboard entry, and that `/app/boxes/new` redirects to `/app/boxes?create=1`.

- [ ] **Step 2: Run page/router tests and verify RED**

Run:

```bash
npm run test -- --run src/features/boxes/BoxesPage.test.tsx src/features/dashboard/DashboardPage.test.tsx src/app/AppShell.test.tsx
```

Expected: failures because links still point to `/app/boxes/new` and `BoxesPage` does not render a modal.

- [ ] **Step 3: Integrate `CreateBoxModal` into `BoxesPage`**

Derive modal state from search params:

```tsx
const creating = searchParams.get('create') === '1'

function closeCreate() {
  const next = new URLSearchParams(searchParams)
  next.delete('create')
  setSearchParams(next, { replace: true })
}
```

Replace both list-page create links with buttons that set `create=1` while retaining existing parameters. Render `CreateBoxModal`; invalidate `['boxes']` from `onCreated`, and close/focus the persistent header action from `onDone`.

- [ ] **Step 4: Migrate dashboard and legacy route**

Change dashboard creation links to `/app/boxes?create=1`. Replace the `boxes/new` route element with:

```tsx
<Navigate replace to="/app/boxes?create=1" />
```

Keep `boxes/:boxId/edit` mapped to `BoxFormPage`.

- [ ] **Step 5: Run integration tests and verify GREEN**

Run:

```bash
npm run test -- --run src/features/boxes/BoxesPage.test.tsx src/features/dashboard/DashboardPage.test.tsx src/app/AppShell.test.tsx
npm run typecheck
npm run lint
```

Expected: all tests pass.

- [ ] **Step 6: Commit URL integration**

```bash
git add apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/dashboard/DashboardPage.test.tsx apps/web/src/app/router.tsx apps/web/src/app/AppShell.test.tsx
git commit -m "feat: open box creation from list modal"
```

### Task 4: Update end-to-end creation flow and verify responsive behavior

**Files:**
- Modify: `apps/web/e2e/mock-backend.ts`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: Update the E2E helper to use the modal**

Change `createBox()` to navigate to `/app/boxes`, click “创建箱子”, and target:

```ts
const dialog = page.getByRole('dialog', { name: '创建箱子' })
await dialog.getByLabel('空间').selectOption({ label: '家' })
await dialog.getByLabel('箱子名称').fill(name)
await dialog.getByRole('button', { name: '创建箱子' }).click()
await expect(dialog.getByText(/BX-\d{5}/)).toBeVisible()
```

After reading the public link, click “完成”, assert the dialog is hidden, and assert the new box card is visible.

- [ ] **Step 2: Add responsive and navigation assertions**

Verify desktop, iPhone and Pixel projects all keep the pathname at `/app/boxes` while the modal is open, display the success QR state, and have no horizontal overflow. Add a direct `/app/boxes/new` assertion that lands on `/app/boxes?create=1` with the dialog open.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

Expected: all Vitest files pass; TypeScript, Oxlint and Vite build exit 0; all desktop/iPhone/Pixel Playwright tests pass; `git diff --check` prints nothing.

- [ ] **Step 4: Commit E2E updates**

```bash
git add apps/web/e2e/mock-backend.ts apps/web/e2e/core-flow.spec.ts
git commit -m "test: cover create box modal flow"
```
