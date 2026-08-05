# Editor Dialogs and JPEG Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make item creation, item editing, and box editing responsive modal interactions on every viewport, and encode all newly compressed ordinary-media and avatar uploads as JPEG.

**Architecture:** Add one portal-based responsive editor shell that owns modal mechanics while existing forms continue to own validation and persistence. Wrap `ItemForm` and `BoxForm` in focused editor components, open them from catalogue/detail state instead of navigation or in-flow rendering, and retain the old box-edit URL as a redirect into modal state. Change only compression output options; signing and upload continue using the compressed file's actual MIME type.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, React Hook Form, browser-image-compression, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Mobile editor presentation remains a bottom sheet; desktop editor presentation is a centered, scrollable modal.
- Creating or editing an item and editing a box must never insert a form into page flow or render a standalone edit page.
- Saving or uploading blocks Escape, backdrop, and close-button dismissal.
- Existing WebP objects remain readable; only new compression output changes.
- AI packing photos and atlases remain unchanged because they already use JPEG.
- Do not alter database MIME constraints or migrate stored media.

---

### Task 1: Reusable responsive editor shell

**Files:**
- Create: `apps/web/src/components/ResponsiveEditorDialog.tsx`
- Create: `apps/web/src/components/ResponsiveEditorDialog.test.tsx`
- Modify: `apps/web/src/features/boxes/CreateBoxModal.tsx`
- Modify: `apps/web/src/features/boxes/CreateBoxModal.test.tsx`

**Interfaces:**
- Produces: `ResponsiveEditorDialog({ open, title, busy, onClose, children, initialFocusSelector?, maxWidthClassName?, returnFocusRef? })`.
- `busy` prevents all dismissal paths and sets `aria-busy`.
- `returnFocusRef` has type `React.RefObject<HTMLElement | null>` and is focused after close/unmount.
- `CreateBoxModal` consumes the shell without changing its public props.

- [ ] **Step 1: Write failing shell behavior tests**

Add tests that render an app shell plus the dialog and assert the portal, responsive classes, focus isolation, scroll lock, Escape/backdrop/close dismissal, busy blocking, and focus restoration:

```tsx
test('renders a modal overlay and isolates the application', () => {
  render(<><main data-app-shell>App</main><ResponsiveEditorDialog open title="编辑" busy={false} onClose={vi.fn()}><input aria-label="名称" /></ResponsiveEditorDialog></>)
  expect(screen.getByRole('dialog', { name: '编辑' })).toHaveAttribute('aria-modal', 'true')
  expect(screen.getByRole('dialog', { name: '编辑' })).toHaveClass('lg:rounded-shell')
  expect(document.querySelector('[data-app-shell]')).toHaveAttribute('inert')
  expect(document.body.style.overflow).toBe('hidden')
})

test('blocks dismissal while busy', async () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<ResponsiveEditorDialog open title="编辑" busy onClose={onClose}><input /></ResponsiveEditorDialog>)
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: '关闭编辑' }))
  fireEvent.mouseDown(screen.getByTestId('editor-dialog-backdrop'))
  expect(onClose).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm --prefix apps/web test -- ResponsiveEditorDialog.test.tsx`

Expected: FAIL because `ResponsiveEditorDialog` does not exist.

- [ ] **Step 3: Implement the minimal reusable shell**

Create a portal component with this public type and mechanics:

```tsx
export type ResponsiveEditorDialogProps = {
  open: boolean
  title: string
  busy: boolean
  onClose: () => void
  children: ReactNode
  initialFocusSelector?: string
  maxWidthClassName?: string
  returnFocusRef?: RefObject<HTMLElement | null>
}
```

The implementation must:

- render nothing when `open` is false;
- render a `role="dialog"`, `aria-modal="true"` section through `createPortal`;
- use bottom alignment and `rounded-t-[1.5rem]` by default, plus `lg:items-center` and `lg:rounded-shell` on desktop;
- set `[data-app-shell]` to `inert` and `aria-hidden="true"`, lock `document.body.style.overflow`, and restore prior values during cleanup;
- focus `initialFocusSelector ?? 'select:not(:disabled), input:not(:disabled), textarea:not(:disabled)'` after render;
- include before/after focus sentinels that cycle through enabled controls;
- call `onClose` for Escape, backdrop mouse-down, or the close button only when `busy === false`;
- restore `returnFocusRef.current` on cleanup through `requestAnimationFrame`.

- [ ] **Step 4: Run shell tests and verify GREEN**

Run: `npm --prefix apps/web test -- ResponsiveEditorDialog.test.tsx`

Expected: PASS.

- [ ] **Step 5: Refactor create-box modal onto the shell**

Replace the duplicated portal/focus/inert implementation with:

```tsx
<ResponsiveEditorDialog
  open={open}
  title="创建箱子"
  busy={busy}
  onClose={onClose}
  maxWidthClassName="max-w-3xl"
>
  <BoxForm presentation="modal" onBusyChange={changeBusy} onCompleted={onCompleted} />
</ResponsiveEditorDialog>
```

Keep `CreateBoxModal`'s existing callback behavior and update its tests to assert the same isolation and busy behavior through the shared shell.

- [ ] **Step 6: Run focused tests**

Run: `npm --prefix apps/web test -- ResponsiveEditorDialog.test.tsx CreateBoxModal.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ResponsiveEditorDialog.tsx apps/web/src/components/ResponsiveEditorDialog.test.tsx apps/web/src/features/boxes/CreateBoxModal.tsx apps/web/src/features/boxes/CreateBoxModal.test.tsx
git commit -m "refactor: share responsive editor dialog"
```

### Task 2: Item creation and editing always use the responsive dialog

**Files:**
- Create: `apps/web/src/features/items/ItemEditorDialog.tsx`
- Create: `apps/web/src/features/items/ItemEditorDialog.test.tsx`
- Modify: `apps/web/src/features/items/ItemForm.tsx`
- Modify: `apps/web/src/features/items/ItemForm.test.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`

**Interfaces:**
- Consumes: `ResponsiveEditorDialog` from Task 1.
- Produces: `ItemEditorDialog({ open, boxId, item, returnFocusRef, onClose, onSaved, onDelete })`.
- Extends `ItemFormProps` with `onBusyChange?: (busy: boolean) => void` and `showHeading?: boolean`.

- [ ] **Step 1: Add failing form busy-state tests**

Add an `ItemForm` test which supplies `onBusyChange` and asserts it becomes true while `createItem` is pending and false after resolution. Add a rendering assertion that `showHeading={false}` omits the form heading.

```tsx
expect(onBusyChange).toHaveBeenLastCalledWith(true)
resolveCreate({ id: 'item-1' })
await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
```

- [ ] **Step 2: Run the form tests and verify RED**

Run: `npm --prefix apps/web test -- ItemForm.test.tsx`

Expected: FAIL because `ItemForm` does not expose either prop.

- [ ] **Step 3: Implement the form interface**

Compute the existing mutation/upload busy state once and report it:

```tsx
const busy = mutation.isPending || isUploadPending(mediaUpload.stage)
useEffect(() => onBusyChange?.(busy), [busy, onBusyChange])
```

Render the existing `<h2>` only when `showHeading !== false`, use `busy` for the save button, and call `onBusyChange?.(false)` during unmount cleanup.

- [ ] **Step 4: Run form tests and verify GREEN**

Run: `npm --prefix apps/web test -- ItemForm.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write failing item-dialog and box-page tests**

Test `ItemEditorDialog` directly for title selection, responsive modal classes, cancellation, busy dismissal blocking, and save forwarding. Update `PublicBoxPage.test.tsx` so a desktop `matchMedia` result opens both flows as modal overlays:

```tsx
await user.click(screen.getByRole('button', { name: '新增物品' }))
const createDialog = screen.getByRole('dialog', { name: '新增物品' })
expect(createDialog.parentElement).toHaveClass('fixed', 'inset-0')
expect(createDialog).toHaveClass('lg:rounded-shell')

await user.click(screen.getByRole('button', { name: '编辑锤子' }))
expect(screen.getByRole('dialog', { name: '编辑物品' })).toBeInTheDocument()
```

Also assert the form no longer has an ancestor with `lg:static`.

- [ ] **Step 6: Run focused tests and verify RED**

Run: `npm --prefix apps/web test -- ItemEditorDialog.test.tsx PublicBoxPage.test.tsx`

Expected: FAIL because the wrapper does not exist and the page still switches to in-flow layout on desktop.

- [ ] **Step 7: Implement and integrate `ItemEditorDialog`**

The wrapper owns busy state and renders:

```tsx
<ResponsiveEditorDialog
  open={open}
  title={item ? '编辑物品' : '新增物品'}
  busy={busy}
  onClose={onClose}
  returnFocusRef={returnFocusRef}
  maxWidthClassName="max-w-2xl"
>
  <ItemForm
    key={item ? `edit-${item.id}` : 'new'}
    boxId={boxId}
    item={item}
    showHeading={false}
    onBusyChange={setBusy}
    onSaved={onSaved}
    onCancel={onClose}
    onDelete={onDelete}
  />
</ResponsiveEditorDialog>
```

Replace the conditional `lg:static` block in `PublicBoxPage` with this component. Preserve `editingItem`, delete-confirmation, item refresh, and initiating-control refs. Ensure the new-item action clears `editingItem` before opening and direct switching between edited items still resets form state through the existing key.

- [ ] **Step 8: Run item and box-detail tests**

Run: `npm --prefix apps/web test -- ItemForm.test.tsx ItemEditorDialog.test.tsx PublicBoxPage.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/items/ItemEditorDialog.tsx apps/web/src/features/items/ItemEditorDialog.test.tsx apps/web/src/features/items/ItemForm.tsx apps/web/src/features/items/ItemForm.test.tsx apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx
git commit -m "fix: open item editors as dialogs"
```

### Task 3: Every box-edit entry opens a dialog

**Files:**
- Create: `apps/web/src/features/boxes/EditBoxModal.tsx`
- Create: `apps/web/src/features/boxes/EditBoxModal.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxForm.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxFormPage.wrapper.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxCardMenu.tsx`
- Modify: `apps/web/src/features/boxes/BoxCatalogueCard.tsx`
- Modify: `apps/web/src/features/boxes/BoxCatalogueCard.test.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.tsx`
- Modify: `apps/web/src/features/boxes/PublicBoxPage.test.tsx`

**Interfaces:**
- Consumes: `ResponsiveEditorDialog` from Task 1 and `BoxForm`'s existing `onBusyChange`.
- Extends `BoxFormProps` with `onSaved?: () => void` for successful edit completion only.
- Produces: `EditBoxModal({ open, boxId, returnFocusRef, onClose, onSaved })`.
- Changes `BoxCardMenu` and `BoxCatalogueCard` to accept `onEdit: (box, trigger) => void` instead of emitting an edit link.

- [ ] **Step 1: Write failing `BoxForm` edit-completion tests**

Add tests proving `onSaved` fires only after the update and optional cover upload succeed, including the retry-success path after an upload failure:

```tsx
await user.click(screen.getByRole('button', { name: '保存修改' }))
await waitFor(() => expect(mockUpdateBox).toHaveBeenCalled())
expect(onSaved).toHaveBeenCalledTimes(1)
```

For a failed cover upload, assert `onSaved` remains untouched until “重试上传” resolves.

- [ ] **Step 2: Run form tests and verify RED**

Run: `npm --prefix apps/web test -- BoxFormPage.test.tsx`

Expected: FAIL because edit completion has no callback.

- [ ] **Step 3: Implement edit completion in `BoxForm`**

After `updateBox` and any selected-cover upload complete, call `onSaved?.()`. In the editing retry path, call it after a successful upload. Do not call it when the record update or upload is still unresolved or failed.

- [ ] **Step 4: Run form tests and verify GREEN**

Run: `npm --prefix apps/web test -- BoxFormPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write failing modal, entry-point, and legacy-route tests**

Add direct tests for `EditBoxModal`. Update the catalogue and detail tests so edit controls are buttons and open `role="dialog"` without route changes:

```tsx
await user.click(screen.getByRole('button', { name: '编辑工具箱' }))
expect(screen.getByRole('dialog', { name: '编辑箱子' })).toBeInTheDocument()
expect(screen.getByRole('heading', { name: '全部箱子' })).toBeInTheDocument()
```

Update `BoxFormPage.wrapper.test.tsx` to render `/app/boxes/box-1/edit` and assert navigation resolves to `/app/boxes?edit=box-1`, using a location probe.

- [ ] **Step 6: Run focused tests and verify RED**

Run: `npm --prefix apps/web test -- EditBoxModal.test.tsx BoxCatalogueCard.test.tsx BoxesPage.test.tsx PublicBoxPage.test.tsx BoxFormPage.wrapper.test.tsx`

Expected: FAIL because edit entries are links/navigation and no edit modal exists.

- [ ] **Step 7: Implement `EditBoxModal` and form-route redirect**

Render `BoxForm` inside the shared shell:

```tsx
<ResponsiveEditorDialog open={open} title="编辑箱子" busy={busy} onClose={onClose} returnFocusRef={returnFocusRef} maxWidthClassName="max-w-3xl">
  <BoxForm boxId={boxId} presentation="modal" onBusyChange={setBusy} onSaved={onSaved} />
</ResponsiveEditorDialog>
```

Change `BoxFormPage` into a compatibility redirect:

```tsx
export function BoxFormPage() {
  const { boxId = '' } = useParams<{ boxId: string }>()
  return <Navigate replace to={`/app/boxes?edit=${encodeURIComponent(boxId)}`} />
}
```

- [ ] **Step 8: Integrate catalogue edit state**

Use `const editingBoxId = searchParams.get('edit')`, open it through an `onEdit` callback, and close it by deleting only the `edit` search parameter with `{ replace: true }`. Pass the initiating menu button as `returnFocusRef`, invalidate all `['boxes']` queries after save, show “修改已保存”, and close the modal.

Change `BoxCardMenu`'s edit action from `Link` to `button`; call `onEdit(box, triggerRef.current)` before closing the menu.

- [ ] **Step 9: Integrate box-detail edit state**

Replace the desktop edit `Link` and mobile action-sheet navigation with `setShowBoxEditor(true)`. Render `EditBoxModal`, invalidate `['box', publicId]` and `['boxes']` after save, close it, and retain the current `/b/:publicId` route throughout.

- [ ] **Step 10: Run all box editor tests**

Run: `npm --prefix apps/web test -- EditBoxModal.test.tsx BoxFormPage.test.tsx BoxFormPage.wrapper.test.tsx BoxCatalogueCard.test.tsx BoxesPage.test.tsx PublicBoxPage.test.tsx`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/features/boxes/EditBoxModal.tsx apps/web/src/features/boxes/EditBoxModal.test.tsx apps/web/src/features/boxes/BoxForm.tsx apps/web/src/features/boxes/BoxFormPage.tsx apps/web/src/features/boxes/BoxFormPage.wrapper.test.tsx apps/web/src/features/boxes/BoxCardMenu.tsx apps/web/src/features/boxes/BoxCatalogueCard.tsx apps/web/src/features/boxes/BoxCatalogueCard.test.tsx apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/features/boxes/PublicBoxPage.tsx apps/web/src/features/boxes/PublicBoxPage.test.tsx
git commit -m "fix: open box editing in dialogs"
```

### Task 4: Encode ordinary media and avatars as JPEG

**Files:**
- Modify: `apps/web/src/features/media/useMediaUpload.test.tsx`
- Modify: `apps/web/src/features/media/useMediaUpload.ts`
- Modify: `apps/web/src/features/profile/profile.api.test.ts`
- Modify: `apps/web/src/features/profile/profile.api.ts`

**Interfaces:**
- `useMediaUpload().upload` keeps its current signature and returns the confirmed object key.
- `uploadAvatar(file: File)` keeps its current signature and returns the refreshed avatar download URL.

- [ ] **Step 1: Change tests to require JPEG output propagation**

Use a compressed JPEG fixture in both test files and require JPEG in compression, signing, and PUT assertions:

```tsx
const compressed = new File(['small'], 'image.jpg', { type: 'image/jpeg' })
mockCompress.mockResolvedValue(compressed)
expect(mockCompress).toHaveBeenCalledWith(original, expect.objectContaining({ fileType: 'image/jpeg' }))
expect(mockCreateUpload).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/jpeg' }))
expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { 'Content-Type': 'image/jpeg' }, body: compressed }))
```

- [ ] **Step 2: Run upload tests and verify RED**

Run: `npm --prefix apps/web test -- useMediaUpload.test.tsx profile.api.test.ts`

Expected: FAIL because both production paths still request `image/webp`.

- [ ] **Step 3: Change compression output to JPEG**

In both production calls, make the single behavior change:

```tsx
fileType: 'image/jpeg'
```

Continue passing `compressed.type` and `compressed.size` into signing and `compressed.type` into the R2 PUT content type.

- [ ] **Step 4: Run upload tests and verify GREEN**

Run: `npm --prefix apps/web test -- useMediaUpload.test.tsx profile.api.test.ts`

Expected: PASS.

- [ ] **Step 5: Run regression verification**

Run:

```bash
npm --prefix apps/web test
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

Expected: all commands exit 0 with no new warnings or test failures.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/media/useMediaUpload.test.tsx apps/web/src/features/media/useMediaUpload.ts apps/web/src/features/profile/profile.api.test.ts apps/web/src/features/profile/profile.api.ts
git commit -m "fix: compress uploaded images as jpeg"
```

### Task 5: Final integrated acceptance

**Files:**
- Modify only files required to correct failures discovered by the checks below.

**Interfaces:**
- Consumes all interfaces from Tasks 1–4.
- Produces a release-ready web build with the four requested behavior corrections.

- [ ] **Step 1: Run targeted interaction suite together**

Run:

```bash
npm --prefix apps/web test -- ResponsiveEditorDialog.test.tsx ItemEditorDialog.test.tsx ItemForm.test.tsx EditBoxModal.test.tsx BoxFormPage.test.tsx BoxFormPage.wrapper.test.tsx BoxCatalogueCard.test.tsx BoxesPage.test.tsx PublicBoxPage.test.tsx useMediaUpload.test.tsx profile.api.test.ts
```

Expected: PASS with no unhandled promise rejections or React act warnings.

- [ ] **Step 2: Run full static and production checks from a clean test process**

Run:

```bash
npm --prefix apps/web test -- --run
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run build
git diff --check
```

Expected: all commands exit 0; `git diff --check` prints nothing.

- [ ] **Step 3: Inspect final scope**

Run:

```bash
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: only the planned source, test, spec, and plan files are present; pre-existing unrelated untracked files remain untouched.

- [ ] **Step 4: Commit any verification-only correction**

If Step 1 or 2 required a correction, stage only its affected planned files and commit:

```bash
git commit -m "fix: complete modal editor integration"
```

If no correction was needed, do not create an empty commit.
