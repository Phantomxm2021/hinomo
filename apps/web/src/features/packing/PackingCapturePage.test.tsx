import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PackingCaptureSheet } from './PackingCapturePage'

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
  onClose: vi.fn(),
  onCompleted: vi.fn(),
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

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <PackingCaptureSheet boxId="box-1" onClose={mocks.onClose} onCompleted={mocks.onCompleted} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
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
  renderSheet()

  expect(await screen.findByRole('dialog', { name: 'AI 装箱' })).toBeInTheDocument()
  expect(await screen.findByText(/BX-00001 · 冬季用品/)).toBeInTheDocument()
  expect(screen.getByText(/每放入一个物件，拍一张/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '选择物品照片' })).toBeInTheDocument()
  const fileInput = screen.getByLabelText('拍摄装箱照片')
  expect(fileInput).not.toHaveAttribute('capture')
  expect(fileInput.getAttribute('accept')).toContain('image/heic')
  expect(fileInput.getAttribute('accept')).toContain('.heif')
  expect(screen.queryByRole('button', { name: '继续拍照' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '完成' })).toBeDisabled()
  expect(screen.queryByLabelText('物品名称')).not.toBeInTheDocument()
})

test('requests the rear camera and uses mobile copy on a coarse pointer device', async () => {
  vi.mocked(window.matchMedia).mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
  renderSheet()

  expect(await screen.findByRole('button', { name: '拍摄这件物品' })).toBeInTheDocument()
  expect(screen.getByLabelText('拍摄装箱照片')).toHaveAttribute('capture', 'environment')
  expect(screen.getByText('将请求使用后置相机')).toBeInTheDocument()
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
  renderSheet()
  const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })

  await user.upload(await screen.findByLabelText('拍摄装箱照片'), file)

  await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
    id: 'session-1:1', sessionId: 'session-1', sequenceNo: 1,
  })))
  await waitFor(() => expect(mocks.uploadPhoto).toHaveBeenCalledWith(expect.objectContaining({
    sessionId: 'session-1', sequenceNo: 1,
  })))
  await waitFor(() => expect(mocks.deleteDraft).toHaveBeenCalledWith('session-1:1'))

  const finishButton = screen.getByRole('button', { name: '完成' })
  await waitFor(() => expect(finishButton).toBeEnabled())
  await user.click(finishButton)
  await waitFor(() => expect(mocks.completeSession).toHaveBeenCalledWith('session-1'))
  expect(mocks.onCompleted).toHaveBeenCalledOnce()
})

test('retains a local draft when upload fails', async () => {
  const user = userEvent.setup()
  mocks.uploadPhoto.mockRejectedValueOnce(new Error('offline'))
  renderSheet()

  await user.upload(await screen.findByLabelText('拍摄装箱照片'), new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('照片上传失败')
  expect(mocks.deleteDraft).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '完成' })).toBeDisabled()
})

test('closes as a modal sheet without navigating away', async () => {
  const user = userEvent.setup()
  renderSheet()

  await user.click(await screen.findByRole('button', { name: '关闭 AI 装箱' }))
  expect(mocks.onClose).toHaveBeenCalledOnce()
})
