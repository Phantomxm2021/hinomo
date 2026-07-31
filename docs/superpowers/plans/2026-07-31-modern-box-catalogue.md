# Modern Box Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the action-heavy box grid with a searchable, sortable, URL-backed catalogue whose cards open directly and expose edit/delete through an accessible overflow menu.

**Architecture:** Keep Supabase loading and mutations in `BoxesPage`, extract pure catalogue filtering/sorting into a testable module, and split the toolbar, space chips, card, and overflow menu into focused presentational components. Preserve the existing create modal, delete confirmation, R2 cover rendering, query invalidation, and URL-driven modal history behavior.

**Tech Stack:** React 19, TypeScript 6, React Router 7, TanStack Query 5, Tailwind CSS 4, Vitest, Testing Library, Playwright.

---

## File structure

- Create `apps/web/src/features/boxes/box-catalogue.ts`: query normalization, filtering, sorting, space counts, and summary totals.
- Create `apps/web/src/features/boxes/box-catalogue.test.ts`: pure catalogue behavior tests.
- Create `apps/web/src/features/boxes/BoxCatalogueToolbar.tsx`: URL-agnostic search and sort controls.
- Create `apps/web/src/features/boxes/SpaceFilterChips.tsx`: counted, horizontally scrollable space filters.
- Modify `apps/web/src/components/AppIcon.tsx`: add the shared three-dot overflow icon.
- Create `apps/web/src/features/boxes/BoxCardMenu.tsx`: accessible edit/delete overflow menu.
- Create `apps/web/src/features/boxes/BoxCatalogueCard.tsx`: cover, metadata, primary detail link, and menu trigger.
- Create `apps/web/src/features/boxes/BoxCatalogueCard.test.tsx`: card and menu interaction tests.
- Modify `apps/web/src/features/boxes/BoxesPage.tsx`: URL state, component orchestration, states, and create/delete behavior.
- Modify `apps/web/src/features/boxes/BoxesPage.test.tsx`: integrated URL, summary, empty-state, and mutation tests.
- Modify `apps/web/src/visual-system.test.ts`: static design-language guards for the new catalogue.
- Modify `apps/web/e2e/core-flow.spec.ts`: desktop/iPhone/Pixel catalogue acceptance coverage.

### Task 1: Build the pure catalogue model

**Files:**
- Create: `apps/web/src/features/boxes/box-catalogue.ts`
- Create: `apps/web/src/features/boxes/box-catalogue.test.ts`

- [ ] **Step 1: Write failing filtering, sorting, counting, and summary tests**

Create fixtures with mixed names, codes, spaces, locations, item counts, and update dates. Cover every searchable field and combined filters:

```ts
import { describe, expect, test } from 'vitest'
import type { BoxSummary } from './boxes.api'
import { catalogueSummary, catalogueSpaces, filterAndSortBoxes } from './box-catalogue'

const boxes: BoxSummary[] = [
  {
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00018', name: '冬季衣物',
    space_id: 'space-1', space_name: '卧室', location: '衣柜上层', visibility: 'private',
    cover_object_key: null, item_count: 8, updated_at: '2026-07-30T10:00:00Z',
  },
  {
    id: 'box-2', public_id: 'public-2', box_code: 'BX-00009', name: 'Camera Gear',
    space_id: 'space-2', space_name: '书房', location: '储物架', visibility: 'public',
    cover_object_key: null, item_count: 12, updated_at: '2026-07-29T10:00:00Z',
  },
]

describe('filterAndSortBoxes', () => {
  test.each(['冬季', 'bx-00018', '卧室', '衣柜上层'])(
    'searches name, code, space, and location with %s',
    (query) => expect(filterAndSortBoxes(boxes, { query, spaceId: '', sort: 'recent' }))
      .toEqual([boxes[0]]),
  )

  test('combines trimmed case-insensitive search and space filtering', () => {
    expect(filterAndSortBoxes(boxes, { query: '  camera  ', spaceId: 'space-2', sort: 'recent' }))
      .toEqual([boxes[1]])
  })

  test('supports recent, name, and item-count sorting without mutating input', () => {
    const original = [...boxes]
    expect(filterAndSortBoxes(boxes, { query: '', spaceId: '', sort: 'recent' }).map((box) => box.id))
      .toEqual(['box-1', 'box-2'])
    expect(filterAndSortBoxes(boxes, { query: '', spaceId: '', sort: 'name' }).map((box) => box.id))
      .toEqual(['box-2', 'box-1'])
    expect(filterAndSortBoxes(boxes, { query: '', spaceId: '', sort: 'items' }).map((box) => box.id))
      .toEqual(['box-2', 'box-1'])
    expect(boxes).toEqual(original)
  })
})

test('counts boxes per space and calculates the global summary', () => {
  expect(catalogueSpaces(boxes)).toEqual([
    { id: 'space-1', name: '卧室', count: 1 },
    { id: 'space-2', name: '书房', count: 1 },
  ])
  expect(catalogueSummary(boxes)).toEqual({ boxCount: 2, itemCount: 20 })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test -- --run src/features/boxes/box-catalogue.test.ts
```

Expected: FAIL because `box-catalogue.ts` does not exist.

- [ ] **Step 3: Implement the pure catalogue helpers**

Create the module with explicit supported sort values and deterministic tie-breakers:

```ts
import type { BoxSummary } from './boxes.api'

export type BoxCatalogueSort = 'recent' | 'name' | 'items'

export type BoxCatalogueFilters = {
  query: string
  spaceId: string
  sort: BoxCatalogueSort
}

export function parseCatalogueSort(value: string | null): BoxCatalogueSort {
  return value === 'name' || value === 'items' ? value : 'recent'
}

export function filterAndSortBoxes(boxes: BoxSummary[], filters: BoxCatalogueFilters) {
  const query = filters.query.trim().toLocaleLowerCase()
  return boxes
    .filter((box) => !filters.spaceId || box.space_id === filters.spaceId)
    .filter((box) => {
      if (!query) return true
      return [box.name, box.box_code, box.space_name, box.location ?? '']
        .some((value) => value.toLocaleLowerCase().includes(query))
    })
    .toSorted((left, right) => {
      if (filters.sort === 'name') return left.name.localeCompare(right.name, 'zh-CN')
      if (filters.sort === 'items') return right.item_count - left.item_count || left.name.localeCompare(right.name, 'zh-CN')
      return Date.parse(right.updated_at) - Date.parse(left.updated_at)
    })
}

export function catalogueSpaces(boxes: BoxSummary[]) {
  const spaces = new Map<string, { id: string; name: string; count: number }>()
  for (const box of boxes) {
    const current = spaces.get(box.space_id)
    spaces.set(box.space_id, {
      id: box.space_id,
      name: box.space_name,
      count: (current?.count ?? 0) + 1,
    })
  }
  return [...spaces.values()]
}

export function catalogueSummary(boxes: BoxSummary[]) {
  return {
    boxCount: boxes.length,
    itemCount: boxes.reduce((total, box) => total + box.item_count, 0),
  }
}
```

- [ ] **Step 4: Re-run the focused test, typecheck, and lint**

Run:

```bash
npm run test -- --run src/features/boxes/box-catalogue.test.ts
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the pure model**

```bash
git add apps/web/src/features/boxes/box-catalogue.ts apps/web/src/features/boxes/box-catalogue.test.ts
git commit -m "feat: add box catalogue model"
```

### Task 2: Build the catalogue card and overflow menu

**Files:**
- Modify: `apps/web/src/components/AppIcon.tsx`
- Create: `apps/web/src/features/boxes/BoxCardMenu.tsx`
- Create: `apps/web/src/features/boxes/BoxCatalogueCard.tsx`
- Create: `apps/web/src/features/boxes/BoxCatalogueCard.test.tsx`

- [ ] **Step 1: Write failing card and menu behavior tests**

Test the primary link, metadata, accessible menu trigger, single menu contents, Escape close, outside-click close, edit link, and delete callback:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { BoxCatalogueCard } from './BoxCatalogueCard'

const box = {
  id: 'box-1', public_id: 'public-1', box_code: 'BX-00018', name: '冬季衣物',
  space_id: 'space-1', space_name: '卧室', location: '衣柜上层', visibility: 'private' as const,
  cover_object_key: null, item_count: 8, updated_at: '2026-07-30T10:00:00Z',
}

afterEach(cleanup)

test('makes the card the primary detail link and keeps management secondary', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  render(<MemoryRouter><BoxCatalogueCard box={box} menuOpen={false} onMenuToggle={vi.fn()} onMenuClose={vi.fn()} onDelete={onDelete} /></MemoryRouter>)

  expect(screen.getByRole('link', { name: /打开冬季衣物/ })).toHaveAttribute('href', '/b/public-1')
  expect(screen.getByText('卧室 · 衣柜上层')).toBeInTheDocument()
  expect(screen.getByText('8 件物品')).toBeInTheDocument()
  expect(screen.getByText('BX-00018')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(onDelete).not.toHaveBeenCalled()
})

test('offers edit and confirmed-delete entry points and closes with Escape/outside click', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onDelete = vi.fn()
  render(<MemoryRouter><BoxCatalogueCard box={box} menuOpen onMenuToggle={vi.fn()} onMenuClose={onClose} onDelete={onDelete} /></MemoryRouter>)

  expect(screen.getByRole('link', { name: '编辑冬季衣物' })).toHaveAttribute('href', '/app/boxes/box-1/edit')
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(onDelete).toHaveBeenCalledWith(box)
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
  fireEvent.mouseDown(document.body)
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test -- --run src/features/boxes/BoxCatalogueCard.test.tsx
```

Expected: FAIL because the card component does not exist.

- [ ] **Step 3: Add the shared overflow icon and implement `BoxCardMenu`**

Add `'more'` to `AppIconName` and the exact icon path to `iconPaths`:

```tsx
more: (
  <>
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  </>
),
```

Use a positioned popover with document listeners only while open. Pass the trigger ref so clicking the same trigger is not mistaken for an outside click. Preserve focus semantics by returning focus to the trigger from the parent after close:

```tsx
import { useEffect, useRef, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import type { BoxSummary } from './boxes.api'

export function BoxCardMenu({ box, open, triggerRef, onClose, onDelete }: {
  box: BoxSummary
  open: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onDelete: (box: BoxSummary) => void
}) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [onClose, open, triggerRef])

  if (!open) return null
  return (
    <div ref={menuRef} className="absolute top-12 right-3 z-20 grid min-w-40 gap-1 rounded-control border border-line bg-surface p-1.5 shadow-float" aria-label={`管理${box.name}`}>
      <Link className="rounded-lg px-3 py-2.5 font-bold text-ink no-underline hover:bg-placeholder/50" aria-label={`编辑${box.name}`} to={`/app/boxes/${box.id}/edit`} onClick={onClose}>编辑箱子</Link>
      <button className="rounded-lg px-3 py-2.5 text-left font-bold text-danger hover:bg-danger/5" type="button" aria-label={`删除${box.name}`} onClick={() => { onDelete(box); onClose() }}>删除箱子</button>
    </div>
  )
}
```

- [ ] **Step 4: Implement `BoxCatalogueCard`**

Render a `16:10` cover, text visibility badge, overlay management trigger, and a stretched primary link without nesting interactive elements:

```tsx
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { BoxCardMenu } from './BoxCardMenu'
import type { BoxSummary } from './boxes.api'

export function BoxCatalogueCard({ box, menuOpen, onMenuToggle, onMenuClose, onDelete }: {
  box: BoxSummary
  menuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onDelete: (box: BoxSummary) => void
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeMenu = () => { onMenuClose(); window.requestAnimationFrame(() => triggerRef.current?.focus()) }
  return (
    <article className="group relative min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-[0_4px_12px_rgb(86_58_36/4%)] transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-soft">
      <div className="relative aspect-[16/10] overflow-hidden bg-placeholder">
        {box.cover_object_key
          ? <AuthorizedImage objectKey={box.cover_object_key} alt={`${box.name}封面`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          : <div className="grid h-full place-items-center" role="img" aria-label="箱子封面占位图"><AppIcon name="box" size={38} /></div>}
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-1 text-xs font-bold text-white">
          <AppIcon name={box.visibility === 'public' ? 'globe' : 'lock'} size={13} />
          {box.visibility === 'public' ? '公开' : '私有'}
        </span>
      </div>
      <div className="p-4">
        <h2 className="truncate text-card-title font-bold">{box.name}</h2>
        <p className="mt-1 truncate text-sm">{box.space_name} · {box.location || '未填写位置'}</p>
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-xs text-muted">
          <span className="font-bold text-ink">{box.item_count} 件物品</span><span className="font-mono">{box.box_code}</span>
        </div>
      </div>
      <Link className="absolute inset-0 z-10 rounded-card" aria-label={`打开${box.name}`} to={`/b/${box.public_id}`} />
      <button ref={triggerRef} className="absolute top-3 right-3 z-20 grid size-11 place-items-center rounded-control border border-white/70 bg-surface/90 text-ink shadow-soft" type="button" aria-label={`管理${box.name}`} aria-expanded={menuOpen} onClick={onMenuToggle}><AppIcon name="more" /></button>
      <BoxCardMenu box={box} open={menuOpen} triggerRef={triggerRef} onClose={closeMenu} onDelete={onDelete} />
    </article>
  )
}
```

- [ ] **Step 5: Re-run card tests, typecheck, and lint**

Run:

```bash
npm run test -- --run src/features/boxes/BoxCatalogueCard.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the card/menu components**

```bash
git add apps/web/src/features/boxes/BoxCardMenu.tsx apps/web/src/features/boxes/BoxCatalogueCard.tsx apps/web/src/features/boxes/BoxCatalogueCard.test.tsx apps/web/src/components/AppIcon.tsx
git commit -m "feat: add modern box catalogue cards"
```

### Task 3: Build the URL-backed toolbar and space filters

**Files:**
- Create: `apps/web/src/features/boxes/BoxCatalogueToolbar.tsx`
- Create: `apps/web/src/features/boxes/SpaceFilterChips.tsx`
- Create: `apps/web/src/features/boxes/BoxCatalogueToolbar.test.tsx`

- [ ] **Step 1: Write failing control contract tests**

Keep the controls URL-agnostic by testing callbacks:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { BoxCatalogueToolbar } from './BoxCatalogueToolbar'
import { SpaceFilterChips } from './SpaceFilterChips'

afterEach(cleanup)

test('reports search and sort changes through accessible controls', async () => {
  const user = userEvent.setup()
  const onQueryChange = vi.fn()
  const onSortChange = vi.fn()
  render(<BoxCatalogueToolbar query="" sort="recent" onQueryChange={onQueryChange} onSortChange={onSortChange} />)
  await user.type(screen.getByRole('searchbox', { name: '搜索箱子' }), '冬季')
  expect(onQueryChange).toHaveBeenLastCalledWith('冬季')
  await user.selectOptions(screen.getByRole('combobox', { name: '箱子排序' }), 'items')
  expect(onSortChange).toHaveBeenCalledWith('items')
})

test('renders counted pressed-state space chips', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<SpaceFilterChips spaces={[{ id: 's1', name: '卧室', count: 9 }]} selectedSpace="" totalCount={9} onChange={onChange} />)
  expect(screen.getByRole('button', { name: '全部空间 9' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: '卧室 9' }))
  expect(onChange).toHaveBeenCalledWith('s1')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test -- --run src/features/boxes/BoxCatalogueToolbar.test.tsx
```

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement the toolbar and chip components**

`BoxCatalogueToolbar` renders a contained search/sort surface:

```tsx
import type { BoxCatalogueSort } from './box-catalogue'

export function BoxCatalogueToolbar({ query, sort, onQueryChange, onSortChange }: {
  query: string
  sort: BoxCatalogueSort
  onQueryChange: (query: string) => void
  onSortChange: (sort: BoxCatalogueSort) => void
}) {
  return (
    <div className="grid gap-2 rounded-card border border-line bg-surface/75 p-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <input className="min-h-12 rounded-control border border-line bg-surface px-4 text-ink" type="search" aria-label="搜索箱子" placeholder="搜索箱子名称、编号、空间或位置" value={query} onChange={(event) => onQueryChange(event.target.value)} />
      <select className="min-h-12 rounded-control border border-line bg-surface px-4 font-bold text-ink" aria-label="箱子排序" value={sort} onChange={(event) => onSortChange(event.target.value as BoxCatalogueSort)}>
        <option value="recent">最近更新</option><option value="name">名称 A–Z</option><option value="items">物品数量</option>
      </select>
    </div>
  )
}
```

`SpaceFilterChips` uses a labelled horizontal scroller and explicit counts:

```tsx
export function SpaceFilterChips({ spaces, selectedSpace, totalCount, onChange }: {
  spaces: Array<{ id: string; name: string; count: number }>
  selectedSpace: string
  totalCount: number
  onChange: (spaceId: string) => void
}) {
  const chip = (selected: boolean) => `min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition ${selected ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-muted hover:border-brand/40 hover:text-ink'}`
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="按空间筛选">
      <button className={chip(!selectedSpace)} type="button" aria-pressed={!selectedSpace} onClick={() => onChange('')}>全部空间 <span aria-hidden="true">{totalCount}</span><span className="sr-only"> {totalCount}</span></button>
      {spaces.map((space) => <button className={chip(selectedSpace === space.id)} type="button" aria-pressed={selectedSpace === space.id} onClick={() => onChange(space.id)} key={space.id}>{space.name} <span>{space.count}</span></button>)}
    </div>
  )
}
```

- [ ] **Step 4: Re-run controls tests, typecheck, and lint**

Run:

```bash
npm run test -- --run src/features/boxes/BoxCatalogueToolbar.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the catalogue controls**

```bash
git add apps/web/src/features/boxes/BoxCatalogueToolbar.tsx apps/web/src/features/boxes/SpaceFilterChips.tsx apps/web/src/features/boxes/BoxCatalogueToolbar.test.tsx
git commit -m "feat: add box catalogue controls"
```

### Task 4: Integrate the modern catalogue into `BoxesPage`

**Files:**
- Modify: `apps/web/src/features/boxes/BoxesPage.tsx`
- Modify: `apps/web/src/features/boxes/BoxesPage.test.tsx`
- Modify: `apps/web/src/visual-system.test.ts`

- [ ] **Step 1: Add failing integrated URL and state tests**

Extend the existing data-router test harness. Assert initial URL hydration, combined changes, summaries, card menu exclusivity, and two distinct empty states:

```tsx
test('hydrates and combines search, space, and sort state from the URL', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?q=%E5%86%AC%E5%AD%A3&space=space-1&sort=items')

  expect(await screen.findByRole('searchbox', { name: '搜索箱子' })).toHaveValue('冬季')
  expect(screen.getByRole('button', { name: /卧室 1/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('combobox', { name: '箱子排序' })).toHaveValue('items')
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '打开露营用品' })).not.toBeInTheDocument()
  expect(screen.getByText('显示 1 个')).toBeInTheDocument()

  await user.clear(screen.getByRole('searchbox', { name: '搜索箱子' }))
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-1')
  expect(screen.getByTestId('location')).toHaveTextContent('sort=items')
})

test('shows global totals and distinguishes no data from no matches', async () => {
  mockListBoxes.mockResolvedValueOnce(boxes)
  renderBoxes('/app/boxes?q=不存在')
  expect(await screen.findByText('2 个箱子 · 11 件物品')).toBeInTheDocument()
  expect(screen.getByText('没有匹配的箱子')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '清除筛选' })).toBeInTheDocument()
})
```

Retain all current modal history, busy blocking, focus restoration, delete confirmation, cover rendering, and query invalidation tests.

- [ ] **Step 2: Run `BoxesPage` tests and verify RED**

Run:

```bash
npm run test -- --run src/features/boxes/BoxesPage.test.tsx
```

Expected: FAIL because the current page does not expose search, sort, summaries, cards as primary links, or distinct no-match state.

- [ ] **Step 3: Wire URL helpers and result derivation into `BoxesPage`**

Read `q`, `space`, and `sort`, and update only the changed key with `replace:true`:

```tsx
const query = searchParams.get('q') ?? ''
const selectedSpace = searchParams.get('space') ?? ''
const sort = parseCatalogueSort(searchParams.get('sort'))
const spaces = catalogueSpaces(boxes)
const summary = catalogueSummary(boxes)
const visibleBoxes = filterAndSortBoxes(boxes, { query, spaceId: selectedSpace, sort })

const updateCatalogueParam = (key: 'q' | 'space' | 'sort', value: string, defaultValue = '') => {
  const next = new URLSearchParams(searchParams)
  if (!value || value === defaultValue) next.delete(key)
  else next.set(key, value)
  setSearchParams(next, { replace: true })
}

const clearCatalogueFilters = () => {
  const next = new URLSearchParams(searchParams)
  for (const key of ['q', 'space', 'sort']) next.delete(key)
  setSearchParams(next, { replace: true })
}
```

Track `openMenuBoxId` so only one card menu can be open. Close it when filters change or the target is selected for deletion.

- [ ] **Step 4: Replace the current header, chips, and cards**

Compose the extracted components and keep the modal/dialog at page root:

```tsx
<header className="flex flex-col gap-5 py-3 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">收纳目录</p>
    <h1 className="mb-0 text-page-title font-extrabold" id="boxes-title">全部箱子</h1>
    <p className="mt-2 text-sm text-muted">{summary.boxCount} 个箱子 · {summary.itemCount} 件物品</p>
  </div>
  <button ref={createButtonRef} className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong" type="button" onClick={openCreate}>
    <AppIcon name="plus" className="mr-2" /><span className="sm:hidden">新建</span><span className="hidden sm:inline">创建箱子</span>
  </button>
</header>

<BoxCatalogueToolbar query={query} sort={sort} onQueryChange={(value) => updateCatalogueParam('q', value)} onSortChange={(value) => updateCatalogueParam('sort', value, 'recent')} />
<div className="flex items-center gap-3">
  <div className="min-w-0 flex-1"><SpaceFilterChips spaces={spaces} selectedSpace={selectedSpace} totalCount={boxes.length} onChange={(value) => updateCatalogueParam('space', value)} /></div>
  <span className="ml-auto hidden shrink-0 text-sm text-muted sm:block">显示 {visibleBoxes.length} 个</span>
</div>

{boxes.length > 0 && visibleBoxes.length === 0
  ? <PageState state="empty" title="没有匹配的箱子" action={<button type="button" onClick={clearCatalogueFilters}>清除筛选</button>} />
  : null}

<div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
  {visibleBoxes.map((box) => <BoxCatalogueCard key={box.id} box={box} menuOpen={openMenuBoxId === box.id} onMenuToggle={() => setOpenMenuBoxId((current) => current === box.id ? null : box.id)} onMenuClose={() => setOpenMenuBoxId(null)} onDelete={(target) => { setOpenMenuBoxId(null); setDeleteTarget(target) }} />)}
</div>
```

The true empty state remains `还没有箱子` with the existing create action. Remove the title-area batch print link.

- [ ] **Step 5: Update visual-system guards**

Add the extracted catalogue sources to `alignedPageSources` or an equivalent catalogue source list. Assert the new sources use `text-page-title`, `text-card-title`, `rounded-card`, `border-line`, and no legacy `.box-card` selector. Do not weaken existing typography minimums.

- [ ] **Step 6: Run integrated and adjacent tests**

Run:

```bash
npm run test -- --run src/features/boxes/box-catalogue.test.ts src/features/boxes/BoxCatalogueToolbar.test.tsx src/features/boxes/BoxCatalogueCard.test.tsx src/features/boxes/BoxesPage.test.tsx src/features/dashboard/DashboardPage.test.tsx src/app/AppShell.test.tsx
npm run typecheck
npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit page integration**

```bash
git add apps/web/src/features/boxes/BoxesPage.tsx apps/web/src/features/boxes/BoxesPage.test.tsx apps/web/src/visual-system.test.ts
git commit -m "feat: modernize box catalogue"
```

### Task 5: Add three-device catalogue acceptance coverage

**Files:**
- Modify: `apps/web/e2e/core-flow.spec.ts`

- [ ] **Step 1: Extend the public-box flow with catalogue acceptance assertions**

After creating at least two boxes, visit `/app/boxes`, search by location or box code, and assert URL persistence, primary card navigation, menu behavior, and no overflow:

```ts
await page.goto('/app/boxes')
const search = page.getByRole('searchbox', { name: '搜索箱子' })
await search.fill('衣柜上层')
await expect(page).toHaveURL(/q=%E8%A1%A3%E6%9F%9C%E4%B8%8A%E5%B1%82/)
await expect(page.getByRole('link', { name: '打开冬季衣物' })).toBeVisible()
await expect(page.getByRole('link', { name: '打开露营用品' })).toHaveCount(0)
await expectNoHorizontalOverflow(page)

await page.reload()
await expect(search).toHaveValue('衣柜上层')
await page.getByRole('button', { name: '管理冬季衣物' }).click()
await expect(page.getByRole('link', { name: '编辑冬季衣物' })).toBeVisible()
await page.keyboard.press('Escape')
await expect(page.getByRole('link', { name: '编辑冬季衣物' })).toHaveCount(0)
await page.getByRole('button', { name: '管理冬季衣物' }).click()
await page.getByRole('button', { name: '删除冬季衣物' }).click()
await expect(page.getByRole('dialog', { name: /删除“冬季衣物”/ })).toBeVisible()
await page.getByRole('button', { name: '取消' }).click()
await page.getByRole('link', { name: '打开冬季衣物' }).click()
await expect(page).toHaveURL(/\/b\//)
```

Use the existing `desktop-chromium`, `iphone`, and `pixel` projects; do not introduce duplicate project definitions.

- [ ] **Step 2: Run E2E and verify responsive behavior**

Run:

```bash
npm run test:e2e
```

Expected: all desktop, iPhone, and Pixel tests pass, including URL restoration and no horizontal overflow.

- [ ] **Step 3: Run complete verification**

Run:

```bash
npm run test -- --run
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

Expected: all Vitest files pass; TypeScript, Oxlint, Vite, and all Playwright projects exit 0; `git diff --check` prints nothing.

- [ ] **Step 4: Request code review and resolve findings**

Use `superpowers:requesting-code-review` against the base commit before Task 1 and the current HEAD. Fix every Critical and Important finding with a failing regression test first, then repeat the full verification command set.

- [ ] **Step 5: Commit E2E and review fixes**

```bash
git add apps/web/e2e/core-flow.spec.ts apps/web/src/features/boxes
git commit -m "test: cover modern box catalogue flow"
```
