import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PackingChecklistSection } from './PackingChecklistSection'

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(), listItems: vi.fn(), updateItem: vi.fn(), promote: vi.fn(),
  reanalyze: vi.fn(), getPhoto: vi.fn(), getPromotion: vi.fn(), mergeItems: vi.fn(),
  getVenueAccess: vi.fn(),
  onVenueAccessDenied: vi.fn(),
}))

vi.mock('./packing.api', () => ({
  listPackingSessions: mocks.listSessions,
  listDetectedPackingItems: mocks.listItems,
  updateDetectedPackingItem: mocks.updateItem,
  requestPackingItemPromotion: mocks.promote,
  getPackingItemPromotion: mocks.getPromotion,
  requestPackingReanalysis: mocks.reanalyze,
  getPackingPhoto: mocks.getPhoto,
  mergeDetectedPackingItems: mocks.mergeItems,
}))
vi.mock('./PackingAuthorizedImage', () => ({ PackingAuthorizedImage: ({ alt }: { alt: string }) => <span>{alt}</span> }))
vi.mock('../venues/venue-sharing.api', () => ({ getVenueAccessSummary: mocks.getVenueAccess }))

const item = {
  id: 'detected-1', session_id: 'session-1', box_id: 'box-1', analysis_revision: 1,
  name: '白色充电器', category: '电子配件', description: 'USB-C', quantity_kind: 'exact', quantity_value: 1,
  visibility: 'clear', review_status: 'unreviewed', crop_status: 'ready', first_seen_photo_id: 'photo-1',
  representative_instance_id: 'instance-1', cover_object_key: 'packing/item.webp', cover_mime_type: 'image/webp',
  cover_size_bytes: 100, cover_width: 300, cover_height: 300, crop_source_photo_id: 'photo-1',
  crop_bbox: [0.1, 0.2, 0.8, 0.9], crop_version: 'v1', model_id: 'qwen', prompt_version: 'v1',
  published_at: '2026-08-03T00:00:00Z', created_at: '2026-08-03T00:00:00Z', updated_at: '2026-08-03T00:00:00Z',
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const result = render(<QueryClientProvider client={queryClient}><PackingChecklistSection boxId="box-1" venueId="venue-1" onVenueAccessDenied={mocks.onVenueAccessDenied} /></QueryClientProvider>)
  return { ...result, queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listSessions.mockResolvedValue([{ id: 'session-1', status: 'ready', current_revision: 1 }])
  mocks.getVenueAccess.mockResolvedValue({ venue_id: 'venue-1', role: 'member' })
  mocks.listItems.mockResolvedValue([item])
  mocks.updateItem.mockResolvedValue(undefined)
  mocks.promote.mockResolvedValue({ id: 'promotion-1', status: 'pending' })
  mocks.getPromotion.mockResolvedValue({ id: 'promotion-1', status: 'pending' })
  mocks.getPhoto.mockResolvedValue({ id: 'photo-1', object_key: 'packing/original.webp' })
})
afterEach(cleanup)

test('keeps secondary review actions behind a compact menu', async () => {
  const user = userEvent.setup()
  renderSection()
  expect(await screen.findByRole('button', { name: /AI 智能清单/ })).toBeInTheDocument()
  expect(mocks.listItems).toHaveBeenCalledWith('box-1', 'session-1', 1)
  expect(screen.queryByText('白色充电器')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /AI 智能清单/ }))
  expect(await screen.findByRole('dialog', { name: 'AI 智能清单' })).toBeInTheDocument()
  expect(await screen.findByText('白色充电器')).toBeInTheDocument()
  expect(screen.getByText('白色充电器裁剪图片')).toBeInTheDocument()

  expect(screen.queryByRole('button', { name: '修改' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '确认' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '查看白色充电器原图证据' }))
  expect(await screen.findByRole('dialog', { name: '白色充电器原图证据' })).toBeInTheDocument()
  expect(await screen.findByText('白色充电器来源原图')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭' }))

  await user.click(screen.getByRole('button', { name: '更多白色充电器操作' }))
  expect(screen.getByRole('button', { name: '修改' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '忽略' })).toBeInTheDocument()
})

test('preflights the active checklist poll and forwards a stable access denial', async () => {
  const error = { code: '42501', message: 'packing session is not accessible' }
  const { queryClient } = renderSection()
  await screen.findByRole('button', { name: /AI 智能清单/ })
  const completedItemReads = mocks.listItems.mock.calls.length

  mocks.getVenueAccess.mockRejectedValue(error)
  await queryClient.invalidateQueries({ queryKey: ['packing-detected-items', 'box-1'] })

  await waitFor(() => expect(mocks.onVenueAccessDenied).toHaveBeenCalledWith(error))
  expect(mocks.listItems).toHaveBeenCalledTimes(completedItemReads)
})

test('forwards inaccessible nested checklist mutations to the venue revocation handler', async () => {
  const user = userEvent.setup()
  const error = { code: '42501', message: 'item is not accessible' }
  mocks.updateItem.mockRejectedValue(error)
  renderSection()
  await user.click(await screen.findByRole('button', { name: /AI 智能清单/ }))
  await user.click(screen.getByRole('button', { name: '更多白色充电器操作' }))
  await user.click(screen.getByRole('button', { name: '修改' }))
  await user.click(screen.getByRole('button', { name: '保存修正' }))

  await waitFor(() => expect(mocks.onVenueAccessDenied).toHaveBeenCalledWith(error))
})

test('lets an estimated quantity join the formal checklist in one step', async () => {
  const user = userEvent.setup()
  mocks.listItems.mockResolvedValue([{ ...item, quantity_kind: 'at_least', quantity_value: 3 }])
  renderSection()
  await user.click(await screen.findByRole('button', { name: /AI 智能清单/ }))
  await user.click(await screen.findByRole('button', { name: '加入清单' }))
  await waitFor(() => expect(mocks.promote).toHaveBeenCalledWith('detected-1'))
  expect(await screen.findByText('已提交 1 项，正在后台加入清单')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '加入清单' })).not.toBeInTheDocument()
})

test('refreshes the formal item list when background promotion completes', async () => {
  const user = userEvent.setup()
  mocks.getPromotion.mockResolvedValue({ id: 'promotion-1', status: 'completed' })
  const { queryClient } = renderSection()
  queryClient.setQueryData(['items', 'box-1'], [{ id: 'existing-item' }])
  await user.click(await screen.findByRole('button', { name: /AI 智能清单/ }))
  await user.click(await screen.findByRole('button', { name: '加入清单' }))
  await waitFor(() => expect(queryClient.getQueryState(['items', 'box-1'])?.isInvalidated).toBe(true))
})

test('restores the detected item when background promotion fails', async () => {
  const user = userEvent.setup()
  mocks.getPromotion.mockResolvedValue({ id: 'promotion-1', status: 'failed' })
  renderSection()
  await user.click(await screen.findByRole('button', { name: /AI 智能清单/ }))
  await user.click(await screen.findByRole('button', { name: '加入清单' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('白色充电器加入失败，请重试')
  mocks.getPromotion.mockResolvedValue({ id: 'promotion-1', status: 'pending' })
  await user.click(await screen.findByRole('button', { name: '加入清单' }))
  expect(await screen.findByText('已提交 1 项，正在后台加入清单')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('uses the source photo while an item crop is still pending', async () => {
  const user = userEvent.setup()
  mocks.listItems.mockResolvedValue([{ ...item, crop_status: 'pending', cover_object_key: null }])
  renderSection()
  await user.click(await screen.findByRole('button', { name: /AI 智能清单/ }))
  await user.click(await screen.findByRole('button', { name: '加入清单' }))
  await waitFor(() => expect(mocks.promote).toHaveBeenCalledWith('detected-1'))
})
