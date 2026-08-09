import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { VenueMembersPage } from './VenueMembersPage'

const mocks = vi.hoisted(() => ({
  access: vi.fn(), members: vi.fn(), invites: vi.fn(), createInvite: vi.fn(), remove: vi.fn(), leave: vi.fn(),
}))

vi.mock('./venue-sharing.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venue-sharing.api')>()),
  getVenueAccessSummary: mocks.access,
  listVenueMembers: mocks.members,
  listVenueInvites: mocks.invites,
  createVenueInvite: mocks.createInvite,
  removeVenueMember: mocks.remove,
  leaveVenue: mocks.leave,
}))

vi.mock('./VenueInviteDialog', () => ({
  VenueInviteDialog: ({ open, invite, onClose }: { open: boolean; invite: { token: string } | null; onClose: () => void }) => open ? (
    <div role="dialog" aria-label="邀请对话框">{invite?.token}<button type="button" onClick={onClose}>关闭邀请</button></div>
  ) : null,
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider><MobileFeedbackProvider><QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/venues/home/members']}>
      <Routes><Route path="/app/venues/:venueId/members" element={<VenueMembersPage />} /><Route path="/app" element={<p>首页</p>} /></Routes>
    </MemoryRouter></QueryClientProvider></MobileFeedbackProvider></I18nProvider>,
  )
  return client
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_VENUE_INVITES', 'true')
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.access.mockResolvedValue({ venue_id: 'home', role: 'owner', can_manage_members: true, member_count: 3, max_members: 5 })
  mocks.members.mockResolvedValue([
    { user_id: 'owner', role: 'owner', display_name: '王小明', avatar_url: 'https://avatar.example/owner.png', joined_at: '2026-08-01T00:00:00Z', is_current: true },
    { user_id: 'member', role: 'member', display_name: '李小红', avatar_url: null, joined_at: '2026-08-02T00:00:00Z', is_current: false },
  ])
  mocks.invites.mockResolvedValue([{ invite_id: 'invite-1', created_at: '2026-08-03T00:00:00Z', expires_at: '2026-08-10T00:00:00Z', status: 'active', reusable: true, accepted_count: 0 }])
  mocks.createInvite.mockResolvedValue({ invite_id: 'invite-new', token: 'raw-secret', expires_at: '2026-08-10T00:00:00Z', reusable: true })
  mocks.remove.mockResolvedValue(undefined)
  mocks.leave.mockResolvedValue(undefined)
})

test('serializes rapid invite creation and replaces the displayed token only after the later request succeeds', async () => {
  let resolveFirst!: (invite: { invite_id: string; token: string; expires_at: string; reusable: boolean }) => void
  mocks.createInvite.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
    .mockResolvedValueOnce({ invite_id: 'invite-latest', token: 'latest-secret', expires_at: '2026-08-10T01:00:00Z', reusable: true })
  renderPage()

  const create = await screen.findByRole('button', { name: '创建邀请' })
  fireEvent.click(create)
  fireEvent.click(create)
  fireEvent.click(create)
  expect(mocks.createInvite).toHaveBeenCalledOnce()

  resolveFirst({ invite_id: 'invite-first', token: 'first-secret', expires_at: '2026-08-10T00:00:00Z', reusable: true })
  expect(await screen.findByRole('dialog', { name: '邀请对话框' })).toHaveTextContent('first-secret')
  fireEvent.click(screen.getByRole('button', { name: '创建邀请' }))
  await waitFor(() => expect(mocks.createInvite).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('dialog', { name: '邀请对话框' })).toHaveTextContent('latest-secret')
})

test('renders no more than one current active reusable invite row', async () => {
  mocks.invites.mockResolvedValue([
    { invite_id: 'invite-new', created_at: '2026-08-03T01:00:00Z', expires_at: '2026-08-10T01:00:00Z', status: 'active', reusable: true, accepted_count: 1 },
    { invite_id: 'invite-old', created_at: '2026-08-03T00:00:00Z', expires_at: '2026-08-10T00:00:00Z', status: 'active', reusable: true, accepted_count: 0 },
    { invite_id: 'invite-revoked', created_at: '2026-08-02T00:00:00Z', expires_at: '2026-08-09T00:00:00Z', status: 'revoked', reusable: true, accepted_count: 0 },
  ])
  renderPage()

  await waitFor(() => expect(screen.getByText('当前邀请 · 已邀请 1 位成员')).toBeInTheDocument())
  expect(await screen.findByRole('heading', { name: '当前邀请' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '撤销邀请' })).not.toBeInTheDocument()
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

test('owner manages family members, active invitations, and clears the raw invite token on every close path', async () => {
  const user = userEvent.setup()
  const client = renderPage()
  const invalidate = vi.spyOn(client, 'invalidateQueries')

  expect(await screen.findByText('3 / 5')).toBeInTheDocument()
  expect(screen.getByText('王小明')).toBeInTheDocument()
  expect(screen.getByText(/所有者/)).toBeInTheDocument()
  expect(screen.getByText('李小红')).toBeInTheDocument()
  expect(screen.getByText('李小红').parentElement).toHaveTextContent('成员')
  expect(screen.getByRole('button', { name: '创建邀请' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '最近活动' })).toHaveAttribute('href', '/app/venues/home/activity')
  expect(await screen.findByRole('heading', { name: '当前邀请' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '撤销邀请' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '移除李小红' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '退出场地' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建邀请' }))
  expect(await screen.findByRole('dialog', { name: '邀请对话框' })).toHaveTextContent('raw-secret')
  await user.click(screen.getByRole('button', { name: '关闭邀请' }))
  expect(screen.queryByRole('dialog', { name: '邀请对话框' })).not.toBeInTheDocument()
  expect(client.getMutationCache().getAll().some((mutation) => JSON.stringify(mutation.state.data).includes('raw-secret'))).toBe(false)

  await user.click(screen.getByRole('button', { name: '移除李小红' }))
  expect(await screen.findByRole('alertdialog', { name: '移除成员' })).toHaveTextContent('不会删除对方创建的数据或历史记录')
  await user.click(screen.getByRole('button', { name: '移除成员' }))
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('home', 'member'))
  for (const queryKey of [['venues'], ['venue-members', 'home'], ['venue-access', 'home'], ['venue-activity', 'home'], ['spaces'], ['boxes'], ['items'], ['search-items']]) {
    expect(invalidate).toHaveBeenCalledWith({ queryKey })
  }
})

test('member can leave, without owner controls, and immediately returns home after its venue cache is cleared', async () => {
  const user = userEvent.setup()
  mocks.access.mockResolvedValue({ venue_id: 'home', role: 'member', can_manage_members: false, member_count: 2, max_members: 5 })
  const client = renderPage()
  const removeQueries = vi.spyOn(client, 'removeQueries')
  const invalidate = vi.spyOn(client, 'invalidateQueries')

  expect(await screen.findByText('李小红')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '退出场地' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '创建邀请' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '移除李小红' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '退出场地' }))
  expect(await screen.findByRole('alertdialog', { name: '退出场地' })).toHaveTextContent('不会删除你创建的数据或历史记录')
  await user.click(within(screen.getByRole('alertdialog', { name: '退出场地' })).getByRole('button', { name: '退出场地' }))
  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(mocks.leave).toHaveBeenCalledWith('home')
  expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['venues'] })
  for (const queryKey of [['venues'], ['venue-members', 'home'], ['venue-access', 'home'], ['venue-activity', 'home'], ['spaces'], ['boxes'], ['items'], ['search-items']]) {
    expect(invalidate).toHaveBeenCalledWith({ queryKey })
  }
})

test('explains that reusable invitations do not reserve member seats', async () => {
  const user = userEvent.setup()
  mocks.createInvite.mockRejectedValue(Object.assign(new Error('venue_member_limit_reached'), { code: 'venue_member_limit_reached' }))
  renderPage()

  await user.click(await screen.findByRole('button', { name: '创建邀请' }))
  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('成员名额已满')
  expect(screen.getByRole('alertdialog')).toHaveTextContent('邀请链接不会占用名额')
  expect(screen.getByRole('alertdialog')).not.toHaveTextContent('未使用邀请')
})

test('retries a transient member-page invite failure through the global Apple alert', async () => {
  const user = userEvent.setup()
  mocks.createInvite.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ invite_id: 'invite-retry', token: 'retry-secret', expires_at: '2026-08-10T00:00:00Z', reusable: true })
  renderPage()

  await user.click(await screen.findByRole('button', { name: '创建邀请' }))
  const alert = await screen.findByRole('alertdialog', { name: '操作未完成' })
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(mocks.createInvite).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('dialog', { name: '邀请对话框' })).toHaveTextContent('retry-secret')
})

test('keeps invite creation closed when the deploy-time kill switch is disabled', async () => {
  vi.stubEnv('VITE_ENABLE_VENUE_INVITES', 'false')
  renderPage()

  expect(await screen.findByText('3 / 5')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '创建邀请' })).not.toBeInTheDocument()
  expect(screen.queryByText('未使用邀请')).not.toBeInTheDocument()
  expect(mocks.invites).not.toHaveBeenCalled()
})

test('shows Apple permission feedback before redirecting after access is denied while loading', async () => {
  mocks.access.mockRejectedValue(Object.assign(new Error('venue_access_denied'), { code: 'venue_access_denied' }))
  const client = renderPage()
  const removeQueries = vi.spyOn(client, 'removeQueries')

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('你没有执行此操作的权限')
  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['venues'] })
  expect(mocks.access).toHaveBeenCalledTimes(1)
})

test('shows Apple permission feedback before cleanup when removing a member loses access', async () => {
  const user = userEvent.setup()
  mocks.remove.mockRejectedValue(Object.assign(new Error('venue_access_denied'), { code: 'venue_access_denied' }))
  const client = renderPage()
  const removeQueries = vi.spyOn(client, 'removeQueries')

  await user.click(await screen.findByRole('button', { name: '移除李小红' }))
  await user.click(within(screen.getByRole('alertdialog', { name: '移除成员' })).getByRole('button', { name: '移除成员' }))

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('你没有执行此操作的权限')
  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['venues'] })
})

test('shows Apple permission feedback before cleanup when leaving loses access', async () => {
  const user = userEvent.setup()
  mocks.access.mockResolvedValue({ venue_id: 'home', role: 'member', can_manage_members: false, member_count: 2, max_members: 5 })
  mocks.leave.mockRejectedValue(Object.assign(new Error('venue_access_denied'), { code: 'venue_access_denied' }))
  const client = renderPage()
  const removeQueries = vi.spyOn(client, 'removeQueries')

  await user.click(await screen.findByRole('button', { name: '退出场地' }))
  await user.click(within(screen.getByRole('alertdialog', { name: '退出场地' })).getByRole('button', { name: '退出场地' }))

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('你没有执行此操作的权限')
  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['venues'] })
})

test('starts the member lookup alongside access lookup and redirects when the members request discovers revoked access', async () => {
  let resolveAccess: ((value: unknown) => void) | undefined
  mocks.access.mockReturnValue(new Promise((resolve) => { resolveAccess = resolve }))
  mocks.members.mockResolvedValue([])
  const client = renderPage()

  await waitFor(() => expect(mocks.members).toHaveBeenCalledWith('home'))
  resolveAccess?.({ venue_id: 'home', role: 'member', can_manage_members: false, member_count: 1, max_members: 5 })
  await waitFor(() => expect(screen.getByRole('button', { name: '退出场地' })).toBeInTheDocument())

  const revokedContentKeys = [['spaces'], ['boxes'], ['items'], ['search-items']]
  for (const queryKey of revokedContentKeys) client.setQueryData(queryKey, ['stale venue content'])
  mocks.members.mockRejectedValueOnce({ code: '42501', message: 'item is not accessible' })
  await client.invalidateQueries({ queryKey: ['venue-members', 'home'] })
  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('你没有执行此操作的权限')
  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(client.getQueryData(['venues'])).toBeUndefined()
  for (const queryKey of revokedContentKeys) expect(client.getQueryData(queryKey)).toBeUndefined()
})
