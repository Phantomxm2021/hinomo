import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

const { mockListBoxes, mockListSpaces, mockListVenues } = vi.hoisted(() => ({
  mockListBoxes: vi.fn(),
  mockListSpaces: vi.fn(),
  mockListVenues: vi.fn(),
}))

vi.mock('../boxes/boxes.api', () => ({ listBoxes: mockListBoxes }))
vi.mock('../spaces/spaces.api', () => ({ listSpaces: mockListSpaces }))
vi.mock('../venues/venues.api', () => ({ listVenues: mockListVenues }))
vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt, className }: { objectKey: string; alt: string; className?: string }) => (
    <span><img src={`signed:${objectKey}`} alt={alt} className={className} /><button type="button" aria-label={`重试${alt}`}>重试</button></span>
  ),
}))

beforeEach(() => {
  mockListBoxes.mockReset()
  mockListSpaces.mockReset()
  mockListVenues.mockReset()
  mockListVenues.mockResolvedValue([
    { id: 'venue-home', name: '默认', description: null, is_default: true, space_count: 2 },
  ])
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
    { id: 'home / 1', venue_id: 'venue-home', venue_name: '默认', name: '客厅', description: null, box_count: 2, item_count: 5 },
    { id: 's2', venue_id: 'venue-home', venue_name: '默认', name: '卧室', description: null, box_count: 1, item_count: 4 },
  ])
  mockListBoxes.mockResolvedValue([
    { id: 'b1', public_id: 'p1', box_code: 'BX-00001', name: '冬季衣物', space_id: 'home / 1', location: '衣柜', visibility: 'public', space_name: '客厅', cover_object_key: 'covers/winter.webp', item_count: 5, updated_at: '2026-07-03' },
    { id: 'b2', public_id: 'p2', box_code: 'BX-00002', name: '文件', space_id: 's2', location: null, visibility: 'private', space_name: '卧室', cover_object_key: null, item_count: 4, updated_at: '2026-07-02' },
    { id: 'b3', public_id: 'p3', box_code: 'BX-00003', name: '工具', space_id: 'home / 1', location: '车库', visibility: 'private', space_name: '客厅', cover_object_key: null, item_count: 0, updated_at: '2026-07-01' },
    { id: 'b4', public_id: 'p4', box_code: 'BX-00004', name: '不应出现', space_id: 'home / 1', location: null, visibility: 'private', space_name: '客厅', cover_object_key: null, item_count: 8, updated_at: '2026-06-30' },
  ])
  renderDashboard()

  const displayTitle = await screen.findByRole('heading', { name: /今天找什么？/ })
  expect(displayTitle).toHaveClass('text-display', 'font-extrabold')
  expect(screen.getByText('空间总览')).toHaveClass(
    'text-meta',
    'font-medium',
    'tracking-eyebrow',
    'text-muted',
  )
  expect(screen.getByText('空间总览')).not.toHaveClass('text-brand', 'uppercase')
  const venueSelect = await screen.findByRole('combobox', { name: '选择场地' })
  expect(venueSelect).toHaveClass('appearance-none', 'border-0', 'bg-transparent', 'text-meta', 'font-medium', 'tracking-eyebrow', 'text-muted')
  expect(venueSelect).not.toHaveClass('border-line', 'bg-surface', 'text-body', 'text-ink')
  expect(screen.getByText('空间总览').parentElement).toContainElement(
    venueSelect,
  )
  expect(screen.getByText('空间总览').parentElement).toHaveClass(
    'col-span-2', 'grid', 'grid-cols-[minmax(0,1fr)_auto]',
  )
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toBeInTheDocument()
  expect(screen.queryByText('空间分布')).not.toBeInTheDocument()
  expect(screen.queryByText('最近活动')).not.toBeInTheDocument()

  expect(within(await screen.findByLabelText('空间统计')).getByText('2')).toBeInTheDocument()
  expect(within(await screen.findByLabelText('箱子统计')).getByText('4')).toBeInTheDocument()
  expect(within(await screen.findByLabelText('物品统计')).getByText('17')).toBeInTheDocument()
  expect(within(screen.getByLabelText('空间统计')).getByText('客厅、卧室、书房...')).toBeInTheDocument()
  expect(within(screen.getByLabelText('箱子统计')).getByText('3 个最近更新')).toBeInTheDocument()
  expect(within(screen.getByLabelText('物品统计')).getByText('跨箱子快速搜索')).toBeInTheDocument()
  expect(within(screen.getByLabelText('空间统计')).getByText('2')).toHaveClass('text-metric')
  expect(screen.queryByText(/公开|私有/)).not.toBeInTheDocument()

  const rooms = screen.getByRole('region', { name: '按空间查看' })
  expect(within(rooms).getByRole('heading', { name: '按空间查看' })).toHaveClass(
    'text-section-title',
    'font-bold',
  )
  expect(within(rooms).getByRole('link', { name: '管理空间' })).toHaveAttribute(
    'href',
    '/app/spaces',
  )
  expect(within(rooms).getByRole('link', { name: /客厅/ })).toHaveAttribute(
    'href',
    '/app/boxes?space=home%20%2F%201',
  )
  expect(within(rooms).getByText('2 个箱子')).toBeInTheDocument()
  expect(within(rooms).getByText('1 个箱子')).toBeInTheDocument()

  const recent = screen.getByRole('region', { name: '最近打开' })
  expect(within(recent).getByRole('img', { name: '冬季衣物封面' })).toHaveAttribute(
    'src',
    'signed:covers/winter.webp',
  )
  expect(within(recent).getByRole('img', { name: '文件封面占位图' })).toBeInTheDocument()
  expect(within(recent).getByRole('link', { name: /冬季衣物/ })).toHaveAttribute('href', '/b/p1')
  expect(within(recent).getByRole('button', { name: '重试冬季衣物封面' }).closest('a')).toBeNull()
  expect(within(recent).getByText('客厅 · 衣柜')).toBeInTheDocument()
  expect(within(recent).getByText('卧室 · 未填写位置')).toBeInTheDocument()
  expect(within(recent).queryByText('BX-00001')).not.toBeInTheDocument()
  expect(within(recent).queryByText('5 件物品')).not.toBeInTheDocument()
  expect(within(recent).queryByText('不应出现')).not.toBeInTheDocument()

  expect(screen.queryByText('快捷开始')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: '扫码查看' })).toHaveLength(1)
  expect(screen.getByRole('link', { name: '扫码查看' })).toHaveClass('scan-icon-button')
  expect(screen.queryByText('生成新的收纳二维码')).not.toBeInTheDocument()

  expect(screen.getByRole('region', { name: '早上好，今天找什么？' })).toHaveClass(
    'mx-auto',
    'min-w-0',
    'w-full',
    'max-w-7xl',
    'gap-6',
    'lg:gap-10',
  )
  expect(screen.getByRole('region', { name: '早上好，今天找什么？' }).querySelector('header')).toHaveClass(
    'lg:grid',
    'lg:grid-cols-[minmax(0,1fr)_minmax(26rem,auto)]',
  )
  expect(screen.getByLabelText('收纳概览')).toHaveClass('sm:grid-cols-3')
  expect(screen.getByLabelText('收纳概览')).toHaveClass('hidden', 'lg:grid')
  expect(screen.getByRole('region', { name: '按空间查看' }).querySelector('div.grid')).toHaveClass(
    'sm:grid-cols-2',
    'xl:grid-cols-4',
  )
  expect(within(rooms).getByRole('img', { name: '客厅图标' })).toHaveTextContent('🛋️')
  expect(within(rooms).getByRole('img', { name: '卧室图标' })).toHaveTextContent('🛏️')
  const placeholder = within(recent).getByRole('img', { name: '文件封面占位图' })
  expect(placeholder).toHaveClass('aspect-[3.5/1]', 'bg-[#788790]')
  expect(placeholder).toHaveTextContent('📦')
  expect(screen.getByRole('region', { name: '最近打开' }).querySelector('div.grid')).toHaveClass(
    'md:grid-cols-2',
    'xl:grid-cols-3',
  )
})

test('shows a structural dashboard skeleton while initial data is pending', () => {
  mockListVenues.mockReturnValue(new Promise(() => undefined))
  mockListSpaces.mockReturnValue(new Promise(() => undefined))
  mockListBoxes.mockReturnValue(new Promise(() => undefined))
  renderDashboard()

  const loading = screen.getByRole('status', { name: '正在加载空间总览' })
  expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThan(6)
  expect(screen.queryByText('正在加载空间…')).not.toBeInTheDocument()
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
})

test('shows a plain empty state when the selected venue has no spaces', async () => {
  mockListSpaces.mockResolvedValue([])
  mockListBoxes.mockResolvedValue([])
  renderDashboard()

  expect(await screen.findByRole('heading', { name: '这个场地还没有空间' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '创建第一个箱子' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '最近打开' })).not.toBeInTheDocument()
})

test('keeps finding available when dashboard data fails', async () => {
  mockListVenues.mockRejectedValue(new Error('offline'))
  mockListSpaces.mockRejectedValue(new Error('offline'))
  mockListBoxes.mockRejectedValue(new Error('offline'))
  renderDashboard()

  expect(await screen.findByRole('alert')).toHaveTextContent('部分数据加载失败')
  expect(screen.getByRole('searchbox', { name: '搜索物品或箱子' })).toBeInTheDocument()
  expect(screen.queryByText('快捷开始')).not.toBeInTheDocument()
})

test('defaults to the first venue and filters every dashboard section when venue changes', async () => {
  mockListVenues.mockResolvedValue([
    { id: 'venue-default', name: '默认', description: null, is_default: true, space_count: 1 },
    { id: 'venue-office', name: '公司', description: null, is_default: false, space_count: 1 },
  ])
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', venue_id: 'venue-default', venue_name: '默认', name: '客厅', description: null, box_count: 1, item_count: 2 },
    { id: 'space-office', venue_id: 'venue-office', venue_name: '公司', name: '档案室', description: null, box_count: 1, item_count: 7 },
  ])
  mockListBoxes.mockResolvedValue([
    { id: 'box-home', public_id: 'home', box_code: 'BX-HOME', name: '家庭用品', space_id: 'space-home', location: null, visibility: 'private', space_name: '客厅', venue_name: '默认', cover_object_key: null, item_count: 2, updated_at: '2026-08-01' },
    { id: 'box-office', public_id: 'office', box_code: 'BX-OFFICE', name: '公司档案', space_id: 'space-office', location: null, visibility: 'private', space_name: '档案室', venue_name: '公司', cover_object_key: null, item_count: 7, updated_at: '2026-08-01' },
  ])
  renderDashboard()

  const venueSelect = await screen.findByRole('combobox', { name: '选择场地' })
  expect(venueSelect).toHaveValue('venue-default')
  expect(screen.getByText('家庭用品')).toBeInTheDocument()
  expect(screen.queryByText('公司档案')).not.toBeInTheDocument()
  expect(within(screen.getByLabelText('物品统计')).getByText('2')).toBeInTheDocument()

  fireEvent.change(venueSelect, { target: { value: 'venue-office' } })

  expect(screen.getByText('公司档案')).toBeInTheDocument()
  expect(screen.queryByText('家庭用品')).not.toBeInTheDocument()
  expect(screen.getByText('档案室')).toBeInTheDocument()
  expect(screen.queryByText('客厅')).not.toBeInTheDocument()
  expect(within(screen.getByLabelText('物品统计')).getByText('7')).toBeInTheDocument()
})
