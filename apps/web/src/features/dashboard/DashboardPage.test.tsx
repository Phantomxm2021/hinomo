import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const { mockListBoxes, mockListSpaces } = vi.hoisted(() => ({
  mockListBoxes: vi.fn(),
  mockListSpaces: vi.fn(),
}))

vi.mock('../boxes/boxes.api', () => ({ listBoxes: mockListBoxes }))
vi.mock('../spaces/spaces.api', () => ({ listSpaces: mockListSpaces }))
vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt, className }: { objectKey: string; alt: string; className?: string }) => (
    <img src={`signed:${objectKey}`} alt={alt} className={className} />
  ),
}))

beforeEach(() => {
  mockListBoxes.mockReset()
  mockListSpaces.mockReset()
})
afterEach(cleanup)

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>
    </MemoryRouter>,
  )
}

test('centers the dashboard on finding items, room totals, and recent activity', async () => {
  mockListSpaces.mockResolvedValue([
    { id: 'home / 1', name: '家', description: null, box_count: 2, item_count: 5 },
    { id: 's2', name: '办公室', description: null, box_count: 1, item_count: 4 },
  ])
  mockListBoxes.mockResolvedValue([
    { id: 'b1', public_id: 'p1', box_code: 'BX-00001', name: '冬季衣物', location: '衣柜', visibility: 'public', space_name: '家', cover_object_key: 'covers/winter.webp', item_count: 5, updated_at: '2026-07-03' },
    { id: 'b2', public_id: 'p2', box_code: 'BX-00002', name: '文件', location: null, visibility: 'private', space_name: '办公室', cover_object_key: null, item_count: 4, updated_at: '2026-07-02' },
    { id: 'b3', public_id: 'p3', box_code: 'BX-00003', name: '工具', location: '车库', visibility: 'private', space_name: '家', cover_object_key: null, item_count: 0, updated_at: '2026-07-01' },
    { id: 'b4', public_id: 'p4', box_code: 'BX-00004', name: '不应出现', location: null, visibility: 'private', space_name: '家', cover_object_key: null, item_count: 8, updated_at: '2026-06-30' },
  ])
  renderDashboard()

  expect(await screen.findByRole('heading', { name: /今天找什么？/ })).toBeInTheDocument()
  expect(screen.getByText('家庭总览')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toBeInTheDocument()

  expect(await within(screen.getByLabelText('空间统计')).findByText('2')).toBeInTheDocument()
  expect(await within(screen.getByLabelText('箱子统计')).findByText('4')).toBeInTheDocument()
  expect(await within(screen.getByLabelText('物品统计')).findByText('17')).toBeInTheDocument()
  expect(screen.queryByText(/公开|私有/)).not.toBeInTheDocument()

  const rooms = screen.getByRole('region', { name: '按房间查看' })
  expect(within(rooms).getByRole('link', { name: /家/ })).toHaveAttribute(
    'href',
    '/app/boxes?space=home%20%2F%201',
  )
  expect(within(rooms).getByText('2 个箱子 · 5 件物品')).toBeInTheDocument()
  expect(within(rooms).getByText('1 个箱子 · 4 件物品')).toBeInTheDocument()

  const recent = screen.getByRole('region', { name: '最近的箱子' })
  expect(within(recent).getByRole('img', { name: '冬季衣物封面' })).toHaveAttribute(
    'src',
    'signed:covers/winter.webp',
  )
  expect(within(recent).getByRole('img', { name: '文件封面占位图' })).toBeInTheDocument()
  expect(within(recent).getByRole('link', { name: /冬季衣物/ })).toHaveAttribute('href', '/b/p1')
  expect(within(recent).getByText('家 · 衣柜')).toBeInTheDocument()
  expect(within(recent).getByText('办公室 · 未填写位置')).toBeInTheDocument()
  expect(within(recent).getByText('5 件物品')).toBeInTheDocument()
  expect(within(recent).getByText('0 件物品')).toBeInTheDocument()
  expect(within(recent).queryByText('不应出现')).not.toBeInTheDocument()

  expect(screen.queryByText('快捷开始')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: '扫码查看' })).toHaveLength(1)
  expect(screen.getByRole('link', { name: '扫码查看' })).toHaveClass('scan-icon-button')
  expect(screen.queryByText('生成新的收纳二维码')).not.toBeInTheDocument()

  expect(screen.getByLabelText('收纳概览')).toHaveClass('sm:grid-cols-3')
  expect(screen.getByRole('region', { name: '按房间查看' }).querySelector('div.grid')).toHaveClass(
    'sm:grid-cols-2',
    'xl:grid-cols-4',
  )
  expect(screen.getByRole('region', { name: '最近的箱子' }).querySelector('div.grid')).toHaveClass(
    'md:grid-cols-2',
    'xl:grid-cols-3',
  )
})

test('shows loading semantics while dashboard data is pending', () => {
  mockListSpaces.mockReturnValue(new Promise(() => undefined))
  mockListBoxes.mockReturnValue(new Promise(() => undefined))
  renderDashboard()

  expect(screen.getByRole('status', { name: '正在加载空间' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '正在加载箱子' })).toBeInTheDocument()
  expect(within(screen.getByLabelText('物品统计')).getByText('—')).toBeInTheDocument()
})

test('guides a first-time user to create a box', async () => {
  mockListSpaces.mockResolvedValue([])
  mockListBoxes.mockResolvedValue([])
  renderDashboard()

  expect(await screen.findByRole('link', { name: '创建第一个箱子' })).toHaveAttribute(
    'href',
    '/app/boxes/new',
  )
  expect(screen.getByText(/从第一个箱子开始/)).toBeInTheDocument()
})

test('keeps finding available when dashboard data fails', async () => {
  mockListSpaces.mockRejectedValue(new Error('offline'))
  mockListBoxes.mockRejectedValue(new Error('offline'))
  renderDashboard()

  expect(await screen.findByRole('alert')).toHaveTextContent('部分数据加载失败')
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toBeInTheDocument()
  expect(screen.queryByText('快捷开始')).not.toBeInTheDocument()
})
