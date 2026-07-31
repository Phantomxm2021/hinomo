import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxesPage } from './BoxesPage'

const { mockDeleteBox, mockListBoxes } = vi.hoisted(() => ({
  mockDeleteBox: vi.fn(),
  mockListBoxes: vi.fn(),
}))

vi.mock('./boxes.api', () => ({
  deleteBox: mockDeleteBox,
  listBoxes: mockListBoxes,
}))

vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt, className }: { objectKey: string; alt: string; className?: string }) => (
    <img src={`https://example.com/${objectKey}`} alt={alt} className={className} />
  ),
}))

vi.mock('./CreateBoxModal', () => ({
  CreateBoxModal: ({ open, onClose, onCreated, onDone, onBusyChange }: {
    open: boolean
    onClose: () => void
    onCreated: (box: unknown) => void
    onDone: () => void
    onBusyChange?: (busy: boolean) => void
  }) => open ? (
    <div role="dialog" aria-label="创建箱子">
      <button type="button" onClick={onClose}>关闭测试模态</button>
      <button type="button" onClick={() => onCreated({ id: 'box-new' })}>模拟创建</button>
      <button type="button" onClick={() => onBusyChange?.(true)}>开始忙碌</button>
      <button type="button" onClick={() => onBusyChange?.(false)}>结束忙碌</button>
      <button type="button" onClick={onDone}>完成测试创建</button>
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
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  }
}

function primaryLinkNames() {
  return screen.getAllByRole('link', { name: /^打开/ }).map((link) => link.getAttribute('aria-label'))
}

beforeEach(() => {
  mockDeleteBox.mockReset()
  mockListBoxes.mockReset()
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

test('sorts rendered card links by items and name', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?sort=items')

  await screen.findByRole('link', { name: '打开冬季衣物' })
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

test('opens from the primary action and refreshes the list after creation', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const createButton = screen.getByRole('button', { name: '创建箱子' })
  expect(createButton).toHaveClass('min-h-11', 'bg-brand')
  expect(within(createButton).getByText('新建')).toHaveClass('sm:hidden')
  expect(within(createButton).getByText('创建箱子')).toHaveClass('hidden', 'sm:inline')
  await user.click(createButton)
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('PUSH')
  await user.click(screen.getByRole('button', { name: '模拟创建' }))
  await user.click(screen.getByRole('button', { name: '完成测试创建' }))

  await waitFor(() => expect(mockListBoxes).toHaveBeenCalledTimes(3))
  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
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

test('deletes a box from its menu after confirmation and refreshes the list', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValueOnce([boxes[0]]).mockResolvedValueOnce([])
  mockDeleteBox.mockResolvedValue(undefined)
  renderBoxes()

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toHaveAttribute('href', '/b/public-1')
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('link', { name: '编辑冬季衣物' })).toHaveAttribute('href', '/app/boxes/box-1/edit')
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(screen.queryByRole('link', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteBox).toHaveBeenCalledWith('box-1')
  expect(await screen.findByText('还没有箱子')).toBeInTheDocument()
  expect(mockListBoxes).toHaveBeenCalledTimes(2)
})

test('keeps loading, retryable error, and delete error states', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce(boxes)
  mockDeleteBox.mockRejectedValue(new Error('delete failed'))
  renderBoxes()

  expect(await screen.findByRole('alert')).toHaveTextContent('箱子加载失败，请重试')
  await user.click(screen.getByRole('button', { name: '重试' }))
  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('删除失败，请稍后重试')
})
