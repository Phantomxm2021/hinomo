import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PackingCapturePage } from './PackingCapturePage'

const mocks = vi.hoisted(() => ({
  getBox: vi.fn(),
  getOrCreateSession: vi.fn(),
  listPhotos: vi.fn(),
  uploadPhoto: vi.fn(),
  uploadAtlas: vi.fn(),
  downloadPhoto: vi.fn(),
  buildAtlases: vi.fn(),
  completeSession: vi.fn(),
  saveDraft: vi.fn(),
  listDrafts: vi.fn(),
  deleteDraft: vi.fn(),
  compress: vi.fn(),
}))

vi.mock('../boxes/boxes.api', () => ({ getBox: mocks.getBox }))
vi.mock('./packing.api', () => ({
  getOrCreatePackingSession: mocks.getOrCreateSession,
  listPackingPhotos: mocks.listPhotos,
  uploadPackingPhoto: mocks.uploadPhoto,
  uploadPackingAtlas: mocks.uploadAtlas,
  downloadPackingPhoto: mocks.downloadPhoto,
  completePackingSession: mocks.completeSession,
}))
vi.mock('./packing-atlas', () => ({ buildClientPackingAtlases: mocks.buildAtlases }))
vi.mock('./packing-storage', () => ({
  savePackingDraft: mocks.saveDraft,
  listPackingDrafts: mocks.listDrafts,
  deletePackingDraft: mocks.deleteDraft,
}))
vi.mock('browser-image-compression', () => ({ default: mocks.compress }))
vi.mock('./PackingAuthorizedImage', () => ({
  PackingAuthorizedImage: ({ alt }: { alt: string }) => <span>{alt}</span>,
}))

const session = {
  id: 'session-1', box_id: 'box-1', owner_id: 'owner-1', status: 'capturing',
  photo_count: 0, current_revision: 0, model_id: null, prompt_version: null,
  schema_version: null, started_at: '2026-08-03T00:00:00Z', completed_at: null,
  processed_at: null, last_error_code: null, created_at: '2026-08-03T00:00:00Z',
  updated_at: '2026-08-03T00:00:00Z',
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/app/boxes/box-1/packing']}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/app/boxes/:boxId/packing" element={<PackingCapturePage />} />
          <Route path="/app/boxes/:boxId" element={<p>箱子详情</p>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getBox.mockResolvedValue({ id: 'box-1', box_code: 'BX-00001', name: '冬季用品' })
  mocks.getOrCreateSession.mockResolvedValue(session)
  mocks.listPhotos.mockResolvedValue([])
  mocks.listDrafts.mockResolvedValue([])
  mocks.saveDraft.mockResolvedValue(undefined)
  mocks.deleteDraft.mockResolvedValue(undefined)
  mocks.uploadPhoto.mockResolvedValue(undefined)
  mocks.uploadAtlas.mockResolvedValue(undefined)
  mocks.downloadPhoto.mockResolvedValue(new Blob(['photo'], { type: 'image/webp' }))
  mocks.buildAtlases.mockResolvedValue([{
    atlasNo: 1, firstSequenceNo: 1, lastSequenceNo: 1, width: 512, height: 552,
    sha256: 'a'.repeat(64), blob: new Blob(['atlas'], { type: 'image/webp' }),
  }])
  mocks.completeSession.mockResolvedValue({ ...session, status: 'queued', photo_count: 1 })
  mocks.compress.mockImplementation(async (file: File) => new File([file], 'packing.webp', { type: 'image/webp' }))
})

afterEach(cleanup)

test('starts a zero-form packing session with only capture and finish actions', async () => {
  renderPage()

  expect(await screen.findByRole('heading', { name: '冬季用品' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '拍照' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '装箱完成' })).toBeDisabled()
  expect(screen.queryByLabelText('物品名称')).not.toBeInTheDocument()
})

test('stores a compressed draft before upload and completes after confirmation', async () => {
  const user = userEvent.setup()
  mocks.uploadPhoto.mockImplementationOnce(async () => {
    mocks.listPhotos.mockResolvedValue([{
      id: 'photo-1', session_id: 'session-1', sequence_no: 1,
      object_key: 'users/owner-1/boxes/box-1/packing/session-1/photos/1.webp',
      mime_type: 'image/webp', byte_size: 5, width: 1600, height: 1200,
      sha256: 'hash', upload_status: 'confirmed', upload_expires_at: null,
      confirmed_at: '2026-08-03T00:01:00Z', created_at: '2026-08-03T00:00:00Z',
      updated_at: '2026-08-03T00:01:00Z',
    }])
  })
  renderPage()
  const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

  await user.upload(await screen.findByLabelText('拍摄装箱照片'), file)

  await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
    id: 'session-1:1', sessionId: 'session-1', sequenceNo: 1,
  })))
  await waitFor(() => expect(mocks.uploadPhoto).toHaveBeenCalledWith(expect.objectContaining({
    sessionId: 'session-1', sequenceNo: 1,
  })))
  await waitFor(() => expect(mocks.deleteDraft).toHaveBeenCalledWith('session-1:1'))

  const finishButton = screen.getByRole('button', { name: '装箱完成' })
  await waitFor(() => expect(finishButton).toBeEnabled())
  await user.click(finishButton)
  await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledWith('session-1'))
  expect(await screen.findByText('箱子详情')).toBeInTheDocument()
})

test('retains a local draft when upload fails', async () => {
  const user = userEvent.setup()
  mocks.uploadPhoto.mockRejectedValueOnce(new Error('offline'))
  renderPage()

  await user.upload(await screen.findByLabelText('拍摄装箱照片'), new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('照片上传失败')
  expect(mocks.deleteDraft).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '装箱完成' })).toBeDisabled()
})
