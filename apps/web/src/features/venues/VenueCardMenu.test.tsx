import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { VenueCardMenu } from './VenueCardMenu'

const mocks = vi.hoisted(() => ({ access: vi.fn(), members: vi.fn(), invites: vi.fn(), remove: vi.fn(), leave: vi.fn() }))

vi.mock('./venue-sharing.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venue-sharing.api')>()),
  getVenueAccessSummary: mocks.access,
  listVenueMembers: mocks.members,
  listVenueInvites: mocks.invites,
  removeVenueMember: mocks.remove,
  leaveVenue: mocks.leave,
}))

vi.mock('./VenueInviteDialog', () => ({ VenueInviteDialog: () => null }))

const venue = {
  id: 'home', name: '家里', description: null, is_default: true, space_count: 1,
  role: 'owner' as const, owner_display_name: null, owner_id: 'owner', member_count: 2, max_members: 5,
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_VENUE_INVITES', 'true')
  mocks.access.mockReset().mockResolvedValue({ venue_id: 'home', role: 'owner', can_manage_members: true, member_count: 2, max_members: 5 })
  mocks.members.mockReset().mockResolvedValue([
    { user_id: 'owner', role: 'owner', display_name: '王小明', avatar_url: null, joined_at: '2026-08-01T00:00:00Z', is_current: true },
  ])
  mocks.invites.mockReset().mockResolvedValue([])
  mocks.remove.mockReset().mockResolvedValue(undefined)
  mocks.leave.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

test('opens family members in an in-place dialog without changing the route', async () => {
  const user = userEvent.setup()
  const originalLocation = window.location.href
  render(<I18nProvider><MobileFeedbackProvider><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/app/venues']}><VenueCardMenu venue={venue} invitesEnabled onEdit={() => undefined} onVenueAccessDenied={() => undefined} /></MemoryRouter></QueryClientProvider></MobileFeedbackProvider></I18nProvider>)

  await user.click(screen.getByRole('button', { name: '管理场地家里' }))
  await user.click(screen.getByRole('menuitem', { name: '家庭成员' }))

  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: '家庭成员家里' })).toBeInTheDocument()
  expect(await screen.findByText('王小明')).toBeInTheDocument()
  expect(window.location.href).toBe(originalLocation)
  await user.click(screen.getByRole('button', { name: '关闭家庭成员家里' }))
  expect(screen.queryByRole('dialog', { name: '家庭成员家里' })).not.toBeInTheDocument()
})

test('closes on Escape or backdrop click and restores focus to the menu trigger', async () => {
  const user = userEvent.setup()
  render(<I18nProvider><MobileFeedbackProvider><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><VenueCardMenu venue={venue} invitesEnabled onEdit={() => undefined} onVenueAccessDenied={() => undefined} /></MemoryRouter></QueryClientProvider></MobileFeedbackProvider></I18nProvider>)
  const trigger = screen.getByRole('button', { name: '管理场地家里' })

  await user.click(trigger)
  await user.click(screen.getByRole('menuitem', { name: '家庭成员' }))
  expect(screen.getByRole('dialog', { name: '家庭成员家里' })).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '家庭成员家里' })).not.toBeInTheDocument())
  await waitFor(() => expect(document.activeElement).toBe(trigger))

  await user.click(trigger)
  await user.click(screen.getByRole('menuitem', { name: '家庭成员' }))
  fireEvent.mouseDown(screen.getByTestId('editor-dialog-backdrop'))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '家庭成员家里' })).not.toBeInTheDocument())
})

test('keeps the members dialog open while removing a member is pending', async () => {
  let resolveRemove!: () => void
  mocks.members.mockResolvedValue([{ user_id: 'member', role: 'member', display_name: '李小红', avatar_url: null, joined_at: '2026-08-02T00:00:00Z', is_current: false }])
  mocks.remove.mockReturnValue(new Promise<void>((resolve) => { resolveRemove = resolve }))
  const user = userEvent.setup()
  render(<I18nProvider><MobileFeedbackProvider><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><VenueCardMenu venue={venue} invitesEnabled onEdit={() => undefined} onVenueAccessDenied={() => undefined} /></MemoryRouter></QueryClientProvider></MobileFeedbackProvider></I18nProvider>)

  await user.click(screen.getByRole('button', { name: '管理场地家里' }))
  await user.click(screen.getByRole('menuitem', { name: '家庭成员' }))
  await user.click(await screen.findByRole('button', { name: '移除李小红' }))
  await user.click(within(screen.getByRole('alertdialog', { name: '移除成员' })).getByRole('button', { name: '移除成员' }))
  await waitFor(() => expect(screen.getByRole('dialog', { name: '家庭成员家里' })).toHaveAttribute('aria-busy', 'true'))

  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.mouseDown(screen.getByTestId('editor-dialog-backdrop'))
  expect(screen.getByRole('dialog', { name: '家庭成员家里' })).toBeInTheDocument()
  resolveRemove()
})
