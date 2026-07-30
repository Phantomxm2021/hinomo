import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom'
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
    item_count: 3,
    updated_at: '2026-07-28T10:00:00Z',
  },
]

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="location">{location.search}</output>
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
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockDeleteBox.mockReset()
  mockListBoxes.mockReset()
})

afterEach(cleanup)

test('filters the catalogue from the space query and exposes complete box cards', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1')

  const card = await screen.findByRole('article', { name: '冬季衣物' })
  expect(screen.queryByText('露营用品')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '卧室' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(card).getByRole('img', { name: '冬季衣物封面' })).toBeInTheDocument()
  expect(within(card).getByText('BX-00001')).toBeInTheDocument()
  expect(within(card).getByText('卧室 · 衣柜上层')).toBeInTheDocument()
  expect(within(card).getByText('8 件物品')).toBeInTheDocument()
  expect(within(card).getByText('私有')).toBeInTheDocument()
  expect(within(card).getByRole('link', { name: '查看' })).toHaveAttribute('href', '/b/public-1')
  expect(within(card).getByRole('link', { name: '编辑' })).toHaveAttribute('href', '/app/boxes/box-1/edit')
  expect(within(card).getByRole('button', { name: '删除冬季衣物' })).toBeInTheDocument()
  expect(card.parentElement).toHaveClass('grid-cols-2')
  expect(card.parentElement).not.toHaveClass('min-[420px]:grid-cols-2')
})

test('space chips replace the URL filter and all spaces clears it', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByText('冬季衣物')
  await user.click(screen.getByRole('button', { name: '储藏室' }))

  expect(screen.getByTestId('location')).toHaveTextContent('?space=space-2')
  expect(screen.queryByText('冬季衣物')).not.toBeInTheDocument()
  const card = screen.getByRole('article', { name: '露营用品' })
  expect(within(card).getByRole('img', { name: '箱子封面占位图' })).toBeInTheDocument()
  expect(within(card).getByText('3 件物品')).toBeInTheDocument()
  expect(within(card).getByText('公开')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '全部空间' }))
  expect(screen.getByTestId('location')).toBeEmptyDOMElement()
  expect(screen.getByText('冬季衣物')).toBeInTheDocument()
  expect(screen.getByText('露营用品')).toBeInTheDocument()
})

test('opens creation from the URL and closes it without losing the space filter', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1&create=1')

  expect(await screen.findByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭测试模态' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?space=space-1')
})

test('opens from both list actions and refreshes the list after creation', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByText('冬季衣物')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')
  await user.click(screen.getByRole('button', { name: '模拟创建' }))
  await user.click(screen.getByRole('button', { name: '完成测试创建' }))

  await waitFor(() => expect(mockListBoxes).toHaveBeenCalledTimes(3))
  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
})

test('lets browser back close a modal opened from the list', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByText('冬季衣物')
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

  await screen.findByText('冬季衣物')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  await user.click(screen.getByRole('button', { name: '开始忙碌' }))
  await user.click(screen.getByRole('button', { name: '后退测试' }))

  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')

  await user.click(screen.getByRole('button', { name: '结束忙碌' }))
  await user.click(screen.getByRole('button', { name: '后退测试' }))
  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
})

test('deletes a box after confirmation', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValueOnce([boxes[0]]).mockResolvedValueOnce([])
  mockDeleteBox.mockResolvedValue(undefined)
  renderBoxes()

  expect(await screen.findByText('BX-00001')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteBox).toHaveBeenCalledWith('box-1')
  expect(await screen.findByText('还没有箱子')).toBeInTheDocument()
})
