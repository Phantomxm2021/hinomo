import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { VenuesPage } from './VenuesPage'

const { mockListVenues, mockCreateVenue, mockUpdateVenue, mockDeleteVenue } = vi.hoisted(() => ({
  mockListVenues: vi.fn(),
  mockCreateVenue: vi.fn(),
  mockUpdateVenue: vi.fn(),
  mockDeleteVenue: vi.fn(),
}))

vi.mock('./venues.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venues.api')>()),
  listVenues: mockListVenues,
  createVenue: mockCreateVenue,
  updateVenue: mockUpdateVenue,
  deleteVenue: mockDeleteVenue,
}))

beforeEach(() => {
  mockListVenues.mockReset()
  mockCreateVenue.mockReset()
  mockUpdateVenue.mockReset()
  mockDeleteVenue.mockReset()
  mockListVenues.mockResolvedValue([
    { id: 'home', name: '家里', description: '常住地址', is_default: true, space_count: 3, role: 'owner', owner_display_name: null, owner_id: 'owner', member_count: 1, max_members: 5 },
    { id: 'office', name: '公司', description: null, is_default: false, space_count: 1, role: 'member', owner_display_name: '王小明', owner_id: 'owner', member_count: 2, max_members: 5 },
  ])
})

afterEach(cleanup)

test('lists venues and opens creation and editing from the dedicated page', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}><VenuesPage /></QueryClientProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: '场地管理' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '场地管理' }).parentElement).toHaveClass('flex', 'items-center', 'justify-between')
  const navigation = screen.getByRole('navigation', { name: '场地管理导航' })
  expect(within(navigation).getByRole('button', { name: '返回' })).toBeInTheDocument()
  expect(within(navigation).getByText('场地管理')).toHaveClass('text-center', 'font-bold')
  expect(within(navigation).getByRole('button', { name: '创建场地' })).toHaveClass('size-11', 'rounded-full')
  expect(await screen.findByRole('button', { name: '编辑场地家里' })).toHaveTextContent('3 个空间 · 常住地址')
  expect(screen.getByRole('link', { name: '家庭成员公司' })).toHaveTextContent('1 个空间 · 未填写描述')

  await user.click(within(navigation).getByRole('button', { name: '创建场地' }))
  expect(screen.getByRole('dialog', { name: '创建场地' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭场地编辑器' }))

  expect(screen.getByRole('link', { name: '家庭成员公司' })).toHaveAttribute('href', '/app/venues/office/members')
  expect(screen.queryByRole('dialog', { name: '编辑场地' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '编辑场地家里' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '家庭成员家里' })).toHaveAttribute('href', '/app/venues/home/members')
  expect(screen.getByRole('link', { name: '最近活动家里' })).toHaveAttribute('href', '/app/venues/home/activity')
  expect(screen.getByRole('link', { name: '最近活动公司' })).toHaveAttribute('href', '/app/venues/office/activity')
  expect(screen.getByRole('link', { name: '家庭成员公司' })).toHaveTextContent('家庭共享 · 王小明')
})
