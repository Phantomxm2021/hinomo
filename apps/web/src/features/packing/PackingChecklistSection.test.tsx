import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PackingChecklistSection } from './PackingChecklistSection'

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(), listItems: vi.fn(), updateItem: vi.fn(), promote: vi.fn(),
  reanalyze: vi.fn(), getPhoto: vi.fn(), mergeItems: vi.fn(),
}))

vi.mock('./packing.api', () => ({
  listPackingSessions: mocks.listSessions,
  listDetectedPackingItems: mocks.listItems,
  updateDetectedPackingItem: mocks.updateItem,
  requestPackingItemPromotion: mocks.promote,
  requestPackingReanalysis: mocks.reanalyze,
  getPackingPhoto: mocks.getPhoto,
  mergeDetectedPackingItems: mocks.mergeItems,
}))
vi.mock('./PackingAuthorizedImage', () => ({ PackingAuthorizedImage: ({ alt }: { alt: string }) => <span>{alt}</span> }))

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
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PackingChecklistSection boxId="box-1" /></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listSessions.mockResolvedValue([{ id: 'session-1', status: 'ready', current_revision: 1 }])
  mocks.listItems.mockResolvedValue([item])
  mocks.updateItem.mockResolvedValue(undefined)
  mocks.promote.mockResolvedValue({ id: 'promotion-1', status: 'pending' })
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

test('lets an estimated quantity join the formal checklist in one step', async () => {
  const user = userEvent.setup()
  mocks.listItems.mockResolvedValue([{ ...item, quantity_kind: 'at_least', quantity_value: 3 }])
  renderSection()
  await user.click(await screen.findByRole('button', { name: /AI 智能清单/ }))
  await user.click(await screen.findByRole('button', { name: '加入清单' }))
  await waitFor(() => expect(mocks.promote).toHaveBeenCalledWith('detected-1'))
  expect(screen.getByRole('button', { name: '正在加入…' })).toBeDisabled()
})

test('uses the source photo while an item crop is still pending', async () => {
  const user = userEvent.setup()
  mocks.listItems.mockResolvedValue([{ ...item, crop_status: 'pending', cover_object_key: null }])
  renderSection()
  await user.click(await screen.findByRole('button', { name: /AI 智能清单/ }))
  await user.click(await screen.findByRole('button', { name: '加入清单' }))
  await waitFor(() => expect(mocks.promote).toHaveBeenCalledWith('detected-1'))
})
