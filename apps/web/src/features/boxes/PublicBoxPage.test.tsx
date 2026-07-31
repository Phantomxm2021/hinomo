import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from '../auth/AuthProvider'
import { PublicBoxPage } from './PublicBoxPage'

const { mockGetBoxByPublicId, mockCreateItem, mockDeleteItem, mockMatchMedia, mockUpdateItem } = vi.hoisted(() => ({
  mockGetBoxByPublicId: vi.fn(),
  mockCreateItem: vi.fn(),
  mockDeleteItem: vi.fn(),
  mockMatchMedia: vi.fn(),
  mockUpdateItem: vi.fn(),
}))

vi.mock('./boxes.api', () => ({ getBoxByPublicId: mockGetBoxByPublicId }))
vi.mock('../items/items.api', () => ({
  createItem: mockCreateItem,
  updateItem: mockUpdateItem,
  deleteItem: mockDeleteItem,
}))
vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt }: { objectKey: string; alt: string }) => (
    <img src={`signed:${objectKey}`} alt={alt} />
  ),
}))

function renderPublicBox(session: Session | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/b/public-1']}>
      <QueryClientProvider client={client}>
        <AuthProvider session={session}>
          <Routes>
            <Route path="/b/:publicId" element={<PublicBoxPage />} />
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
  mockMatchMedia.mockReset()
  mockMatchMedia.mockReturnValue({ matches: true } as MediaQueryList)
  mockUpdateItem.mockReset()
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
  expect(screen.queryByRole('button', { name: '新增物品' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '编辑箱子' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '编辑羽绒服' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '删除羽绒服' })).not.toBeInTheDocument()
  expect(screen.getByText('BX-00001')).toBeInTheDocument()
  expect(screen.getByText('公开箱子')).toBeInTheDocument()
  expect(screen.getByText(/最近更新/)).toBeInTheDocument()
  expect(screen.getByText('家 · 卧室')).toBeInTheDocument()
  expect(screen.getByText('衣物')).toBeInTheDocument()
  expect(screen.getByText('黑色长款')).toBeInTheDocument()
  expect(screen.getAllByText('2 件')).toHaveLength(2)
  expect(screen.getByText('暂无封面')).toBeInTheDocument()
  expect(screen.getAllByText('暂无图片').length).toBeGreaterThan(0)
  expect(screen.getByText('共 7 件 · 3 种物品')).toBeInTheDocument()
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
  expect(screen.getByRole('link', { name: '编辑箱子' })).toHaveAttribute('href', '/app/boxes/box-1/edit')
  expect(screen.getByRole('button', { name: '打印标签' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '编辑锤子' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除锤子' })).toBeInTheDocument()
  expect(screen.getByText('BX-00001')).toBeInTheDocument()
  expect(screen.getByText('私密箱子')).toBeInTheDocument()
  expect(screen.getByText(/最近更新/)).toBeInTheDocument()
  expect(screen.getByText('车库 · 未填写位置')).toBeInTheDocument()
  expect(screen.getByText('暂无封面')).toBeInTheDocument()
  const mobileAdd = screen.getByRole('button', { name: '移动端新增物品' })
  expect(mobileAdd).toHaveClass(
    'fixed',
    'inset-x-5',
    'bottom-[calc(6.75rem+env(safe-area-inset-bottom))]',
  )
})

test('restores focus to a programmatically activated delete trigger on Escape', async () => {
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z',
    items: [{ id: 'i1', name: '锤子', category: null, quantity: 1, description: null }],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  const deleteButton = await screen.findByRole('button', { name: '删除锤子' })
  fireEvent.click(deleteButton)
  fireEvent.keyDown(document, { key: 'Escape' })

  await waitFor(() => expect(deleteButton).toHaveFocus())
})

test.each([
  { matches: true, targetName: '新增物品', viewport: 'desktop' },
  { matches: false, targetName: '移动端新增物品', viewport: 'mobile' },
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

  await user.click(await screen.findByRole('button', { name: '删除锤子' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteItem).toHaveBeenCalledWith('i1')
  expect(await screen.findByText('箱子里还没有物品')).toBeInTheDocument()
  expect(mockMatchMedia).toHaveBeenCalledWith('(min-width: 48rem)')
  expect(screen.getByRole('button', { name: targetName })).toHaveFocus()
})

test('hides the mobile add action while the item form is open', async () => {
  const user = userEvent.setup()
  mockGetBoxByPublicId.mockResolvedValue({
    id: 'box-1', owner_id: 'owner-1', public_id: 'public-1', box_code: 'BX-00001',
    space_id: 'space-1', name: '工具', category: null, description: null,
    location: null, visibility: 'private', space_name: '车库',
    updated_at: '2026-07-29T10:00:00Z', items: [],
  })
  renderPublicBox({ user: { id: 'owner-1' } } as Session)

  await user.click(await screen.findByRole('button', { name: '移动端新增物品' }))
  expect(screen.getByRole('heading', { name: '新增物品' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '移动端新增物品' })).not.toBeInTheDocument()
})

test('shows a neutral gate for a private or missing box', async () => {
  mockGetBoxByPublicId.mockResolvedValue(null)
  renderPublicBox()

  expect(
    await screen.findByRole('heading', { name: '无权限或内容不存在' }),
  ).toBeInTheDocument()
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

  await user.click(await screen.findByRole('button', { name: '编辑锤子' }))
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

  await user.click(await screen.findByRole('button', { name: '编辑锤子' }))
  expect(screen.getByLabelText('物品名称')).toHaveValue('锤子')
  await user.click(screen.getByRole('button', { name: '编辑扳手' }))
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
