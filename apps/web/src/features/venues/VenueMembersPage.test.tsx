import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { VenueMembersPage } from './VenueMembersPage'

const mocks = vi.hoisted(() => ({
  access: vi.fn(), members: vi.fn(), invites: vi.fn(), createInvite: vi.fn(), revoke: vi.fn(), remove: vi.fn(), leave: vi.fn(),
}))

vi.mock('./venue-sharing.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venue-sharing.api')>()),
  getVenueAccessSummary: mocks.access,
  listVenueMembers: mocks.members,
  listVenueInvites: mocks.invites,
  createVenueInvite: mocks.createInvite,
  revokeVenueInvite: mocks.revoke,
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
    <I18nProvider><QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/venues/home/members']}>
      <Routes><Route path="/app/venues/:venueId/members" element={<VenueMembersPage />} /><Route path="/app" element={<p>首页</p>} /></Routes>
    </MemoryRouter></QueryClientProvider></I18nProvider>,
  )
  return client
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset())
  mocks.access.mockResolvedValue({ venue_id: 'home', role: 'owner', can_manage_members: true, member_count: 3, max_members: 5 })
  mocks.members.mockResolvedValue([
    { user_id: 'owner', role: 'owner', display_name: '王小明', avatar_url: 'https://avatar.example/owner.png', joined_at: '2026-08-01T00:00:00Z', is_current: true },
    { user_id: 'member', role: 'member', display_name: '李小红', avatar_url: null, joined_at: '2026-08-02T00:00:00Z', is_current: false },
  ])
  mocks.invites.mockResolvedValue([{ invite_id: 'invite-1', created_at: '2026-08-03T00:00:00Z', expires_at: '2026-08-10T00:00:00Z', status: 'active' }])
  mocks.createInvite.mockResolvedValue({ invite_id: 'invite-new', token: 'raw-secret', expires_at: '2026-08-10T00:00:00Z' })
  mocks.revoke.mockResolvedValue(undefined)
  mocks.remove.mockResolvedValue(undefined)
  mocks.leave.mockResolvedValue(undefined)
})
afterEach(cleanup)

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
  expect(screen.getByText('未使用邀请')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: '撤销邀请' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '移除李小红' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '退出场地' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建邀请' }))
  expect(await screen.findByRole('dialog', { name: '邀请对话框' })).toHaveTextContent('raw-secret')
  await user.click(screen.getByRole('button', { name: '关闭邀请' }))
  expect(screen.queryByRole('dialog', { name: '邀请对话框' })).not.toBeInTheDocument()
  expect(client.getMutationCache().getAll().some((mutation) => JSON.stringify(mutation.state.data).includes('raw-secret'))).toBe(false)

  await user.click(screen.getByRole('button', { name: '撤销邀请' }))
  await waitFor(() => expect(mocks.revoke).toHaveBeenCalledWith('invite-1'))
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['venue-invites', 'home'] })

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

test('redirects after access is denied and clears the revoked venue cache without retrying the query', async () => {
  mocks.access.mockRejectedValue(Object.assign(new Error('venue_access_denied'), { code: 'venue_access_denied' }))
  const client = renderPage()
  const removeQueries = vi.spyOn(client, 'removeQueries')

  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(removeQueries).toHaveBeenCalledWith({ queryKey: ['venues'] })
  expect(mocks.access).toHaveBeenCalledTimes(1)
})

test('starts the member lookup alongside access lookup and redirects when the members request discovers revoked access', async () => {
  let resolveAccess: ((value: unknown) => void) | undefined
  mocks.access.mockReturnValue(new Promise((resolve) => { resolveAccess = resolve }))
  mocks.members.mockResolvedValue([])
  const client = renderPage()

  await waitFor(() => expect(mocks.members).toHaveBeenCalledWith('home'))
  resolveAccess?.({ venue_id: 'home', role: 'member', can_manage_members: false, member_count: 1, max_members: 5 })
  await waitFor(() => expect(screen.getByRole('button', { name: '退出场地' })).toBeInTheDocument())

  mocks.members.mockRejectedValueOnce(Object.assign(new Error('venue_access_denied'), { code: 'venue_access_denied' }))
  await client.invalidateQueries({ queryKey: ['venue-members', 'home'] })
  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(client.getQueryData(['venues'])).toBeUndefined()
})
