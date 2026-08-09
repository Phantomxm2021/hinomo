import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { INVITE_SESSION_KEY } from './venue-invite-session'
import { JoinVenuePage } from './JoinVenuePage'

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), accept: vi.fn() }))
vi.mock('./venue-sharing.api', () => ({ inspectVenueInvite: mocks.inspect, acceptVenueInvite: mocks.accept }))

const session = { user: { id: 'member-1' } } as unknown as Session
const active = { venue_id: 'venue-1', venue_name: '家里', owner_display_name: '小林', status: 'active', expires_at: '2026-08-10T00:00:00Z', current_user_state: 'eligible' }

function renderJoin(authSession: Session | null = null) {
  window.sessionStorage.setItem(INVITE_SESSION_KEY, 'raw-token')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<I18nProvider><QueryClientProvider client={client}><AuthProvider session={authSession}><MemoryRouter initialEntries={['/join/venue']}><Routes><Route path="/join/venue" element={<JoinVenuePage />} /><Route path="/app" element={<h1>我的收纳</h1>} /><Route path="/login" element={<h1>登录页</h1>} /><Route path="/register" element={<h1>注册页</h1>} /></Routes></MemoryRouter></AuthProvider></QueryClientProvider></I18nProvider>)
  return client
}

beforeEach(() => { mocks.inspect.mockReset(); mocks.accept.mockReset(); mocks.inspect.mockResolvedValue(active) })
afterEach(() => { cleanup(); window.sessionStorage.clear() })

test('shows an active invite summary and preserves the tab token while signed out', async () => {
  renderJoin()
  expect(await screen.findByRole('heading', { name: '加入家里' })).toBeInTheDocument()
  expect(screen.getByText(/小林/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute('href', '/login')
  expect(screen.getByRole('link', { name: '注册' })).toHaveAttribute('href', '/register')
  expect(window.sessionStorage.getItem(INVITE_SESSION_KEY)).toBe('raw-token')
})

test('accepts an eligible signed-in invite, clears the token, invalidates venue data, and enters the app', async () => {
  const user = userEvent.setup()
  mocks.accept.mockResolvedValue({ result: 'joined', venue_id: 'venue-1' })
  const client = renderJoin(session)
  const invalidate = vi.spyOn(client, 'invalidateQueries')

  await user.click(await screen.findByRole('button', { name: '加入场地' }))

  await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith('raw-token'))
  await screen.findByRole('heading', { name: '我的收纳' })
  expect(window.sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull()
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['venues'] })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['venue-access'] })
})

test.each([
  ['expired', '邀请已过期'], ['used', '邀请已被使用'], ['revoked', '邀请已被撤销'], ['full', '场地成员已满'], ['missing', '邀请不可用'],
])('shows a distinct public state for a %s invite', async (status, text) => {
  mocks.inspect.mockResolvedValue({ ...active, venue_name: null, owner_display_name: null, status })
  renderJoin(session)
  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '加入场地' })).not.toBeInTheDocument()
})

test.each([
  ['member', '你已是该场地成员'], ['owner', '你是该场地的所有者'],
])('does not offer acceptance when the signed-in visitor is the %s', async (current_user_state, text) => {
  mocks.inspect.mockResolvedValue({ ...active, current_user_state })
  renderJoin(session)
  expect(await screen.findByText(text)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '加入场地' })).not.toBeInTheDocument()
})

test('shows a missing state without calling the API when no tab token exists', () => {
  renderJoin(session)
  window.sessionStorage.removeItem(INVITE_SESSION_KEY)
  cleanup()
  mocks.inspect.mockClear()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<I18nProvider><QueryClientProvider client={client}><AuthProvider session={session}><MemoryRouter><JoinVenuePage /></MemoryRouter></AuthProvider></QueryClientProvider></I18nProvider>)
  expect(screen.getByText('邀请链接缺少凭证')).toBeInTheDocument()
  expect(mocks.inspect).not.toHaveBeenCalled()
})
