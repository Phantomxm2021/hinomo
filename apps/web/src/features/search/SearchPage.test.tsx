import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type PropsWithChildren } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SearchPage } from './SearchPage'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'

const { mockCaptureGrowthEvent, mockFirstGrowthOccurrence, mockListBoxes, mockSearchItems } = vi.hoisted(() => ({
  mockCaptureGrowthEvent: vi.fn(),
  mockFirstGrowthOccurrence: vi.fn(),
  mockListBoxes: vi.fn(),
  mockSearchItems: vi.fn(),
}))

vi.mock('./search.api', () => ({ searchItems: mockSearchItems }))
vi.mock('../boxes/boxes.api', () => ({ listBoxes: mockListBoxes }))
vi.mock('../../lib/analytics', () => ({
  captureGrowthEvent: mockCaptureGrowthEvent,
  firstGrowthOccurrence: mockFirstGrowthOccurrence,
}))

const boxes = [
  {
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '充电器收纳箱',
    space_id: 'space-1', venue_name: '公司', space_name: '办公室', location: '书房柜子', visibility: 'private',
    cover_object_key: null, item_count: 2, updated_at: '2026-07-29T10:00:00Z',
  },
  {
    id: 'box-2', public_id: 'public-2', box_code: 'CAMP-002', name: '露营装备',
    space_id: 'space-2', venue_name: '家里', space_name: '储藏室', location: '北侧', visibility: 'public',
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

function renderSearch(initialEntry = '/app/search', client: QueryClient | undefined = undefined) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nProvider><MobileFeedbackProvider><MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <SearchPage />
        <LocationProbe />
        <NavigationControls />
      </QueryClientProvider>
    </MemoryRouter></MobileFeedbackProvider></I18nProvider>,
  )
}

beforeEach(() => {
  mockSearchItems.mockReset()
  mockListBoxes.mockReset()
  mockCaptureGrowthEvent.mockReset()
  mockFirstGrowthOccurrence.mockReset().mockReturnValue(true)
  mockListBoxes.mockResolvedValue(boxes)
})

afterEach(cleanup)

test('captures resolved search results without the query text', async () => {
  mockSearchItems.mockResolvedValue([])
  renderSearch('/app/search?q=充电器')

  await waitFor(() => expect(mockCaptureGrowthEvent).toHaveBeenCalledWith('first_search_completed', {
    has_results: true, first: true,
  }))
  expect(mockCaptureGrowthEvent.mock.calls.flat()).not.toContain('充电器')
})

test('does not capture a search event when either enabled query errors', async () => {
  mockListBoxes.mockRejectedValue(new Error('network'))
  mockSearchItems.mockResolvedValue([])
  renderSearch('/app/search?q=充电器')

  await screen.findByRole('alertdialog')
  expect(mockCaptureGrowthEvent).not.toHaveBeenCalled()
})

test('does not capture a search event from cached results when the refetch fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['boxes'], boxes)
  client.setQueryData(['search-items', '充电器'], [])
  mockListBoxes.mockRejectedValue(new Error('boxes refresh failed'))
  mockSearchItems.mockRejectedValue(new Error('items refresh failed'))

  renderSearch('/app/search?q=充电器', client)

  await screen.findByRole('alertdialog')
  expect(mockCaptureGrowthEvent).not.toHaveBeenCalled()
})

test('shows grouped result-row skeletons while an initial search is pending', async () => {
  mockListBoxes.mockReturnValue(new Promise(() => undefined))
  mockSearchItems.mockReturnValue(new Promise(() => undefined))
  renderSearch('/app/search?q=充电器')

  const loading = await screen.findByRole('status', { name: '正在搜索收纳内容' })
  expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThan(8)
  expect(screen.queryByText('正在搜索…')).not.toBeInTheDocument()
  expect(screen.queryByText('输入关键词，快速找到物品所在的箱子。')).not.toBeInTheDocument()
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
    item_id: 'item-1', item_name: 'USB-C 充电器', quantity: 2, stored_quantity: 1,
    box_id: 'box-1', box_public_id: 'public-1', box_name: '电子设备箱',
    venue_name: '公司', space_name: '办公室', location: '书房柜子',
  }])
  renderSearch('/app/search?q=充电器')

  expect(await screen.findByText('USB-C 充电器 × 2')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toHaveTextContent('暂时无法完成此操作')
  expect(screen.queryByText('搜索失败，请重试')).not.toBeInTheDocument()
})

test('shows box results with a local retry when items initially fail', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  mockSearchItems.mockRejectedValue(new Error('items network'))
  renderSearch('/app/search?q=充电器')

  expect(await screen.findByText('充电器收纳箱')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog')).toHaveTextContent('暂时无法完成此操作')
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
  await waitFor(() => expect(screen.getAllByRole('alertdialog')).toHaveLength(1))
  const alerts = screen.getAllByRole('alertdialog')
  expect(alerts[0]).toHaveTextContent('暂时无法完成此操作')
  const boxRetry = within(alerts[0]).getByRole('button', { name: '重试' })
  await user.click(boxRetry)
  await waitFor(() => expect(mockSearchItems).toHaveBeenCalledTimes(2))
})

test('initializes from q and groups matching boxes and items', async () => {
  mockSearchItems.mockResolvedValue([{
    item_id: 'item-1', item_name: 'USB-C 充电器', quantity: 2, stored_quantity: 1,
    box_id: 'box-1', box_public_id: 'public-1', box_name: '电子设备箱',
    space_name: '办公室', location: '书房柜子',
  }])
  renderSearch('/app/search?q=充电器')

  expect(screen.getByRole('searchbox')).toHaveValue('充电器')
  const boxesGroup = await screen.findByRole('region', { name: '箱子' })
  const itemsGroup = await screen.findByRole('region', { name: '物品' })
  expect(within(boxesGroup).getByText('充电器收纳箱')).toBeInTheDocument()
  expect(within(boxesGroup).getByText('BX-00001 · 公司 · 办公室 · 书房柜子')).toBeInTheDocument()
  expect(within(itemsGroup).getByText('USB-C 充电器 × 2')).toBeInTheDocument()
  expect(within(itemsGroup).getByText('部分取出 · 1/2 在箱中')).toBeInTheDocument()
  expect(mockSearchItems).toHaveBeenCalledWith('充电器')
})

test('provides a standard mobile back navigation', () => {
  mockSearchItems.mockResolvedValue([])
  renderSearch('/app/search?q=充电器')

  expect(screen.getByRole('navigation', { name: '搜索导航' })).toHaveClass(
    'sticky', 'grid', 'grid-cols-[6rem_minmax(0,1fr)_6rem]', 'lg:hidden',
  )
  expect(within(screen.getByRole('navigation', { name: '搜索导航' })).getByRole('button', { name: '返回' })).toBeInTheDocument()
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

test('clears the search from the aligned clear button without losing focus', async () => {
  const user = userEvent.setup()
  mockSearchItems.mockResolvedValue([])
  renderSearch('/app/search?q=充电器')

  const input = screen.getByRole('searchbox')
  const clearButton = screen.getByRole('button', { name: '清除搜索' })
  expect(clearButton).toHaveClass('absolute', 'size-9', 'top-1/2', 'right-1.5')
  await user.click(clearButton)

  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
  expect(screen.getByTestId('location')).toHaveTextContent('')
  expect(screen.getByText('输入关键词，快速找到物品所在的箱子。')).toBeInTheDocument()
})

test('uses a semantic search form and submits immediately', async () => {
  const user = userEvent.setup()
  mockSearchItems.mockResolvedValue([])
  renderSearch()

  const form = screen.getByRole('search', { name: '查找收纳' })
  const input = within(form).getByRole('searchbox')
  expect(form).toHaveClass('w-full')
  expect(form).not.toHaveClass('max-w-3xl')
  expect(input).toHaveAttribute('enterkeyhint', 'search')
  expect(input).toHaveClass('h-11', 'text-body', 'focus-visible:outline-none')
  expect(input).not.toHaveClass('min-h-14', 'text-lg')
  expect(within(form).getByTestId('search-input-shell')).toHaveClass(
    'min-h-12', 'rounded-control', 'focus-within:border-brand',
  )
  await user.type(input, '  露营灯  ')
  await user.keyboard('{Enter}')

  await waitFor(() => expect(mockSearchItems).toHaveBeenCalledWith('露营灯'))
  expect(screen.getByTestId('location')).toHaveTextContent('?q=%E9%9C%B2%E8%90%A5%E7%81%AF')
})

test('waits for IME composition to finish before searching', async () => {
  mockSearchItems.mockResolvedValue([])
  renderSearch()

  const input = screen.getByRole('searchbox')
  fireEvent.compositionStart(input)
  fireEvent.change(input, { target: { value: '相机' } })
  await new Promise((resolve) => window.setTimeout(resolve, 320))
  expect(mockSearchItems).not.toHaveBeenCalled()

  fireEvent.compositionEnd(input)
  await waitFor(() => expect(mockSearchItems).toHaveBeenCalledWith('相机'))
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

test('renders search navigation and empty state in English', async () => {
  mockSearchItems.mockResolvedValue([])
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <EnglishProvider>
        <MemoryRouter initialEntries={['/app/search?q=missing']}>
          <QueryClientProvider client={queryClient}><SearchPage /></QueryClientProvider>
        </MemoryRouter>
      </EnglishProvider>
    </I18nProvider>,
  )

  expect(await screen.findByRole('heading', { name: 'Search' })).toBeInTheDocument()
  expect(screen.getByRole('search', { name: 'Find storage' })).toBeInTheDocument()
  expect(await screen.findByText('No matching results.')).toBeInTheDocument()
})
