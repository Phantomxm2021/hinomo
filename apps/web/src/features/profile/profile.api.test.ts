import { beforeEach, expect, test, vi } from 'vitest'
import { getProfile, updateLocale, uploadAvatar } from './profile.api'

const { mockCompress, mockEq, mockFrom, mockMaybeSingle, mockRpc, mockSelect } = vi.hoisted(() => ({
  mockCompress: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockMaybeSingle: vi.fn(),
  mockRpc: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('browser-image-compression', () => ({ default: mockCompress }))
vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}))

beforeEach(() => {
  mockCompress.mockReset()
  mockFrom.mockReset().mockReturnValue({ select: mockSelect })
  mockSelect.mockReset().mockReturnValue({ eq: mockEq })
  mockEq.mockReset().mockReturnValue({ maybeSingle: mockMaybeSingle })
  mockMaybeSingle.mockReset()
  mockRpc.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

test('loads the signed-in profile through the profiles API', async () => {
  const profile = { id: 'user-1', display_name: '林家', avatar_object_key: null, locale: 'zh-CN' }
  mockMaybeSingle.mockResolvedValue({ data: profile, error: null })

  await expect(getProfile('user-1')).resolves.toEqual(profile)
  expect(mockFrom).toHaveBeenCalledWith('profiles')
  expect(mockSelect).toHaveBeenCalledWith('*')
  expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
})

test('updates locale through the authenticated RPC', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null })

  await expect(updateLocale('en-US')).resolves.toBeUndefined()
  expect(mockRpc).toHaveBeenCalledWith('update_profile_locale', { p_locale: 'en-US' })
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
