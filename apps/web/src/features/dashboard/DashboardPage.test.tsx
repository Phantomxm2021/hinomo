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

test('summarizes storage and shows the three most recent boxes', async () => {
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '家', description: null, box_count: 2 },
    { id: 's2', name: '办公室', description: null, box_count: 1 },
  ])
  mockListBoxes.mockResolvedValue([
    { id: 'b1', public_id: 'p1', box_code: 'BX-00001', name: '冬季衣物', location: '衣柜', visibility: 'public', space_name: '家' },
    { id: 'b2', public_id: 'p2', box_code: 'BX-00002', name: '文件', location: null, visibility: 'private', space_name: '办公室' },
    { id: 'b3', public_id: 'p3', box_code: 'BX-00003', name: '工具', location: '车库', visibility: 'private', space_name: '家' },
    { id: 'b4', public_id: 'p4', box_code: 'BX-00004', name: '不应出现', location: null, visibility: 'private', space_name: '家' },
  ])
  renderDashboard()

  expect(await screen.findByRole('heading', { name: '收纳工作台' })).toBeInTheDocument()
  expect(await within(screen.getByLabelText('空间统计')).findByText('2')).toBeInTheDocument()
  expect(await within(screen.getByLabelText('箱子统计')).findByText('4')).toBeInTheDocument()
  expect(screen.getByText('1 个公开 · 3 个私有')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '冬季衣物' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '文件' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '工具' })).toBeInTheDocument()
  expect(screen.queryByText('不应出现')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /^创建箱子$/ })).toHaveAttribute('href', '/app/boxes/new')
  expect(screen.getByRole('link', { name: /扫码查看/ })).toHaveAttribute('href', '/app/scan')
})

test('guides a first-time user to create a box', async () => {
  mockListSpaces.mockResolvedValue([])
  mockListBoxes.mockResolvedValue([])
  renderDashboard()

  expect(await screen.findByRole('link', { name: '创建第一个箱子' })).toHaveAttribute(
    'href',
    '/app/boxes/new',
  )
})

test('keeps shortcuts available when summary loading fails', async () => {
  mockListSpaces.mockRejectedValue(new Error('offline'))
  mockListBoxes.mockResolvedValue([])
  renderDashboard()

  expect(await screen.findByRole('alert')).toHaveTextContent('部分数据加载失败')
  expect(screen.getByRole('link', { name: /搜索物品/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /批量打印/ })).toBeInTheDocument()
})
