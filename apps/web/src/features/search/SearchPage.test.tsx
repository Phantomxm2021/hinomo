import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
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

function NavigationControls() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('/app/search?q=camp')}>打开露营搜索</button>
      <button type="button" onClick={() => navigate(-1)}>返回上一页</button>
      <button type="button" onClick={() => navigate('/app/search')}>清除查询</button>
    </>
  )
}

function renderSearch(initialEntry = '/app/search', client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <SearchPage />
        <LocationProbe />
        <NavigationControls />
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

test('shows grouped result-row skeletons while an initial search is pending', async () => {
  mockListBoxes.mockReturnValue(new Promise(() => undefined))
  mockSearchItems.mockReturnValue(new Promise(() => undefined))
  renderSearch('/app/search?q=充电器')

  const loading = await screen.findByRole('status', { name: '正在搜索收纳内容' })
  expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThan(8)
  expect(screen.queryByText('正在搜索…')).not.toBeInTheDocument()
})

test('blocks on an initial search error and offers retry', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockRejectedValue(new Error('network'))
  mockSearchItems.mockRejectedValue(new Error('network'))
  renderSearch('/app/search?q=充电器')

  await screen.findByText('搜索失败，请重试')
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('搜索失败，请重试')
  expect(screen.queryByText('充电器收纳箱')).not.toBeInTheDocument()
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(mockListBoxes).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(mockSearchItems).toHaveBeenCalledTimes(2))
})

test('shows item results with a local retry when boxes initially fail', async () => {
  mockListBoxes.mockRejectedValue(new Error('boxes network'))
  mockSearchItems.mockResolvedValue([{
    item_id: 'item-1', item_name: 'USB-C 充电器', quantity: 2,
    box_id: 'box-1', box_public_id: 'public-1', box_name: '电子设备箱',
    space_name: '办公室', location: '书房柜子',
  }])
  renderSearch('/app/search?q=充电器')

  expect(await screen.findByText('USB-C 充电器 × 2')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('箱子结果加载失败')
  expect(screen.queryByText('搜索失败，请重试')).not.toBeInTheDocument()
})

test('shows box results with a local retry when items initially fail', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  mockSearchItems.mockRejectedValue(new Error('items network'))
  renderSearch('/app/search?q=充电器')

  expect(await screen.findByText('充电器收纳箱')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('物品结果加载失败')
  expect(screen.queryByText('搜索失败，请重试')).not.toBeInTheDocument()
})

test('keeps cached box and item results visible when their refetches fail', async () => {
  const user = userEvent.setup()
  const cachedItems = [{
    item_id: 'item-1', item_name: 'USB-C 充电器', quantity: 2,
    box_id: 'box-1', box_public_id: 'public-1', box_name: '电子设备箱',
    space_name: '办公室', location: '书房柜子',
  }]
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['boxes'], boxes)
  client.setQueryData(['search-items', '充电器'], cachedItems)
  mockListBoxes.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(new Promise(() => undefined))
  mockSearchItems.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(new Promise(() => undefined))
  renderSearch('/app/search?q=充电器', client)

  expect(await screen.findByText('充电器收纳箱')).toBeInTheDocument()
  expect(screen.getByText('USB-C 充电器 × 2')).toBeInTheDocument()
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
  const alerts = screen.getAllByRole('alert')
  expect(alerts[0]).toHaveTextContent('箱子结果刷新失败')
  expect(alerts[1]).toHaveTextContent('物品结果刷新失败')
  const boxRetry = within(alerts[0]).getByRole('button', { name: '重试' })
  await user.click(boxRetry)
  expect(within(alerts[0]).getByRole('button', { name: '重试中…' })).toBeDisabled()
  expect(within(alerts[0]).getByRole('button', { name: '重试中…' })).toHaveAttribute('aria-busy', 'true')
  await user.click(within(alerts[0]).getByRole('button', { name: '重试中…' }))
  expect(mockListBoxes).toHaveBeenCalledTimes(2)

  const itemRetry = within(alerts[1]).getByRole('button', { name: '重试' })
  await user.click(itemRetry)
  expect(within(alerts[1]).getByRole('button', { name: '重试中…' })).toBeDisabled()
  await user.click(within(alerts[1]).getByRole('button', { name: '重试中…' }))
  expect(mockSearchItems).toHaveBeenCalledTimes(2)
})

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

test('follows same-route URL navigation, history, and q removal without stale input or results', async () => {
  const user = userEvent.setup()
  mockSearchItems.mockImplementation(async (query: string) => [{
    item_id: `item-${query}`, item_name: `${query}物品`, quantity: 1,
    box_id: 'box-1', box_public_id: 'public-1', box_name: '测试箱',
    space_name: '家', location: null,
  }])
  renderSearch('/app/search?q=充电器')

  expect(await screen.findByText('充电器物品 × 1')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '打开露营搜索' }))
  expect(screen.getByRole('searchbox')).toHaveValue('camp')
  expect(await screen.findByText('camp物品 × 1')).toBeInTheDocument()
  expect(screen.queryByText('充电器物品 × 1')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '返回上一页' }))
  expect(screen.getByRole('searchbox')).toHaveValue('充电器')
  expect(await screen.findByText('充电器物品 × 1')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '清除查询' }))
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getByText('输入关键词，快速找到物品所在的箱子。')).toBeInTheDocument()
  expect(screen.queryByText('充电器物品 × 1')).not.toBeInTheDocument()
})
