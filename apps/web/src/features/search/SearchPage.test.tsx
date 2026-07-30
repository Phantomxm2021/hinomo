import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SearchPage } from './SearchPage'

const { mockListBoxes, mockSearchItems } = vi.hoisted(() => ({
  mockListBoxes: vi.fn(),
  mockSearchItems: vi.fn(),
}))

vi.mock('./search.api', () => ({ searchItems: mockSearchItems }))
vi.mock('../boxes/boxes.api', () => ({ listBoxes: mockListBoxes }))

const boxes = [
  {
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '充电器收纳箱',
    space_id: 'space-1', space_name: '办公室', location: '书房柜子', visibility: 'private',
    cover_object_key: null, item_count: 2, updated_at: '2026-07-29T10:00:00Z',
  },
  {
    id: 'box-2', public_id: 'public-2', box_code: 'CAMP-002', name: '露营装备',
    space_id: 'space-2', space_name: '储藏室', location: '北侧', visibility: 'public',
    cover_object_key: null, item_count: 4, updated_at: '2026-07-28T10:00:00Z',
  },
]

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function renderSearch(initialEntry = '/app/search') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <SearchPage />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockSearchItems.mockReset()
  mockListBoxes.mockReset()
  mockListBoxes.mockResolvedValue(boxes)
})

afterEach(cleanup)

test('initializes from q and groups matching boxes and items', async () => {
  mockSearchItems.mockResolvedValue([{
    item_id: 'item-1', item_name: 'USB-C 充电器', quantity: 2,
    box_id: 'box-1', box_public_id: 'public-1', box_name: '电子设备箱',
    space_name: '办公室', location: '书房柜子',
  }])
  renderSearch('/app/search?q=充电器')

  expect(screen.getByRole('searchbox')).toHaveValue('充电器')
  expect(mockSearchItems).not.toHaveBeenCalled()
  const boxesGroup = await screen.findByRole('region', { name: '箱子' })
  const itemsGroup = await screen.findByRole('region', { name: '物品' })
  expect(within(boxesGroup).getByText('充电器收纳箱')).toBeInTheDocument()
  expect(within(boxesGroup).getByText('BX-00001 · 办公室 · 书房柜子')).toBeInTheDocument()
  expect(within(itemsGroup).getByText('USB-C 充电器 × 2')).toBeInTheDocument()
  expect(mockSearchItems).toHaveBeenCalledWith('充电器')
})

test('matches boxes case-insensitively by code, space, and location', async () => {
  mockSearchItems.mockResolvedValue([])
  renderSearch('/app/search?q=camp')

  const boxesGroup = await screen.findByRole('region', { name: '箱子' })
  expect(within(boxesGroup).getByText('露营装备')).toBeInTheDocument()
})

test('replaces the URL query when the search input changes', async () => {
  const user = userEvent.setup()
  mockSearchItems.mockResolvedValue([])
  renderSearch('/app/search?q=旧关键词')

  const input = screen.getByRole('searchbox')
  await user.clear(input)
  await user.type(input, '  新关键词  ')

  expect(await screen.findByText('没有找到相关内容')).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?q=%E6%96%B0%E5%85%B3%E9%94%AE%E8%AF%8D')
})

test('suggests scanning when no boxes or items match', async () => {
  mockListBoxes.mockResolvedValue([])
  mockSearchItems.mockResolvedValue([])
  renderSearch('/app/search?q=不存在')

  expect(await screen.findByRole('link', { name: '扫码查看箱子' })).toHaveAttribute('href', '/app/scan')
})
