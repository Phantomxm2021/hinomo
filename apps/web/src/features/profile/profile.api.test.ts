import { beforeEach, expect, test, vi } from 'vitest'
import { uploadAvatar } from './profile.api'

const { mockCompress, mockRpc } = vi.hoisted(() => ({
  mockCompress: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('browser-image-compression', () => ({ default: mockCompress }))
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

beforeEach(() => {
  mockCompress.mockReset()
  mockRpc.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

test('compresses an avatar before signing and uploading it', async () => {
  const original = new File(['large avatar'], 'avatar.png', { type: 'image/png' })
  const compressed = new File(['small'], 'avatar.webp', { type: 'image/webp' })
  mockCompress.mockResolvedValue(compressed)
  mockRpc.mockImplementation((name: string) => {
    if (name === 'create_profile_avatar_upload') {
      return Promise.resolve({
        data: [{ upload_id: 'upload-1', upload_url: 'https://r2.example/avatar' }],
        error: null,
      })
    }
    if (name === 'create_profile_avatar_download') {
      return Promise.resolve({ data: [{ download_url: 'https://r2.example/view' }], error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  await uploadAvatar(original)

  expect(mockCompress).toHaveBeenCalledWith(original, {
    fileType: 'image/webp',
    initialQuality: 0.82,
    maxSizeMB: 0.5,
    maxWidthOrHeight: 512,
    useWebWorker: true,
  })
  expect(mockRpc).toHaveBeenCalledWith('create_profile_avatar_upload', {
    p_mime_type: 'image/webp',
    p_size_bytes: compressed.size,
  })
  expect(fetch).toHaveBeenCalledWith('https://r2.example/avatar', {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp' },
    body: compressed,
  })
})
