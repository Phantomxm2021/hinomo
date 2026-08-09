import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { VenueActivityPage } from './VenueActivityPage'
import type { VenueActivityEntry } from './venue-activity.api'

const mocks = vi.hoisted(() => ({ activity: vi.fn(), members: vi.fn() }))

vi.mock('./venue-activity.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venue-activity.api')>()), listVenueActivity: mocks.activity,
}))
vi.mock('./venue-sharing.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./venue-sharing.api')>()), listVenueMembers: mocks.members,
}))

const baseEntry: VenueActivityEntry = {
  id: 'activity-1', actor_id: 'member-1', actor_display_name: '李小红', actor_is_current: false,
  event_code: 'item_moved', entity_type: 'item', entity_id: 'item-1',
  snapshot: { entity_name: '露营灯', from: { name: '客厅' }, to: { name: '车库' } }, created_at: '2026-08-09T12:00:00.000Z',
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<I18nProvider><QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/venues/home/activity']}>
    <Routes><Route path="/app/venues/:venueId/activity" element={<VenueActivityPage />} /><Route path="/app" element={<p>首页</p>} /></Routes>
  </MemoryRouter></QueryClientProvider></I18nProvider>)
  return client
}

beforeEach(() => {
  mocks.activity.mockReset()
  mocks.members.mockReset()
  mocks.members.mockResolvedValue([
    { user_id: 'owner', role: 'owner', display_name: '王小明', avatar_url: null, joined_at: '2026-08-01T00:00:00Z', is_current: true },
    { user_id: 'member-1', role: 'member', display_name: '李小红', avatar_url: null, joined_at: '2026-08-02T00:00:00Z', is_current: false },
  ])
  mocks.activity.mockResolvedValue([baseEntry])
})
afterEach(cleanup)

test('renders localized event messages, a departed actor badge, and semantic time', async () => {
  renderPage()
  expect(await screen.findByRole('heading', { name: '最近活动' })).toBeInTheDocument()
  expect(screen.getAllByText('李小红').find((node) => node.tagName === 'STRONG')).toBeInTheDocument()
  expect(screen.getByText('已离开')).toBeInTheDocument()
  expect(screen.getByText(/露营灯/)).toBeInTheDocument()
  expect(screen.getByText(/客厅/)).toBeInTheDocument()
  expect(screen.getByText(/车库/)).toBeInTheDocument()
  expect(document.querySelector('time')).toHaveAttribute('dateTime', baseEntry.created_at)
})

test('filters by member and action, resetting the activity pages for each selection', async () => {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('heading', { name: '最近活动' })
  await user.selectOptions(screen.getByLabelText('成员筛选'), 'member-1')
  await waitFor(() => expect(mocks.activity).toHaveBeenLastCalledWith({ venueId: 'home', actorId: 'member-1', eventCode: null, cursor: null }))
  await user.selectOptions(screen.getByLabelText('活动筛选'), 'item_moved')
  await waitFor(() => expect(mocks.activity).toHaveBeenLastCalledWith({ venueId: 'home', actorId: 'member-1', eventCode: 'item_moved', cursor: null }))
})

test('uses the last row tuple for the next page and never renders an overlapping activity twice', async () => {
  const user = userEvent.setup()
  const firstPage = Array.from({ length: 50 }, (_, index) => ({ ...baseEntry, id: `activity-${index + 1}`, created_at: `2026-08-09T12:${String(59 - index).padStart(2, '0')}:00.000Z` }))
  mocks.activity.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([firstPage[49], { ...baseEntry, id: 'activity-51', created_at: '2026-08-09T11:00:00.000Z' }])
  renderPage()
  expect(await screen.findByRole('button', { name: '加载更多' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '加载更多' }))
  await waitFor(() => expect(mocks.activity).toHaveBeenLastCalledWith({
    venueId: 'home', actorId: null, eventCode: null,
    cursor: { createdAt: firstPage[49].created_at, id: firstPage[49].id },
  }))
  await waitFor(() => expect(screen.getAllByText(/露营灯/)).toHaveLength(51))
})

test('shows loading, empty, and refresh failure states', async () => {
  let resolveActivity: ((value: VenueActivityEntry[]) => void) | undefined
  mocks.activity.mockReturnValueOnce(new Promise((resolve) => { resolveActivity = resolve }))
  const client = renderPage()
  expect(screen.getByText('正在加载最近活动…')).toBeInTheDocument()
  resolveActivity?.([])
  expect(await screen.findByText('还没有最近活动')).toBeInTheDocument()

  mocks.activity.mockRejectedValueOnce(new Error('network'))
  await client.invalidateQueries({ queryKey: ['venue-activity', 'home'] })
  expect(await screen.findByText('最近活动加载失败，请重试')).toBeInTheDocument()
})

test('leaves the venue page immediately when the activity request reports revoked access', async () => {
  mocks.activity.mockRejectedValue(Object.assign(new Error('venue_access_denied'), { code: 'venue_access_denied' }))
  renderPage()
  expect(await screen.findByText('首页')).toBeInTheDocument()
  expect(mocks.activity).toHaveBeenCalledTimes(1)
})
