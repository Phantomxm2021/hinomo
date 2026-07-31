# Print Label Workbench Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/app/print` as the approved A1 warm-family print workbench with searchable desktop multi-select, real two-column A4 previews, and a focused mobile single-label preview.

**Architecture:** Keep `PrintPage` as the query and workflow coordinator, extract a pure print catalogue model plus focused selector and preview components, and reuse the existing `buildLabels`/`renderLabelsPdf` pipeline. Screen previews and PDF output use the same box order, eight-label pagination, public QR URL, field order, and warm palette.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, TanStack Query 5, Vitest/Testing Library, Playwright, existing QR and jsPDF helpers.

---

## File map

- Create `apps/web/src/features/qr-print/print-model.ts`: pure search, selection, ordering, and pagination helpers.
- Create `apps/web/src/features/qr-print/print-model.test.ts`: model behavior and non-mutation tests.
- Create `apps/web/src/features/qr-print/PrintBoxSelector.tsx`: desktop compact selector, search, visible-result select-all, and PDF action.
- Create `apps/web/src/features/qr-print/PrintBoxSelector.test.tsx`: selector semantics, accessibility, and callbacks.
- Create `apps/web/src/features/qr-print/PrintSheetPreview.tsx`: real A4/single-label screen preview with ID-keyed QR generation.
- Create `apps/web/src/features/qr-print/PrintSheetPreview.test.tsx`: pagination, metadata, QR loading/failure, and stale-result tests.
- Modify `apps/web/src/features/qr-print/PrintPage.tsx`: compose the new workbench, mobile flow, states, and PDF generation.
- Modify `apps/web/src/features/qr-print/PrintPage.test.tsx`: page integration and error-state coverage.
- Modify `apps/web/e2e/core-flow.spec.ts`: three-device visual/flow acceptance for printing.

### Task 1: Add the pure print catalogue model

**Files:**
- Create: `apps/web/src/features/qr-print/print-model.ts`
- Create: `apps/web/src/features/qr-print/print-model.test.ts`

- [ ] **Step 1: Write failing search, select-visible, order, and pagination tests**

```ts
import { expect, test } from 'vitest'
import {
  filterPrintBoxes,
  paginatePrintBoxes,
  selectedPrintBoxes,
  toggleVisibleSelection,
} from './print-model'

const boxes = [
  { id: 'one', name: '冬季衣物', box_code: 'BX-00001', space_name: '卧室', location: '衣柜上层' },
  { id: 'two', name: '摄影器材', box_code: 'BX-00002', space_name: '书房', location: '储物架' },
]

test.each(['冬季', 'bx-00001', '卧室', '衣柜上层'])(
  'filters printable boxes by %s',
  (query) => expect(filterPrintBoxes(boxes, query).map((box) => box.id)).toEqual(['one']),
)

test('selects or clears only visible ids while preserving hidden selection', () => {
  const selected = new Set(['two'])
  expect([...toggleVisibleSelection(selected, ['one'])]).toEqual(['two', 'one'])
  expect([...toggleVisibleSelection(new Set(['two', 'one']), ['one'])]).toEqual(['two'])
  expect([...selected]).toEqual(['two'])
})

test('returns selected boxes in source order without mutating inputs', () => {
  const source = [...boxes]
  expect(selectedPrintBoxes(source, new Set(['two', 'one'])).map((box) => box.id)).toEqual(['one', 'two'])
  expect(source).toEqual(boxes)
})

test('paginates print boxes eight per A4 sheet', () => {
  const many = Array.from({ length: 9 }, (_, index) => ({ ...boxes[0], id: String(index) }))
  expect(paginatePrintBoxes(many).map((page) => page.length)).toEqual([8, 1])
})
```

- [ ] **Step 2: Run the model tests and verify RED**

Run: `npm test -- src/features/qr-print/print-model.test.ts --run`

Expected: FAIL because `./print-model` does not exist.

- [ ] **Step 3: Implement the minimum pure model**

```ts
type PrintBox = {
  id: string
  name: string
  box_code: string
  space_name: string
  location: string | null
}

function normalized(value: string | null) {
  return (value ?? '').trim().toLocaleLowerCase()
}

export function filterPrintBoxes<T extends PrintBox>(boxes: readonly T[], query: string) {
  const needle = normalized(query)
  if (!needle) return [...boxes]
  return boxes.filter((box) => [box.name, box.box_code, box.space_name, box.location]
    .some((value) => normalized(value).includes(needle)))
}

export function toggleVisibleSelection(selected: ReadonlySet<string>, visibleIds: readonly string[]) {
  const next = new Set(selected)
  const everyVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id))
  for (const id of visibleIds) {
    if (everyVisibleSelected) next.delete(id)
    else next.add(id)
  }
  return next
}

export function selectedPrintBoxes<T extends { id: string }>(boxes: readonly T[], selected: ReadonlySet<string>) {
  return boxes.filter((box) => selected.has(box.id))
}

export function paginatePrintBoxes<T>(boxes: readonly T[]) {
  return Array.from({ length: Math.ceil(boxes.length / 8) }, (_, page) => boxes.slice(page * 8, page * 8 + 8))
}
```

- [ ] **Step 4: Run the model tests and verify GREEN**

Run: `npm test -- src/features/qr-print/print-model.test.ts --run`

Expected: all model tests PASS.

- [ ] **Step 5: Commit the model**

```bash
git add apps/web/src/features/qr-print/print-model.ts apps/web/src/features/qr-print/print-model.test.ts
git commit -m "feat: add print catalogue model"
```

### Task 2: Build the compact desktop box selector

**Files:**
- Create: `apps/web/src/features/qr-print/PrintBoxSelector.tsx`
- Create: `apps/web/src/features/qr-print/PrintBoxSelector.test.tsx`

- [ ] **Step 1: Write failing selector behavior tests**

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PrintBoxSelector } from './PrintBoxSelector'

const boxes = [
  { id: 'one', public_id: 'public-one', box_code: 'BX-00001', name: '冬季衣物', space_id: 'space-one', space_name: '卧室', location: '衣柜上层', visibility: 'private' as const, cover_object_key: null, item_count: 8, updated_at: '2026-07-31T08:00:00Z' },
  { id: 'two', public_id: 'public-two', box_code: 'BX-00002', name: '摄影器材', space_id: 'space-two', space_name: '书房', location: '储物架', visibility: 'private' as const, cover_object_key: null, item_count: 4, updated_at: '2026-07-31T07:00:00Z' },
]

test('searches, selects visible boxes, and exposes the PDF action', async () => {
  const user = userEvent.setup()
  const onQueryChange = vi.fn()
  const onToggle = vi.fn()
  const onToggleVisible = vi.fn()
  const onDownload = vi.fn()
  render(<PrintBoxSelector
    boxes={boxes}
    selected={new Set(['one'])}
    query=""
    generating={false}
    onQueryChange={onQueryChange}
    onToggle={onToggle}
    onToggleVisible={onToggleVisible}
    onDownload={onDownload}
  />)

  const region = screen.getByRole('region', { name: '选择要打印的箱子' })
  expect(within(region).getByRole('status', { name: '已选择 1 个箱子' })).toBeInTheDocument()
  await user.type(within(region).getByRole('searchbox', { name: '搜索箱子' }), '冬季')
  expect(onQueryChange).toHaveBeenLastCalledWith('冬季')
  await user.click(within(region).getByRole('button', { name: '全选当前结果' }))
  expect(onToggleVisible).toHaveBeenCalledOnce()
  await user.click(within(region).getByRole('checkbox', { name: /摄影器材/ }))
  expect(onToggle).toHaveBeenCalledWith('two')
  await user.click(within(region).getByRole('button', { name: '下载 PDF' }))
  expect(onDownload).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run the selector test and verify RED**

Run: `npm test -- src/features/qr-print/PrintBoxSelector.test.tsx --run`

Expected: FAIL because `PrintBoxSelector` does not exist.

- [ ] **Step 3: Implement the selector with exact visual hierarchy**

Implement these stable contracts:

```ts
type PrintBoxSelectorProps = {
  boxes: BoxSummary[]
  selected: ReadonlySet<string>
  query: string
  generating: boolean
  onQueryChange: (query: string) => void
  onToggle: (boxId: string) => void
  onToggleVisible: () => void
  onDownload: () => void
}
```

Use one `rounded-card border border-line bg-surface` container. The header contains `选择箱子`, a `role="status" aria-label="已选择 N 个箱子"` badge, and a labeled `type="search"` field. Render compact `<label>` rows with `min-h-14`, native checkboxes, name, `space_name · location`, and `box_code`. The footer contains a full-width 44px brand button; disable it when `selected.size === 0 || generating` and use `生成中…` during generation.

Compute the select-all label from visible rows:

```ts
const allVisibleSelected = boxes.length > 0 && boxes.every((box) => selected.has(box.id))
const selectAllLabel = allVisibleSelected ? '取消选择当前结果' : '全选当前结果'
```

- [ ] **Step 4: Run selector tests and verify GREEN**

Run: `npm test -- src/features/qr-print/PrintBoxSelector.test.tsx --run`

Expected: selector tests PASS with no accessibility warnings.

- [ ] **Step 5: Commit the selector**

```bash
git add apps/web/src/features/qr-print/PrintBoxSelector.tsx apps/web/src/features/qr-print/PrintBoxSelector.test.tsx
git commit -m "feat: add print box selector"
```

### Task 3: Build real A4 and single-label previews

**Files:**
- Create: `apps/web/src/features/qr-print/PrintSheetPreview.tsx`
- Create: `apps/web/src/features/qr-print/PrintSheetPreview.test.tsx`

- [ ] **Step 1: Write failing A4 pagination and QR isolation tests**

```tsx
const boxOne = { id: 'one', public_id: 'public-one', box_code: 'BX-00001', name: '冬季衣物', space_id: 'space-one', space_name: '卧室', location: '衣柜上层', visibility: 'private' as const, cover_object_key: null, item_count: 8, updated_at: '2026-07-31T08:00:00Z' }
const boxTwo = { id: 'two', public_id: 'public-two', box_code: 'BX-00002', name: '摄影器材', space_id: 'space-two', space_name: '书房', location: '储物架', visibility: 'private' as const, cover_object_key: null, item_count: 4, updated_at: '2026-07-31T07:00:00Z' }
const nineBoxes = Array.from({ length: 9 }, (_, index) => ({
  ...boxOne,
  id: `box-${index}`,
  public_id: `public-${index}`,
  name: index === 0 ? '冬季衣物' : `箱子 ${index}`,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

test('renders selected boxes as two-column A4 pages eight labels at a time', async () => {
  render(<PrintSheetPreview boxes={nineBoxes} mode="a4" />)
  const preview = screen.getByRole('region', { name: 'A4 标签预览' })
  expect(within(preview).getByText('共 2 页 · 9 张标签')).toBeInTheDocument()
  expect(within(preview).getAllByRole('group', { name: /标签$/ })).toHaveLength(9)
  expect(within(preview).getAllByTestId('a4-sheet')).toHaveLength(2)
  expect(await within(preview).findByRole('img', { name: '冬季衣物二维码' })).toHaveAttribute('src', 'data:one')
})

test('keeps QR failures and stale async results isolated by box id', async () => {
  const first = deferred<string>()
  mockBoxQrPng.mockImplementationOnce(() => first.promise).mockRejectedValueOnce(new Error('bad qr'))
  const view = render(<PrintSheetPreview boxes={[boxOne]} mode="single" />)
  view.rerender(<PrintSheetPreview boxes={[boxTwo]} mode="single" />)
  await act(() => first.resolve('data:stale'))
  expect(screen.queryByRole('img')).not.toHaveAttribute('src', 'data:stale')
  expect(await screen.findByText('二维码预览生成失败')).toBeInTheDocument()
  expect(screen.getByText('摄影器材')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run preview tests and verify RED**

Run: `npm test -- src/features/qr-print/PrintSheetPreview.test.tsx --run`

Expected: FAIL because `PrintSheetPreview` does not exist.

- [ ] **Step 3: Implement ID-keyed QR state and the two preview modes**

Define:

```ts
type PrintSheetPreviewProps = {
  boxes: BoxSummary[]
  mode: 'a4' | 'single'
}

type QrPreview = { state: 'loading' } | { state: 'ready'; src: string } | { state: 'error' }
```

For each currently rendered box ID that is absent from the local cache, call:

```ts
boxQrPng(boxQrUrl(env.VITE_PUBLIC_APP_ORIGIN, box.public_id))
```

Store results under that exact ID. Guard each effect run with `active`; an old result may populate only its own cache key and must never become the source for a different label.

For `mode="a4"`, render an accessible region named `A4 标签预览`, a header summary, and every `paginatePrintBoxes(boxes)` page. Each sheet uses `aspect-[210/297]`, a two-column grid, four rows, white surface, and paper-only shadow. For `mode="single"`, render one compact label without an A4 sheet. Both modes use the same `PrintLabelCard` markup and metadata order.

When `boxes` is empty, A4 mode renders the empty paper instruction and single mode renders no preview card.

- [ ] **Step 4: Run preview and model tests and verify GREEN**

Run: `npm test -- src/features/qr-print/PrintSheetPreview.test.tsx src/features/qr-print/print-model.test.ts --run`

Expected: preview and model tests PASS; stale QR never appears under the new box metadata.

- [ ] **Step 5: Commit the preview**

```bash
git add apps/web/src/features/qr-print/PrintSheetPreview.tsx apps/web/src/features/qr-print/PrintSheetPreview.test.tsx
git commit -m "feat: add A4 label preview"
```

### Task 4: Integrate the approved desktop and mobile workbench

**Files:**
- Modify: `apps/web/src/features/qr-print/PrintPage.tsx`
- Modify: `apps/web/src/features/qr-print/PrintPage.test.tsx`
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: Replace current layout expectations with failing integration tests**

Add tests that assert:

```tsx
expect(screen.getByRole('heading', { name: '打印二维码标签' })).toBeInTheDocument()
expect(screen.getByText('选择箱子，预览 A4 排版并下载可打印 PDF')).toBeInTheDocument()

const desktop = screen.getByRole('region', { name: '批量标签工作台' })
await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
expect(within(desktop).getByText('A4 · 双列 · 已选 1 张')).toBeInTheDocument()
expect(within(desktop).getByRole('region', { name: 'A4 标签预览' })).toBeInTheDocument()

const mobile = screen.getByRole('region', { name: '单个标签下载' })
await user.click(within(mobile).getByRole('radio', { name: /冬季衣物/ }))
expect(within(mobile).getByRole('region', { name: '单个标签预览' })).toBeInTheDocument()
```

Also add explicit tests for search + visible select-all, empty catalogue with a link to `/app/boxes`, retained selection after PDF failure, progress, and mobile/desktop selection isolation.

Before changing `PrintPage`, extend the existing Playwright print journey with:

```ts
await page.goto('/app/print')
if (testInfo.project.name === 'desktop-chromium') {
  await expect(page.getByRole('region', { name: '批量标签工作台' })).toBeVisible()
  await page.getByRole('checkbox', { name: /冬季衣物/ }).check()
  await expect(page.getByRole('region', { name: 'A4 标签预览' })).toBeVisible()
  await expect(page.getByTestId('a4-sheet')).toHaveCount(1)
} else {
  await expect(page.getByRole('region', { name: '单个标签下载' })).toBeVisible()
  await page.getByRole('radio', { name: /冬季衣物/ }).check()
  await expect(page.getByRole('region', { name: '单个标签预览' })).toBeVisible()
  await expect(page.getByRole('button', { name: '下载单个标签' })).toBeEnabled()
}
```

- [ ] **Step 2: Run PrintPage tests and verify RED**

Run: `npm test -- src/features/qr-print/PrintPage.test.tsx --run`

Then run: `npm run test:e2e -- --grep "owner creates"`

Expected: both commands FAIL on A4/single-preview expectations because the old page has a single-card desktop preview, no real sheet, no desktop search/select-all, and no mobile label preview.

- [ ] **Step 3: Refactor PrintPage into a thin coordinator**

Keep these state values in `PrintPage`:

```ts
const EMPTY_BOXES: BoxSummary[] = []

const [selected, setSelected] = useState<Set<string>>(() => new Set())
const [mobileSelectedId, setMobileSelectedId] = useState('')
const [query, setQuery] = useState('')
const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
const [error, setError] = useState(false)
const [generating, setGenerating] = useState(false)
```

Derive with `useMemo`:

```ts
const allBoxes = boxesQuery.data ?? EMPTY_BOXES
const visibleBoxes = useMemo(() => filterPrintBoxes(allBoxes, query), [allBoxes, query])
const selectedBoxes = useMemo(() => selectedPrintBoxes(allBoxes, selected), [allBoxes, selected])
const mobileBox = useMemo(() => allBoxes.find((box) => box.id === mobileSelectedId) ?? null, [allBoxes, mobileSelectedId])
```

Compose `PrintBoxSelector` and `PrintSheetPreview` for desktop. Compose native radio rows, `PrintSheetPreview mode="single"`, and the mobile download button for mobile. Pass `selectedBoxes` directly to both the preview and `buildLabels`, preserving source order.

On query error without data, render the existing blocking retry state. When the catalogue is empty, render a warm empty state with a React Router link labeled `查看全部箱子` to `/app/boxes`. Keep progress as `role="status"` and generation failure as `role="alert"` without clearing selection.

- [ ] **Step 4: Run print feature tests and verify GREEN**

Run: `npm test -- src/features/qr-print/PrintPage.test.tsx src/features/qr-print/PrintBoxSelector.test.tsx src/features/qr-print/PrintSheetPreview.test.tsx src/features/qr-print/pdf.test.ts --run`

Then run: `npm run test:e2e -- --grep "owner creates"`

Expected: all print feature tests and the desktop/iPhone/Pixel focused journey PASS.

- [ ] **Step 5: Commit the integrated page**

```bash
git add apps/web/src/features/qr-print/PrintPage.tsx apps/web/src/features/qr-print/PrintPage.test.tsx apps/web/e2e/core-flow.spec.ts
git commit -m "feat: align print label workbench"
```

### Task 5: Complete responsive QA and the release gate

**Files:**
- Verify only; production changes require a new failing regression test in the owning task before editing.

- [ ] **Step 1: Run the complete automated verification gate**

Run each command and require exit code 0:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected:

- All Vitest files pass.
- TypeScript and oxlint report no errors.
- Production build succeeds; the existing chunk-size advisory may remain.
- Playwright passes for desktop Chromium, iPhone, and Pixel.
- Diff check is clean and the worktree is empty after the implementation commits.

- [ ] **Step 2: Inspect the required responsive views in a real browser**

Start the application with `npm run dev`, then inspect `/app/print` at 1440×900, 1024×768, 768×1024, 390×844, 360×800, and 320×568. Verify the exact items in the final review checklist below. If any check fails, add a focused failing component or E2E test first, make the minimum fix, rerun the focused test, and repeat the complete gate.

- [ ] **Step 3: Confirm repository state**

Run: `git diff --check && git status --short && git log -5 --oneline`

Expected: diff check exits 0, status is empty, and the latest commits are the four print-workbench implementation commits.

## Final review checklist

- [ ] Compare desktop 1440×900 and 1024×768 against the confirmed A1 mockup.
- [ ] Compare mobile 390×844, 360×800, and 320×568 against the confirmed single-label mockup.
- [ ] Verify `PrintSheetPreview` field order and eight-per-page layout match `pdf.ts`.
- [ ] Verify QR images remain tied to box IDs during rapid selection changes.
- [ ] Verify no desktop multi-select controls are visibly exposed below `lg` and no mobile controls are visibly exposed at `lg` or above.
- [ ] Verify the working tree is clean and all commits are on `codex/tailwind-warm-family`.
