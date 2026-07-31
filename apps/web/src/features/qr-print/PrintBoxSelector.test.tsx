import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import type { BoxSummary } from '../boxes/boxes.api'
import { PrintBoxSelector } from './PrintBoxSelector'

afterEach(cleanup)

const boxes: BoxSummary[] = [
  {
    id: 'box-winter', public_id: 'winter-public', box_code: 'BX-001', name: '冬季衣物',
    space_id: 'space-bedroom', space_name: '卧室', location: '衣柜上层', visibility: 'private',
    cover_object_key: null, item_count: 3, updated_at: '2026-07-30T00:00:00.000Z',
  },
  {
    id: 'box-tools', public_id: 'tools-public', box_code: 'BX-002', name: '修理工具',
    space_id: 'space-garage', space_name: '车库', location: null, visibility: 'private',
    cover_object_key: null, item_count: 5, updated_at: '2026-07-29T00:00:00.000Z',
  },
]

const manyBoxes: BoxSummary[] = Array.from({ length: 12 }, (_, index) => ({
  ...boxes[index % boxes.length],
  id: `box-${index}`,
  public_id: `public-${index}`,
  box_code: `BX-${String(index).padStart(3, '0')}`,
  name: `箱子 ${index + 1}`,
}))

type HarnessProps = Partial<React.ComponentProps<typeof PrintBoxSelector>>

function SelectorHarness({ onQueryChange = vi.fn(), onToggle = vi.fn(), onToggleVisible = vi.fn(), onDownload = vi.fn(), ...overrides }: HarnessProps) {
  const [query, setQuery] = useState(overrides.query ?? '')

  return <PrintBoxSelector
    boxes={boxes}
    totalCount={6}
    selected={new Set()}
    query={query}
    generating={false}
    onQueryChange={(nextQuery) => {
      onQueryChange(nextQuery)
      setQuery(nextQuery)
    }}
    onToggle={onToggle}
    onToggleVisible={onToggleVisible}
    onDownload={onDownload}
    {...overrides}
  />
}

test('renders the named selection region and updates its controlled search query', async () => {
  const user = userEvent.setup()
  const onQueryChange = vi.fn()
  render(<SelectorHarness onQueryChange={onQueryChange} />)

  expect(screen.getByRole('region', { name: '选择要打印的箱子' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '选择箱子' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '已选择 0 个箱子' })).toBeInTheDocument()
  expect(screen.getByText('显示 2 / 共 6 个箱子')).toBeInTheDocument()

  const searchbox = screen.getByRole('searchbox', { name: '搜索箱子' })
  expect(searchbox).toHaveAttribute('placeholder', '搜索箱子名称、编号或空间')
  await user.type(searchbox, '冬季')

  expect(searchbox).toHaveValue('冬季')
  expect(onQueryChange).toHaveBeenLastCalledWith('冬季')
})

test('delegates box toggles without mutating the controlled checkbox state', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()
  render(<SelectorHarness onToggle={onToggle} />)

  const checkbox = screen.getByRole('checkbox', { name: /冬季衣物.*卧室.*衣柜上层.*BX-001/i })
  expect(checkbox).not.toBeChecked()
  await user.click(checkbox)

  expect(onToggle).toHaveBeenCalledTimes(1)
  expect(onToggle).toHaveBeenLastCalledWith('box-winter')
  expect(checkbox).not.toBeChecked()
})

test('clicking row text delegates exactly one toggle for that box', async () => {
  const user = userEvent.setup()
  const onToggle = vi.fn()
  render(<SelectorHarness onToggle={onToggle} />)

  await user.click(screen.getByText('冬季衣物'))

  expect(onToggle).toHaveBeenCalledTimes(1)
  expect(onToggle).toHaveBeenLastCalledWith('box-winter')
})

test('uses the selected set for checkbox state and renders location fallback metadata', () => {
  render(<SelectorHarness selected={new Set(['box-winter'])} />)

  expect(screen.getByRole('checkbox', { name: /冬季衣物.*卧室.*衣柜上层.*BX-001/i })).toBeChecked()
  expect(screen.getByText('车库 · 未填写位置')).toBeInTheDocument()
  expect(screen.getByText('BX-002')).toBeInTheDocument()
})

test('delegates visible-result selection and switches all-selection copy', async () => {
  const user = userEvent.setup()
  const onToggleVisible = vi.fn()
  const { rerender } = render(<SelectorHarness onToggleVisible={onToggleVisible} />)

  await user.click(screen.getByRole('button', { name: '全选当前结果' }))
  expect(onToggleVisible).toHaveBeenCalledTimes(1)

  rerender(<SelectorHarness selected={new Set(['box-winter', 'box-tools'])} onToggleVisible={onToggleVisible} />)
  await user.click(screen.getByRole('button', { name: '取消选择当前结果' }))
  expect(onToggleVisible).toHaveBeenCalledTimes(2)
})

test('disables visible-result selection without invoking its callback when the current result set is empty', async () => {
  const user = userEvent.setup()
  const onToggleVisible = vi.fn()
  render(<SelectorHarness boxes={[]} onToggleVisible={onToggleVisible} />)

  const button = screen.getByRole('button', { name: '全选当前结果' })
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onToggleVisible).not.toHaveBeenCalled()
  expect(screen.getByText('显示 0 / 共 6 个箱子')).toBeInTheDocument()
})

test('does not invoke download while disabled for an empty selection or generation', async () => {
  const user = userEvent.setup()
  const onDownload = vi.fn()
  const { rerender } = render(<SelectorHarness onDownload={onDownload} />)

  const emptySelectionButton = screen.getByRole('button', { name: '下载 PDF' })
  expect(emptySelectionButton).toBeDisabled()
  await user.click(emptySelectionButton)
  expect(onDownload).not.toHaveBeenCalled()

  rerender(<SelectorHarness selected={new Set(['box-winter'])} generating onDownload={onDownload} />)
  const generatingButton = screen.getByRole('button', { name: '生成中…' })
  expect(generatingButton).toBeDisabled()
  expect(generatingButton).toHaveTextContent('生成中…')
  await user.click(generatingButton)
  expect(onDownload).not.toHaveBeenCalled()
})

test('delegates download when a box is selected and generation is idle', async () => {
  const user = userEvent.setup()
  const onDownload = vi.fn()
  render(<SelectorHarness selected={new Set(['box-winter'])} onDownload={onDownload} />)

  await user.click(screen.getByRole('button', { name: '下载 PDF' }))
  expect(onDownload).toHaveBeenCalledTimes(1)
})

test('limits a multi-row result list to an independently scrollable area', () => {
  render(<SelectorHarness boxes={manyBoxes} />)

  const renderedRows = screen.getAllByRole('checkbox')
  const list = renderedRows[0].closest('label')?.parentElement
  expect(renderedRows).toHaveLength(12)
  expect(list).toHaveClass('max-h-[32rem]', 'overflow-y-auto', 'overscroll-contain')
})

test('uses a single shadow-free warm card with compact rows, separators, and visible focus rings', () => {
  const { container } = render(<SelectorHarness selected={new Set(['box-winter'])} />)

  const region = screen.getByRole('region', { name: '选择要打印的箱子' })
  const selectedRow = screen.getByRole('checkbox', { name: /冬季衣物/i }).closest('label')
  const plainRow = screen.getByRole('checkbox', { name: /修理工具/i }).closest('label')

  expect(region).toHaveClass('rounded-card', 'border-line', 'bg-surface')
  expect(region.className).not.toMatch(/\bshadow/)
  expect(container.querySelectorAll('.rounded-card')).toHaveLength(1)
  expect(region.querySelector('header')).toHaveClass('border-b', 'border-line')
  expect(region.querySelector('footer')).toHaveClass('border-t', 'border-line')
  expect(selectedRow).toHaveClass('min-h-14', 'border-brand', 'bg-brand/10')
  expect(plainRow).toHaveClass('min-h-14', 'border-line', 'bg-surface')
  expect(screen.getByRole('searchbox', { name: '搜索箱子' })).toHaveClass('focus-visible:ring-2')
  expect(screen.getByRole('button', { name: '全选当前结果' })).toHaveClass('focus-visible:ring-2')
  expect(screen.getByRole('button', { name: '下载 PDF' })).toHaveClass('focus-visible:ring-2')
})
