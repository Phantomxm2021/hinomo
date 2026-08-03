import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from '../auth/AuthProvider'
import { PublicBoxPage } from './PublicBoxPage'

const { mockGetBoxByPublicId, mockCreateItem, mockDeleteItem, mockListBoxes, mockListItemMovements, mockMatchMedia, mockMoveItem, mockReturnItem, mockTakeOutItem, mockUpdateItem, mockGetCreditSummary } = vi.hoisted(() => ({
  mockGetBoxByPublicId: vi.fn(),
  mockCreateItem: vi.fn(),
  mockDeleteItem: vi.fn(),
  mockListBoxes: vi.fn(),
  mockListItemMovements: vi.fn(),
  mockMatchMedia: vi.fn(),
  mockMoveItem: vi.fn(),
  mockReturnItem: vi.fn(),
  mockTakeOutItem: vi.fn(),
  mockUpdateItem: vi.fn(),
  mockGetCreditSummary: vi.fn(),
}))

vi.mock('./boxes.api', () => ({ getBoxByPublicId: mockGetBoxByPublicId, listBoxes: mockListBoxes }))
vi.mock('../items/items.api', () => ({
  createItem: mockCreateItem,
  updateItem: mockUpdateItem,
  deleteItem: mockDeleteItem,
}))
vi.mock('../item-movements/item-movements.api', () => ({
  listItemMovements: mockListItemMovements,
  moveItem: mockMoveItem,
  returnItem: mockReturnItem,
  takeOutItem: mockTakeOutItem,
}))
vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt }: { objectKey: string; alt: string }) => (
    <img src={`signed:${objectKey}`} alt={alt} />
  ),
}))
vi.mock('../packing/PackingCapturePage', () => ({
  PackingCaptureSheet: ({ onClose }: { onClose: () => void }) => (
    <section role="dialog" aria-label="AI 装箱"><button type="button" onClick={onClose}>关闭 AI 装箱</button></section>
  ),
}))
vi.mock('../credits/credits.api', () => ({ getCreditSummary: mockGetCreditSummary }))

function renderPublicBox(
  session: Session | null = null,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  entry = '/b/public-1',
) {
  return render(
    <MemoryRouter initialEntries={['/previous', entry]}>
      <QueryClientProvider client={client}>
        <AuthProvider session={session}>
          <Routes>
            <Route path="/b/:publicId" element={<PublicBoxPage />} />
            <Route path="/previous" element={<h1>上一页</h1>} />
            <Route path="/app/scan" element={<h1>扫码查看</h1>} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockGetBoxByPublicId.mockReset()
  mockCreateItem.mockReset()
  mockDeleteItem.mockReset()
  mockListBoxes.mockReset()
  mockListBoxes.mockResolvedValue([])
  mockListItemMovements.mockReset()
  mockListItemMovements.mockResolvedValue([])
  mockMatchMedia.mockReset()
  mockMatchMedia.mockReturnValue({ matches: true } as MediaQueryList)
  mockUpdateItem.mockReset()
  mockMoveItem.mockReset()
  mockReturnItem.mockReset()
  mockTakeOutItem.mockReset()
  mockGetCreditSummary.mockReset().mockResolvedValue({ credits_available: 100, credits_reserved: 0 })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: mockMatchMedia,
  })
})
afterEach(cleanup)

test('shows a structured skeleton while the public box is loading', () => {
  mockGetBoxByPublicId.mockReturnValue(new Promise(() => undefined))
  renderPublicBox()

  expect(screen.getByRole('status', { name: '正在加载箱子' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(2)
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
  expect(screen.getByTestId('box-summary-skeleton')).toHaveClass(
    'border-0',
    'bg-transparent',
    'lg:border',
    'lg:bg-surface',
  )
})

test('shows the initial public-box error in the global responsive alert layer', async () => {
  mockGetBoxByPublicId.mockRejectedValue(new Error('network'))
  renderPublicBox()

  const alert = await screen.findByRole('alert')
  expect(alert.closest('main')).toBeNull()
  expect(alert.parentElement).toHaveClass('fixed', 'inset-0')
  expect(alert).toHaveTextContent('箱子加载失败，请检查网络后重试')
})

test('keeps cached public-box details visible when a refetch fails', async () => {
  const user = userEvent.setup()
  const cachedBox = {
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '缓存工具箱', category: null, description: null,
    location: null, visibility: 'public', space_name: '车库', cover_object_key: null,
    updated_at: '2026-07-29T10:00:00Z', items: [],
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['box', 'public-1'], cachedBox)
  mockGetBoxByPublicId.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(new Promise(() => undefined))
  renderPublicBox(null, client)

  expect(await screen.findByRole('heading', { name: '缓存工具箱' })).toBeInTheDocument()
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('箱子刷新失败，正在显示上次内容')
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  const retrying = within(alert).getByRole('button', { name: '重试中…' })
  expect(retrying).toBeDisabled()
  expect(retrying).toHaveAttribute('aria-busy', 'true')
  await user.click(retrying)
  expect(mockGetBoxByPublicId).toHaveBeenCalledTimes(2)
})

test('renders a public box for an anonymous visitor without edit controls', async () => {
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1',
    owner_id: 'owner-1',
    public_id: 'public-1',
    box_code: 'BX-00001',
    name: '冬季衣物',
    description: null,
    location: '卧室',
    visibility: 'public',
    venue_name: '家里',
    space_name: '家',
    updated_at: '2026-07-29T10:00:00Z',
    items: [
      { id: 'i1', name: '羽绒服', category: '衣物', quantity: 2, description: '黑色长款' },
      { id: 'i2', name: '围巾', category: null, quantity: 3, description: null },
      { id: 'i3', name: '手套', category: null, quantity: 2, description: null },
    ],
  })
  renderPublicBox()

  expect(await screen.findByRole('heading', { name: '冬季衣物' })).toBeInTheDocument()
  const navigation = screen.getByRole('navigation', { name: '箱子详情导航' })
  expect(within(navigation).getByRole('button', { name: '返回' })).toBeInTheDocument()
  expect(within(navigation).getByText('冬季衣物 · 箱子详情')).toBeInTheDocument()
  expect(within(navigation).queryByRole('link', { name: '编辑箱子' })).not.toBeInTheDocument()
  expect(within(navigation).queryByRole('button', { name: '打印标签' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '新增物品' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '编辑箱子' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '编辑羽绒服' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '删除羽绒服' })).not.toBeInTheDocument()
  expect(screen.getByText('BX-00001')).toBeInTheDocument()
  expect(screen.getByText('公开箱子')).toBeInTheDocument()
  expect(screen.getByText(/最近更新/)).toBeInTheDocument()
  expect(screen.getByText('家里 · 家 · 卧室')).toBeInTheDocument()
  expect(screen.getByText('衣物')).toBeInTheDocument()
  expect(screen.getByText('黑色长款')).toBeInTheDocument()
  expect(screen.getAllByText('2 件')).toHaveLength(2)
  expect(screen.getByText('暂无封面')).toBeInTheDocument()
  expect(screen.getAllByText('暂无图片').length).toBeGreaterThan(0)
  expect(screen.getByText('共 7 件 · 3 种物品')).toBeInTheDocument()
  expect(screen.getByTestId('box-summary')).toHaveClass(
    'border-0',
    'bg-transparent',
    'lg:border',
    'lg:bg-surface',
  )
  expect(screen.getByTestId('box-item-list')).toHaveClass(
    'overflow-hidden',
    'bg-surface',
    'lg:contents',
  )
  expect(screen.getByTestId('box-detail-facts')).toHaveClass('hidden', 'lg:contents')
  expect(screen.getByTestId('box-cover')).toHaveClass('hidden', 'lg:block')
  expect(screen.getByTestId('box-summary')).toHaveClass('hidden', 'lg:grid')
})

test('shows item controls only to the box owner', async () => {
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    items: [{ id: 'i1', name: '锤子', category: null, quantity: 1, description: null }],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  expect(await screen.findByRole('button', { name: '新增物品' })).toBeInTheDocument()
  const navigation = screen.getByRole('navigation', { name: '箱子详情导航' })
  expect(within(navigation).getByRole('button', { name: '返回' })).toBeInTheDocument()
  expect(within(navigation).getByText('工具 · 箱子详情')).toBeInTheDocument()
  expect(within(navigation).getByRole('button', { name: '打开箱子操作菜单' })).toBeInTheDocument()
  const desktopActions = screen.getByTestId('desktop-box-actions')
  expect(desktopActions).toHaveClass('hidden', 'lg:flex')
  expect(within(desktopActions).getByRole('link', { name: '编辑箱子' })).toHaveAttribute('href', '/app/boxes/box-1/edit')
  expect(within(desktopActions).getByRole('button', { name: '打印标签' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '打开锤子操作' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '编辑锤子' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '删除锤子' })).not.toBeInTheDocument()
  expect(screen.getByText('BX-00001')).toBeInTheDocument()
  expect(screen.getByText('私密箱子')).toBeInTheDocument()
  expect(screen.getByText(/最近更新/)).toBeInTheDocument()
  expect(screen.getByText('车库 · 未填写位置')).toBeInTheDocument()
  expect(screen.getByText('暂无封面')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '移动端新增物品' })).not.toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveClass(
    'pb-[calc(6rem+var(--safe-area-bottom))]',
    'lg:pb-10',
  )
})

test('opens the mobile plus menu with the owner box actions', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z', items: [],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  await user.click(await screen.findByRole('button', { name: '打开箱子操作菜单' }))
  const menu = screen.getByRole('dialog', { name: '箱子操作' })
  expect(within(menu).getByRole('button', { name: 'AI 装箱' })).toBeInTheDocument()
  expect(within(menu).getByRole('button', { name: '新增物品' })).toBeInTheDocument()
  expect(within(menu).getByRole('button', { name: '编辑箱子' })).toBeInTheDocument()
  expect(within(menu).getByRole('button', { name: '打印标签' })).toBeInTheDocument()
})

test('opens AI packing as a sheet while keeping the box route visible', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z', items: [],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  const desktopActions = await screen.findByTestId('desktop-box-actions')
  await user.click(within(desktopActions).getByRole('button', { name: 'AI 装箱' }))

  expect(screen.getByRole('dialog', { name: 'AI 装箱' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '工具' })).toBeInTheDocument()
})

test('keeps AI packing behind a native credit sheet when balance is empty', async () => {
  mockGetCreditSummary.mockResolvedValue({ credits_available: 0, credits_reserved: 0 })
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', public_id: 'public-1', owner_id: 'owner-1', box_code: 'BX-00001',
    name: '冬季用品', visibility: 'private', items: [], updated_at: '2026-08-03T00:00:00Z',
    venue_name: '家', space_name: '储物间', location: null, description: null,
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)
  const user = userEvent.setup()

  await user.click(await screen.findByRole('button', { name: '拍照识别物品' }))

  expect(screen.getByRole('alertdialog', { name: '需要更多识别额度' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'AI 装箱' })).not.toBeInTheDocument()
})

test('continues directly into AI capture from a desktop handoff QR', async () => {
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z', items: [],
  })
  renderPublicBox(
    { user: { id: 'owner-1' } } as Session,
    new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    '/b/public-1?capture=1',
  )

  expect(await screen.findByRole('dialog', { name: 'AI 装箱' })).toBeInTheDocument()
})

test('returns to the previous route from the mobile detail navigation', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'public', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z', items: [],
  })
  renderPublicBox()

  const navigation = await screen.findByRole('navigation', { name: '箱子详情导航' })
  await user.click(within(navigation).getByRole('button', { name: '返回' }))

  expect(await screen.findByRole('heading', { name: '上一页' })).toBeInTheDocument()
})

test('restores focus to the item row when deletion is cancelled', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    items: [{ id: 'i1', name: '锤子', category: null, quantity: 1, description: null }],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  const itemRow = await screen.findByRole('button', { name: '打开锤子操作' })
  await user.click(itemRow)
  await user.click(screen.getByRole('button', { name: '编辑物品信息' }))
  await user.click(screen.getByRole('button', { name: '删除物品' }))
  fireEvent.keyDown(document, { key: 'Escape' })

  await waitFor(() => expect(itemRow).toHaveFocus())
})

test.each([
  { matches: true, targetName: '新增物品', viewport: 'desktop' },
  { matches: false, targetName: '打开箱子操作菜单', viewport: 'mobile' },
])('focuses the persistent $viewport add-item action after deleting an item', async ({ matches, targetName }) => {
  const user = userEvent.setup()
  const box = {
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
  }
  mockGetBoxByPublicId
    .mockResolvedValueOnce({
      ...box,
      items: [{ id: 'i1', name: '锤子', category: null, quantity: 1, description: null }],
    })
    .mockResolvedValueOnce({ ...box, items: [] })
  mockDeleteItem.mockResolvedValue(undefined)
  mockMatchMedia.mockReturnValue({ matches } as MediaQueryList)
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  await user.click(await screen.findByRole('button', { name: '打开锤子操作' }))
  await user.click(screen.getByRole('button', { name: '编辑物品信息' }))
  await user.click(screen.getByRole('button', { name: '删除物品' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteItem).toHaveBeenCalledWith('i1')
  expect(await screen.findByText('箱子里还没有物品')).toBeInTheDocument()
  expect(mockMatchMedia).toHaveBeenCalledWith('(min-width: 48rem)')
  expect(screen.getByRole('button', { name: targetName })).toHaveFocus()
})

test('opens the item form from the mobile action menu', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z', items: [],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  const emptyTitle = await screen.findByRole('heading', { name: '箱子里还没有物品' })
  const emptyState = emptyTitle.closest('[data-page-state="empty"]')
  expect(emptyState).not.toHaveClass('border', 'border-dashed', 'bg-surface/70')
  await user.click(await screen.findByRole('button', { name: '打开箱子操作菜单' }))
  await user.click(within(screen.getByRole('dialog', { name: '箱子操作' })).getByRole('button', { name: '新增物品' }))
  expect(screen.getByRole('heading', { name: '新增物品' })).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: '新增物品' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '打开箱子操作菜单' })).toBeInTheDocument()
})

test('offers direct AI and manual next steps for an owner empty box', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z', items: [],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  expect(await screen.findByText('拍下箱内物品让 AI 帮你整理，或从第一件物品开始手动记录。')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '拍照识别物品' }))
  expect(screen.getByRole('dialog', { name: 'AI 装箱' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭 AI 装箱' }))

  await user.click(screen.getByRole('button', { name: '手动记录' }))
  expect(screen.getByRole('dialog', { name: '新增物品' })).toBeInTheDocument()
})

test('opens the same item operations from the list row at every breakpoint', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    items: [{ id: 'i1', name: '锤子', category: '工具', quantity: 2, description: '金属手柄' }],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  const row = await screen.findByRole('button', { name: '打开锤子操作' })
  expect(row).toHaveClass('w-full', 'lg:grid-cols-[7rem_minmax(0,1fr)_auto]')
  expect(row).toHaveTextContent('金属手柄')
  expect(row).toHaveTextContent('2')
  await user.click(row)

  expect(screen.getByRole('dialog', { name: '锤子' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '编辑物品信息' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '编辑物品' })).not.toBeInTheDocument()
})

test('takes out an item from the owner movement sheet', async () => {
  const user = userEvent.setup()
  mockTakeOutItem.mockResolvedValue({ item_id: 'i1', box_id: 'box-1', quantity: 2, stored_quantity: 1 })
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    items: [{ id: 'i1', name: '锤子', category: '工具', quantity: 2, stored_quantity: 2, description: null }],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  await user.click(await screen.findByRole('button', { name: '打开锤子操作' }))
  expect(screen.getByRole('dialog', { name: '锤子' })).toHaveTextContent('在位 · 2/2')
  await user.click(screen.getByRole('button', { name: /^取出/ }))
  await user.click(screen.getByRole('button', { name: '确认取出' }))

  await waitFor(() => expect(mockTakeOutItem).toHaveBeenCalledWith({
    itemId: 'i1', quantity: 1, handlerLabel: null, note: null,
  }))
})

test('returns to the scanner when a scanned box is private or missing', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue(null)
  renderPublicBox()

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('箱子不存在或无法访问')
  await user.click(within(alert).getByRole('button', { name: '重新扫码' }))

  expect(await screen.findByRole('heading', { name: '扫码查看' })).toBeInTheDocument()
  expect(mockGetBoxByPublicId).toHaveBeenCalledOnce()
})

test('renders authorized cover and item images when object keys exist', async () => {
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'public', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    cover_object_key: 'boxes/box-1/cover.webp',
    items: [{
      id: 'i1', name: '锤子', category: null, quantity: 1, description: null,
      image_object_key: 'boxes/box-1/items/i1.webp',
    }],
  })
  renderPublicBox()

  expect(await screen.findByRole('img', { name: '工具封面' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '锤子图片' })).toBeInTheDocument()
})

test('clears the edited item when switching from edit to new', async () => {
  const user = userEvent.setup()
  mockCreateItem.mockResolvedValue({ id: 'new-item' })
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    items: [
      { id: 'i1', name: '锤子', category: '工具', quantity: 1, description: '旧物品' },
      { id: 'i2', name: '扳手', category: '工具', quantity: 2, description: null },
    ],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  await user.click(await screen.findByRole('button', { name: '打开锤子操作' }))
  await user.click(screen.getByRole('button', { name: '编辑物品信息' }))
  expect(screen.getByLabelText('物品名称')).toHaveValue('锤子')
  await user.click(screen.getByRole('button', { name: '新增物品' }))
  expect(screen.getByLabelText('物品名称')).toHaveValue('')

  await user.type(screen.getByLabelText('物品名称'), '螺丝刀')
  await user.click(screen.getByRole('button', { name: '保存' }))
  expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({ name: '螺丝刀' }))
  expect(mockUpdateItem).not.toHaveBeenCalled()
})

test('resets form values when switching directly between edited items', async () => {
  const user = userEvent.setup()
  mockUpdateItem.mockResolvedValue(undefined)
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    items: [
      { id: 'i1', name: '锤子', category: '工具', quantity: 1, description: '旧物品' },
      { id: 'i2', name: '扳手', category: '维修', quantity: 2, description: '新目标' },
    ],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  await user.click(await screen.findByRole('button', { name: '打开锤子操作' }))
  await user.click(screen.getByRole('button', { name: '编辑物品信息' }))
  expect(screen.getByLabelText('物品名称')).toHaveValue('锤子')
  await user.click(screen.getByRole('button', { name: '取消' }))
  await user.click(screen.getByRole('button', { name: '打开扳手操作' }))
  await user.click(screen.getByRole('button', { name: '编辑物品信息' }))
  expect(screen.getByLabelText('物品名称')).toHaveValue('扳手')
  expect(screen.getByLabelText('数量')).toHaveValue(2)

  await user.click(screen.getByRole('button', { name: '保存' }))
  expect(mockUpdateItem).toHaveBeenCalledWith('i2', expect.objectContaining({
    name: '扳手',
    category: '维修',
    quantity: 2,
    description: '新目标',
  }))
  expect(mockCreateItem).not.toHaveBeenCalled()
})
