import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxesPage } from './BoxesPage'

const { mockDeleteBox, mockListBoxes } = vi.hoisted(() => ({
  mockDeleteBox: vi.fn(),
  mockListBoxes: vi.fn(),
}))

const catalogueSpies = vi.hoisted(() => ({
  catalogueSpaces: vi.fn(),
  catalogueSummary: vi.fn(),
  filterAndSortBoxes: vi.fn(),
}))

vi.mock('./boxes.api', () => ({
  deleteBox: mockDeleteBox,
  listBoxes: mockListBoxes,
}))

vi.mock('./box-catalogue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./box-catalogue')>()
  catalogueSpies.catalogueSpaces.mockImplementation(actual.catalogueSpaces)
  catalogueSpies.catalogueSummary.mockImplementation(actual.catalogueSummary)
  catalogueSpies.filterAndSortBoxes.mockImplementation(actual.filterAndSortBoxes)
  return { ...actual, ...catalogueSpies }
})

vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt, className }: { objectKey: string; alt: string; className?: string }) => (
    <img src={`https://example.com/${objectKey}`} alt={alt} className={className} />
  ),
}))

vi.mock('./CreateBoxModal', () => ({
  CreateBoxModal: ({ open, onClose, onCompleted, onBusyChange }: {
    open: boolean
    onClose: () => void
    onCompleted: (box: unknown) => void
    onBusyChange?: (busy: boolean) => void
  }) => open ? (
    <div role="dialog" aria-label="创建箱子">
      <button type="button" onClick={onClose}>关闭测试模态</button>
      <button type="button" onClick={() => onCompleted({ id: 'box-new' })}>完成测试创建</button>
      <button type="button" onClick={() => onBusyChange?.(true)}>开始忙碌</button>
      <button type="button" onClick={() => onBusyChange?.(false)}>结束忙碌</button>
    </div>
  ) : null,
}))

const boxes = [
  {
    id: 'box-1',
    public_id: 'public-1',
    box_code: 'BX-00001',
    name: '冬季衣物',
    space_id: 'space-1',
    space_name: '卧室',
    location: '衣柜上层',
    visibility: 'private',
    cover_object_key: 'users/u/boxes/box-1.webp',
    item_count: 8,
    updated_at: '2026-07-29T10:00:00Z',
  },
  {
    id: 'box-2',
    public_id: 'public-2',
    box_code: 'BX-00002',
    name: '露营用品',
    space_id: 'space-2',
    space_name: '储藏室',
    location: null,
    visibility: 'public',
    cover_object_key: null,
    item_count: 12,
    updated_at: '2026-07-28T10:00:00Z',
  },
]

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  return (
    <>
      <output data-testid="location">{location.search}</output>
      <output data-testid="navigation-type">{navigationType}</output>
      <button type="button" onClick={() => navigate(-1)}>后退测试</button>
    </>
  )
}

function renderBoxes(initialEntry = '/app/boxes') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter([{
    path: '/app/boxes',
    element: (
      <>
        <BoxesPage />
        <LocationProbe />
      </>
    ),
  }], { initialEntries: [initialEntry] })
  return {
    client,
    router,
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

function primaryLinkNames() {
  return screen.getAllByRole('link', { name: /^打开/ }).map((link) => link.getAttribute('aria-label'))
}

beforeEach(() => {
  mockDeleteBox.mockReset()
  mockListBoxes.mockReset()
  catalogueSpies.catalogueSpaces.mockClear()
  catalogueSpies.catalogueSummary.mockClear()
  catalogueSpies.filterAndSortBoxes.mockClear()
})

afterEach(cleanup)

test('hydrates search, space, and sort from the URL and renders only matching cards', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?q=衣&space=space-1&sort=items')

  expect(await screen.findByRole('searchbox', { name: '搜索箱子' })).toHaveValue('衣')
  expect(screen.getByRole('button', { name: '卧室 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('combobox', { name: '箱子排序' })).toHaveValue('items')
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toHaveAttribute('href', '/b/public-1')
  expect(screen.queryByRole('link', { name: '打开露营用品' })).not.toBeInTheDocument()
  expect(screen.getByText('显示 1 个')).toBeInTheDocument()
})

test('writes search and sort with replacement while preserving other URL state', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1&sort=items&panel=keep')

  const searchbox = await screen.findByRole('searchbox', { name: '搜索箱子' })
  await user.type(searchbox, '衣')

  expect(screen.getByTestId('location')).toHaveTextContent('space=space-1')
  expect(screen.getByTestId('location')).toHaveTextContent('sort=items')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
  expect(screen.getByTestId('location')).toHaveTextContent('q=%E8%A1%A3')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')

  await user.selectOptions(screen.getByRole('combobox', { name: '箱子排序' }), 'recent')
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-1')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
  expect(screen.getByTestId('location')).toHaveTextContent('q=%E8%A1%A3')
  expect(screen.getByTestId('location')).not.toHaveTextContent('sort=')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
})

test.each(['recent', 'unsupported'])('normalizes sort=%s out of the URL and keeps it out of later filter updates', async (rawSort) => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes(`/app/boxes?sort=${rawSort}&panel=keep`)

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?panel=keep'))
  expect(screen.getByTestId('location')).not.toHaveTextContent('sort=')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')

  await user.click(screen.getByRole('button', { name: '卧室 1' }))
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-1')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
  expect(screen.getByTestId('location')).not.toHaveTextContent('sort=')
})

test('space chips preserve search, sort, and unknown URL parameters', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?q=%E7%94%A8%E5%93%81&sort=items&panel=keep')

  await screen.findByRole('link', { name: '打开露营用品' })
  await user.click(screen.getByRole('button', { name: '储藏室 1' }))

  expect(screen.getByTestId('location')).toHaveTextContent('q=%E7%94%A8%E5%93%81')
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-2')
  expect(screen.getByTestId('location')).toHaveTextContent('sort=items')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')

  await user.click(screen.getByRole('button', { name: '全部空间 2' }))
  expect(screen.getByTestId('location')).not.toHaveTextContent('space=')
  expect(screen.getByTestId('location')).toHaveTextContent('q=%E7%94%A8%E5%93%81')
  expect(screen.getByTestId('location')).toHaveTextContent('sort=items')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
})

test('shows the global catalogue summary after loading', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?q=衣&space=space-1')

  expect(await screen.findByText('2 个箱子 · 20 件物品')).toBeInTheDocument()
  expect(screen.getByText('显示 1 个')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '全部箱子', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('收纳目录')).toBeInTheDocument()
})

test('shows a compact result count on mobile and keeps the desktop wording', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1')

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const resultStatus = screen.getByRole('status', { name: '显示 1 个箱子' })
  expect(screen.getByText('1 个', { selector: 'span' })).toHaveClass('sm:hidden')
  expect(screen.getByText('1 个', { selector: 'span' })).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByText('显示 1 个')).toHaveClass('hidden', 'sm:inline')
  expect(screen.getByText('显示 1 个')).toHaveAttribute('aria-hidden', 'true')
  expect(resultStatus).not.toHaveClass('hidden')
})

test('sorts rendered card links by items and name', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?sort=items')

  await screen.findByRole('link', { name: '打开冬季衣物' })
  expect(screen.getByRole('option', { name: '物品数量从多到少' })).toHaveValue('items')
  expect(primaryLinkNames()).toEqual(['打开露营用品', '打开冬季衣物'])

  await user.selectOptions(screen.getByRole('combobox', { name: '箱子排序' }), 'name')
  await waitFor(() => expect(primaryLinkNames()).toEqual(['打开冬季衣物', '打开露营用品']))
})

test('filters from chips and exposes cover, placeholder, and card metadata', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1')

  const winterCard = await screen.findByRole('article', { name: '冬季衣物' })
  expect(within(winterCard).getByRole('img', { name: '冬季衣物封面' })).toBeInTheDocument()
  expect(within(winterCard).getByText('BX-00001')).toBeInTheDocument()
  expect(within(winterCard).getByText('卧室 · 衣柜上层')).toBeInTheDocument()
  expect(within(winterCard).getByText('8 件物品')).toBeInTheDocument()
  expect(within(winterCard).getByText('私有')).toBeInTheDocument()
  expect(winterCard.parentElement).toHaveClass('grid-cols-1', 'min-[420px]:grid-cols-2', 'lg:grid-cols-3', '2xl:grid-cols-4')

  await user.click(screen.getByRole('button', { name: '储藏室 1' }))
  expect(screen.queryByRole('article', { name: '冬季衣物' })).not.toBeInTheDocument()
  const campingCard = screen.getByRole('article', { name: '露营用品' })
  expect(within(campingCard).getByRole('img', { name: '箱子封面占位图' })).toBeInTheDocument()
  expect(within(campingCard).getByText('储藏室 · 未填写位置')).toBeInTheDocument()
  expect(within(campingCard).getByText('12 件物品')).toBeInTheDocument()
  expect(within(campingCard).getByText('公开')).toBeInTheDocument()
})

test('keeps only one catalogue card menu open', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('link', { name: '编辑冬季衣物' })).toHaveAttribute('href', '/app/boxes/box-1/edit')

  await user.click(screen.getByRole('button', { name: '管理露营用品' }))
  expect(screen.queryByRole('link', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '编辑露营用品' })).toHaveAttribute('href', '/app/boxes/box-2/edit')
})

test('does not recompute catalogue derivations for menu and mutation rerenders', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  mockDeleteBox.mockReturnValue(new Promise(() => {}))
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const callsAfterLoad = {
    spaces: catalogueSpies.catalogueSpaces.mock.calls.length,
    summary: catalogueSpies.catalogueSummary.mock.calls.length,
    visible: catalogueSpies.filterAndSortBoxes.mock.calls.length,
  }

  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '确认删除' }))
  await screen.findByRole('button', { name: '处理中…' })

  expect(catalogueSpies.catalogueSpaces).toHaveBeenCalledTimes(callsAfterLoad.spaces)
  expect(catalogueSpies.catalogueSummary).toHaveBeenCalledTimes(callsAfterLoad.summary)
  expect(catalogueSpies.filterAndSortBoxes).toHaveBeenCalledTimes(callsAfterLoad.visible)
})

test('keeps a restored card menu closed after catalogue criteria change through history', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  const { router } = renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('link', { name: '编辑冬季衣物' })).toBeInTheDocument()

  await act(async () => { await router.navigate('/app/boxes?q=missing') })
  expect(await screen.findByText('没有匹配的箱子')).toBeInTheDocument()
  await act(async () => { await router.navigate(-1) })

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '管理冬季衣物' })).toHaveAttribute('aria-expanded', 'false')
})

test('distinguishes a true empty catalogue from filtered no-match results', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  const firstView = renderBoxes('/app/boxes?q=missing&space=space-1&sort=items&panel=keep')

  expect(await screen.findByText('没有匹配的箱子')).toBeInTheDocument()
  expect(screen.queryByText('还没有箱子')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '创建箱子' })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '清除筛选' }))

  expect(screen.getByTestId('location')).toHaveTextContent('?panel=keep')
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开露营用品' })).toBeInTheDocument()
  firstView.unmount()

  mockListBoxes.mockResolvedValue([])
  renderBoxes()
  expect(await screen.findByText('还没有箱子')).toBeInTheDocument()
  expect(screen.queryByText('没有匹配的箱子')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox', { name: '搜索箱子' })).not.toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: '创建箱子' }).at(-1)!)
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
})

test('opens creation from the URL and closes it without losing catalogue state', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1&create=1')

  expect(await screen.findByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭测试模态' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?space=space-1')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
})

test('closes, refreshes, announces success, renders the new card, and restores focus after creation completes', async () => {
  const user = userEvent.setup()
  const newBox = {
    id: 'box-new', public_id: 'public-new', box_code: 'BX-00003', name: '书籍',
    space_id: 'space-1', space_name: '卧室', location: null, visibility: 'private',
    cover_object_key: null, item_count: 0, updated_at: '2026-07-30T10:00:00Z',
  }
  mockListBoxes.mockResolvedValueOnce(boxes).mockResolvedValueOnce([newBox, ...boxes])
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const createButton = screen.getByRole('button', { name: '创建箱子' })
  expect(createButton).toHaveClass('min-h-11', 'bg-brand')
  expect(within(createButton).getByText('新建')).toHaveClass('sm:hidden')
  expect(within(createButton).getByText('创建箱子')).toHaveClass('hidden', 'sm:inline')
  await user.click(createButton)
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('PUSH')
  await user.click(screen.getByRole('button', { name: '开始忙碌' }))
  await user.click(screen.getByRole('button', { name: '完成测试创建' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(await screen.findByRole('article', { name: '书籍' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '箱子已创建' })).toBeInTheDocument()
  await waitFor(() => expect(createButton).toHaveFocus())
  expect(mockListBoxes).toHaveBeenCalledTimes(2)
})

test('lets browser back close a modal opened from the list and restores focus', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '后退测试' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toBeEmptyDOMElement()
  await waitFor(() => expect(screen.getByRole('button', { name: '创建箱子' })).toHaveFocus())
})

test('blocks browser back while creation is busy', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  await user.click(screen.getByRole('button', { name: '开始忙碌' }))
  await user.click(screen.getByRole('button', { name: '后退测试' }))

  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')

  await user.click(screen.getByRole('button', { name: '结束忙碌' }))
  await user.click(screen.getByRole('button', { name: '后退测试' }))
  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
})

test('removes a deleted box and closes the dialog before catalogue revalidation finishes', async () => {
  const user = userEvent.setup()
  let resolveRefetch!: (value: typeof boxes) => void
  mockListBoxes
    .mockResolvedValueOnce(boxes)
    .mockReturnValueOnce(new Promise((resolve) => { resolveRefetch = resolve }))
  mockDeleteBox.mockResolvedValue(undefined)
  const { client } = renderBoxes()

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toHaveAttribute('href', '/b/public-1')
  const stableCreateAction = screen.getByRole('button', { name: '创建箱子' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('link', { name: '编辑冬季衣物' })).toHaveAttribute('href', '/app/boxes/box-1/edit')
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(screen.queryByRole('link', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteBox).toHaveBeenCalledWith('box-1')
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('link', { name: '打开冬季衣物' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开露营用品' })).toBeInTheDocument()
  expect(client.getQueryData(['boxes'])).toEqual([boxes[1]])
  await waitFor(() => expect(stableCreateAction).toHaveFocus())
  expect(mockListBoxes).toHaveBeenCalledTimes(2)

  await act(async () => { resolveRefetch([boxes[1]]) })
})

test('shows a toolbar and six-card skeleton until the catalogue request resolves', async () => {
  let resolveBoxes!: (value: typeof boxes) => void
  mockListBoxes.mockReturnValue(new Promise((resolve) => { resolveBoxes = resolve }))
  renderBoxes()

  const loading = screen.getByRole('status', { name: '正在加载箱子目录' })
  const visualLayout = loading.querySelector(':scope > [aria-hidden="true"]')
  expect(visualLayout).toHaveClass('grid', 'gap-5')
  const cardGrid = Array.from(visualLayout?.children ?? []).find((child) => child.classList.contains('lg:grid-cols-3'))
  expect(cardGrid).toHaveClass('grid', 'min-[420px]:grid-cols-2')
  expect(cardGrid?.children).toHaveLength(6)
  expect(Array.from(cardGrid?.children ?? []).every((card) => card.querySelector('[data-testid="skeleton"]'))).toBe(true)
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox', { name: '搜索箱子' })).not.toBeInTheDocument()

  await act(async () => { resolveBoxes(boxes) })

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
})

test('keeps real catalogue content visible without skeletons during a background refetch', async () => {
  const refresh = deferred<typeof boxes>()
  mockListBoxes.mockResolvedValueOnce(boxes).mockReturnValueOnce(refresh.promise)
  const { client } = renderBoxes()

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  act(() => { void client.invalidateQueries({ queryKey: ['boxes'] }) })

  await waitFor(() => expect(mockListBoxes).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('searchbox', { name: '搜索箱子' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: '正在加载箱子目录' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()

  await act(async () => { refresh.resolve(boxes) })
})

test('retries a failed catalogue load', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce(boxes)
  renderBoxes()

  expect(await screen.findByRole('alert')).toHaveTextContent('箱子加载失败，请重试')
  await user.click(screen.getByRole('button', { name: '重试' }))

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
})

test('keeps the stale catalogue available when a background refetch fails', async () => {
  const user = userEvent.setup()
  mockListBoxes
    .mockResolvedValueOnce(boxes)
    .mockRejectedValueOnce(new Error('refetch failed'))
    .mockResolvedValueOnce(boxes)
  const { client } = renderBoxes('/app/boxes?space=space-1')

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  await act(async () => { await client.invalidateQueries({ queryKey: ['boxes'] }) })

  const refetchAlert = await screen.findByRole('alert')
  expect(refetchAlert).toHaveTextContent('箱子刷新失败，正在显示上次结果')
  expect(screen.getByText('2 个箱子 · 20 件物品')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: '搜索箱子' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '卧室 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByText('箱子加载失败，请重试')).not.toBeInTheDocument()

  await user.click(within(refetchAlert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(screen.queryByText('箱子刷新失败，正在显示上次结果')).not.toBeInTheDocument())
})

test('keeps a failed delete inline and restores focus to its card trigger on cancel', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  mockDeleteBox.mockRejectedValue(new Error('delete failed'))
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const winterTrigger = screen.getByRole('button', { name: '管理冬季衣物' })
  await user.click(winterTrigger)
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))

  const dialog = screen.getByRole('alertdialog', { name: '删除“冬季衣物”？' })
  await waitFor(() => expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus())
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('删除失败，请稍后重试')
  expect(within(dialog).getByRole('button', { name: '确认删除' })).toBeEnabled()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: '取消' }))

  await waitFor(() => expect(winterTrigger).toHaveFocus())

  await user.click(screen.getByRole('button', { name: '管理露营用品' }))
  await user.click(screen.getByRole('button', { name: '删除露营用品' }))
  expect(within(screen.getByRole('alertdialog')).queryByRole('alert')).not.toBeInTheDocument()
})

test('retries a failed inline deletion', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValueOnce([boxes[0]]).mockResolvedValueOnce([])
  mockDeleteBox.mockRejectedValueOnce(new Error('delete failed')).mockResolvedValueOnce(undefined)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  const dialog = screen.getByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }))
  await within(dialog).findByRole('alert')

  await user.click(within(dialog).getByRole('button', { name: '确认删除' }))

  expect(mockDeleteBox).toHaveBeenCalledTimes(2)
  expect(await screen.findByText('还没有箱子')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
