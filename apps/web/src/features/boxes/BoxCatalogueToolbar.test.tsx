import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { BoxCatalogueToolbar } from './BoxCatalogueToolbar'
import type { BoxCatalogueSort } from './box-catalogue'
import { SpaceFilterChips } from './SpaceFilterChips'

afterEach(cleanup)

function ToolbarHarness({ onQueryChange, onSortChange }: {
  onQueryChange: (query: string) => void
  onSortChange: (sort: BoxCatalogueSort) => void
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<BoxCatalogueSort>('recent')

  return <BoxCatalogueToolbar
    query={query}
    sort={sort}
    onQueryChange={(nextQuery) => {
      onQueryChange(nextQuery)
      setQuery(nextQuery)
    }}
    onSortChange={(nextSort) => {
      onSortChange(nextSort)
      setSort(nextSort)
    }}
  />
}

function SpaceChipsHarness({ onChange }: { onChange: (spaceId: string) => void }) {
  const [selectedSpace, setSelectedSpace] = useState('space-bedroom')
  const spaces: ReadonlyArray<{ id: string; name: string; count: number }> = [
    { id: 'space-bedroom', name: '卧室', count: 4 },
    { id: 'space-kitchen', name: '厨房', count: 2 },
  ]

  return <SpaceFilterChips
    spaces={spaces}
    selectedSpace={selectedSpace}
    totalCount={6}
    onChange={(spaceId) => {
      onChange(spaceId)
      setSelectedSpace(spaceId)
    }}
  />
}

test('updates the controlled search query cumulatively', async () => {
  const user = userEvent.setup()
  const onQueryChange = vi.fn()
  render(<ToolbarHarness onQueryChange={onQueryChange} onSortChange={vi.fn()} />)

  const searchbox = screen.getByRole('searchbox', { name: '搜索箱子' })
  expect(searchbox).toHaveAttribute('placeholder', '搜索箱子名称、编号、空间或位置')

  await user.type(searchbox, '冬季')

  expect(searchbox).toHaveValue('冬季')
  expect(onQueryChange).toHaveBeenLastCalledWith('冬季')
})

test('updates the controlled sort selection', async () => {
  const user = userEvent.setup()
  const onSortChange = vi.fn()
  render(<ToolbarHarness onQueryChange={vi.fn()} onSortChange={onSortChange} />)

  const select = screen.getByRole('combobox', { name: '箱子排序' })
  await user.selectOptions(select, 'items')
  expect(onSortChange).toHaveBeenLastCalledWith('items')
  expect(select).toHaveValue('items')

  await user.selectOptions(select, 'name')
  expect(onSortChange).toHaveBeenLastCalledWith('name')
  expect(select).toHaveValue('name')
})

test('renders accessible filter chips and updates their pressed state', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<SpaceChipsHarness onChange={onChange} />)

  const allSpaces = screen.getByRole('button', { name: '全部空间 6' })
  const bedroom = screen.getByRole('button', { name: '卧室 4' })
  const kitchen = screen.getByRole('button', { name: '厨房 2' })
  expect(allSpaces).toHaveAttribute('aria-pressed', 'false')
  expect(bedroom).toHaveAttribute('aria-pressed', 'true')
  expect(kitchen).toHaveAttribute('aria-pressed', 'false')

  await user.click(kitchen)

  expect(onChange).toHaveBeenCalledWith('space-kitchen')
  expect(kitchen).toHaveAttribute('aria-pressed', 'true')
  expect(bedroom).toHaveAttribute('aria-pressed', 'false')
})

test('uses responsive toolbar and horizontal chip target classes', () => {
  render(<>
    <ToolbarHarness onQueryChange={vi.fn()} onSortChange={vi.fn()} />
    <SpaceChipsHarness onChange={vi.fn()} />
  </>)

  expect(screen.getByRole('searchbox', { name: '搜索箱子' }).parentElement)
    .toHaveClass('grid', 'rounded-card', 'border', 'border-line', 'bg-surface/75', 'p-2', 'sm:grid-cols-2')
  expect(screen.getByRole('combobox', { name: '箱子排序' })).toHaveClass('min-h-12')
  expect(screen.getByLabelText('按空间筛选')).toHaveClass('flex', 'flex-nowrap', 'overflow-x-auto', 'pb-1')
  expect(screen.getByRole('button', { name: '全部空间 6' })).toHaveClass('min-h-11', 'shrink-0', 'rounded-full')
})
