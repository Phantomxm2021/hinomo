import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { VenuesPage } from './VenuesPage'

const { mockListVenues, mockCreateVenue, mockUpdateVenue, mockDeleteVenue, mockCreateInvite } = vi.hoisted(() => ({
  mockListVenues: vi.fn(),
  mockCreateVenue: vi.fn(),
  mockUpdateVenue: vi.fn(),
  mockDeleteVenue: vi.fn(),
  mockCreateInvite: vi.fn(),
}))

vi.mock('./venues.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venues.api')>()),
  listVenues: mockListVenues,
  createVenue: mockCreateVenue,
  updateVenue: mockUpdateVenue,
  deleteVenue: mockDeleteVenue,
}))

vi.mock('./venue-sharing.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venue-sharing.api')>()),
  createVenueInvite: mockCreateInvite,
}))

beforeEach(() => {
  mockListVenues.mockReset()
  mockCreateVenue.mockReset()
  mockUpdateVenue.mockReset()
  mockDeleteVenue.mockReset()
  mockCreateInvite.mockReset()
  vi.stubEnv('VITE_ENABLE_VENUE_INVITES', 'true')
  mockCreateInvite.mockResolvedValue({ invite_id: 'invite-1', token: 'invite-token', expires_at: '2026-08-10T00:00:00Z' })
  mockListVenues.mockResolvedValue([
    { id: 'home', name: '家里', description: '常住地址', is_default: true, space_count: 3, role: 'owner', owner_display_name: null, owner_id: 'owner', member_count: 1, max_members: 5 },
    { id: 'office', name: '公司', description: null, is_default: false, space_count: 1, role: 'member', owner_display_name: '王小明', owner_id: 'owner', member_count: 2, max_members: 5 },
  ])
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

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
  expect(await screen.findByRole('button', { name: '管理场地家里' })).toBeInTheDocument()
  expect(screen.getByTestId('venue-card-home')).toHaveTextContent('3 个空间 · 常住地址')
  const officeCard = screen.getByTestId('venue-card-office')
  await user.click(within(officeCard).getByRole('button', { name: '管理场地公司' }))
  const officeMenu = screen.getByRole('menu', { name: '公司场地操作' })
  expect(within(officeMenu).getByRole('menuitem', { name: '家庭成员' })).toHaveTextContent('家庭成员')
  expect(officeCard).toHaveTextContent('1 个空间 · 未填写描述')

  await user.click(within(navigation).getByRole('button', { name: '创建场地' }))
  expect(screen.getByRole('dialog', { name: '创建场地' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭场地编辑器' }))

  expect(screen.queryByRole('dialog', { name: '编辑场地' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '管理场地家里' })).toBeInTheDocument()
  const homeCard = screen.getByTestId('venue-card-home')
  await user.click(within(homeCard).getByRole('button', { name: '管理场地家里' }))
  const homeMenu = within(homeCard).getByRole('menu', { name: '家里场地操作' })
  expect(within(homeMenu).getByRole('menuitem', { name: '家庭成员' })).toHaveAttribute('href', '/app/venues/home/members')
  expect(within(homeMenu).getByRole('menuitem', { name: '最近活动' })).toHaveAttribute('href', '/app/venues/home/activity')
  const officeCardAfter = screen.getByTestId('venue-card-office')
  await user.click(within(officeCardAfter).getByRole('button', { name: '管理场地公司' }))
  const officeMenuAfter = within(officeCardAfter).getByRole('menu', { name: '公司场地操作' })
  expect(within(officeMenuAfter).getByRole('menuitem', { name: '家庭成员' })).toHaveAttribute('href', '/app/venues/office/members')
  expect(officeCardAfter).toHaveTextContent('家庭共享 · 王小明')
})

test('owner can invite family directly from the venue card without opening the editor', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MobileFeedbackProvider><MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter></MobileFeedbackProvider>)

  const card = await screen.findByTestId('venue-card-home')
  await user.click(within(card).getByRole('button', { name: '管理场地家里' }))
  const menu = screen.getByRole('menu', { name: '家里场地操作' })
  const inviteButton = within(menu).getByRole('menuitem', { name: '邀请家人' })
  expect(inviteButton).toBeEnabled()
  expect(screen.getByTestId('venue-card-home')).toHaveTextContent('1 / 5 位家庭成员')

  await user.click(inviteButton)

  expect(mockCreateInvite).toHaveBeenCalledWith('home')
  expect(screen.queryByRole('menu', { name: '家里场地操作' })).not.toBeInTheDocument()
  expect(await screen.findByRole('dialog', { name: '分享场地邀请' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '编辑场地' })).not.toBeInTheDocument()
})

test('explains when members or unused invitations have reserved all family seats', async () => {
  const user = userEvent.setup()
  mockCreateInvite.mockRejectedValue(Object.assign(new Error('venue_member_limit_reached'), { code: 'venue_member_limit_reached' }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MobileFeedbackProvider><MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter></MobileFeedbackProvider>)

  const card = await screen.findByTestId('venue-card-home')
  await user.click(within(card).getByRole('button', { name: '管理场地家里' }))
  await user.click(within(screen.getByRole('menu', { name: '家里场地操作' })).getByRole('menuitem', { name: '邀请家人' }))

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('成员名额已满')
  expect(screen.getByRole('alertdialog')).toHaveTextContent('未使用邀请')
})

test('shows the invite action with a clear disabled explanation when rollout is off', async () => {
  vi.stubEnv('VITE_ENABLE_VENUE_INVITES', 'false')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter>)

  const card = await screen.findByTestId('venue-card-home')
  await userEvent.setup().click(within(card).getByRole('button', { name: '管理场地家里' }))
  const inviteButton = within(screen.getByRole('menu', { name: '家里场地操作' })).getByRole('menuitem', { name: '邀请家人' })
  expect(inviteButton).toBeDisabled()
  expect(screen.getByText('邀请功能暂未开启')).toBeInTheDocument()
})

test('does not show invite controls on a member venue card', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter>)

  const memberCard = await screen.findByTestId('venue-card-office')
  await userEvent.setup().click(within(memberCard).getByRole('button', { name: '管理场地公司' }))
  const memberMenu = screen.getByRole('menu', { name: '公司场地操作' })
  expect(within(memberMenu).queryByRole('menuitem', { name: '邀请家人' })).not.toBeInTheDocument()
})

test('keeps the owner venue summary and actions inside one card surface', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter>)

  const card = await screen.findByTestId('venue-card-home')
  expect(card).toHaveClass('rounded-[1.35rem]', 'border', 'bg-surface')
  expect(within(card).queryByRole('menu')).not.toBeInTheDocument()
  await userEvent.setup().click(within(card).getByRole('button', { name: '管理场地家里' }))
  const menu = within(card).getByRole('menu', { name: '家里场地操作' })
  expect(within(menu).getByRole('menuitem', { name: '邀请家人' })).toBeInTheDocument()
  expect(within(menu).getByRole('menuitem', { name: '家庭成员' })).toBeInTheDocument()
})

test('opens venue editing only from the card action menu, never from the card body', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter>)

  const card = await screen.findByTestId('venue-card-home')
  expect(within(card).queryByRole('button', { name: '编辑场地家里' })).not.toBeInTheDocument()
  expect(within(card).getByRole('button', { name: '管理场地家里' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '编辑场地' })).not.toBeInTheDocument()

  await user.click(within(card).getByRole('button', { name: '管理场地家里' }))
  const menu = screen.getByRole('menu', { name: '家里场地操作' })
  expect(within(menu).getByRole('menuitem', { name: '编辑场地' })).toBeInTheDocument()
  expect(within(menu).getByRole('menuitem', { name: '邀请家人' })).toBeInTheDocument()
  expect(within(menu).getByRole('menuitem', { name: '家庭成员' })).toBeInTheDocument()
  expect(within(menu).getByRole('menuitem', { name: '最近活动' })).toBeInTheDocument()

  await user.click(within(menu).getByRole('menuitem', { name: '编辑场地' }))
  expect(screen.getByRole('dialog', { name: '编辑场地' })).toBeInTheDocument()
})

test('closes the venue action menu with Escape and restores focus to its trigger', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter>)

  const card = await screen.findByTestId('venue-card-home')
  const trigger = within(card).getByRole('button', { name: '管理场地家里' })
  await user.click(trigger)
  expect(within(card).getByRole('menu', { name: '家里场地操作' })).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(within(card).queryByRole('menu')).not.toBeInTheDocument()
  expect(document.activeElement).toBe(trigger)
})

test('uses a centered transparent trigger and an unclipped Apple-style floating menu', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<MemoryRouter><QueryClientProvider client={client}><VenuesPage /></QueryClientProvider></MemoryRouter>)

  const card = await screen.findByTestId('venue-card-home')
  expect(card).not.toHaveClass('overflow-hidden')
  const menuShell = within(card).getByTestId('venue-card-menu')
  expect(menuShell).toHaveClass('self-center', 'relative')
  const trigger = within(menuShell).getByRole('button', { name: '管理场地家里' })
  expect(trigger).toHaveClass('bg-transparent')
  expect(trigger).not.toHaveClass('border', 'border-line', 'bg-canvas', 'shadow-soft')

  await user.click(trigger)
  const menu = within(menuShell).getByRole('menu', { name: '家里场地操作' })
  expect(menu).toHaveClass('absolute', 'right-0', 'z-40', 'backdrop-blur-xl')
  expect(within(menu).getByRole('menuitem', { name: '编辑场地' })).toHaveClass('items-center', 'min-h-12')
})
