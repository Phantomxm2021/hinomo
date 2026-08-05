import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PHOTO_UPLOAD_MAX_SIZE_MB } from '../../lib/photo-compression'
import { useMediaUpload } from './useMediaUpload'

const { mockCompress, mockConfirmUpload, mockCreateUpload } = vi.hoisted(() => ({
  mockCompress: vi.fn(),
  mockConfirmUpload: vi.fn(),
  mockCreateUpload: vi.fn(),
}))

vi.mock('browser-image-compression', () => ({ default: mockCompress }))
vi.mock('./media.api', () => ({
  confirmMediaUpload: mockConfirmUpload,
  createMediaUpload: mockCreateUpload,
}))

const file = new File(['image'], 'cover.png', { type: 'image/png' })
const compressed = new File(['small'], 'cover.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  mockCompress.mockReset().mockResolvedValue(compressed)
  mockCreateUpload.mockReset().mockResolvedValue({
    upload_id: 'upload-1',
    object_key: 'users/u/cover.jpg',
    upload_url: 'https://r2.example/upload',
  })
  mockConfirmUpload.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => vi.unstubAllGlobals())

test('compresses, uploads, and confirms a media session in order', async () => {
  const { result } = renderHook(() => useMediaUpload())

  await act(() =>
    result.current.upload({ file, boxId: 'b1', itemId: null, kind: 'cover' }),
  )

  const putToR2 = vi.mocked(fetch)
  expect(mockCompress.mock.invocationCallOrder[0]).toBeLessThan(
    mockCreateUpload.mock.invocationCallOrder[0],
  )
  expect(mockCreateUpload.mock.invocationCallOrder[0]).toBeLessThan(
    putToR2.mock.invocationCallOrder[0],
  )
  expect(putToR2.mock.invocationCallOrder[0]).toBeLessThan(
    mockConfirmUpload.mock.invocationCallOrder[0],
  )
  expect(result.current.stage).toBe('complete')
  expect(mockCompress).toHaveBeenCalledWith(file, {
    fileType: 'image/jpeg',
    initialQuality: 0.8,
    maxSizeMB: PHOTO_UPLOAD_MAX_SIZE_MB,
    maxWidthOrHeight: 1920,
    maxIteration: 15,
    useWebWorker: true,
  })
  expect(mockCreateUpload).toHaveBeenCalledWith(
    expect.objectContaining({ mimeType: 'image/jpeg' }),
  )
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: { 'Content-Type': 'image/jpeg' },
      body: compressed,
    }),
  )
})

test('does not confirm when R2 PUT fails', async () => {
  const uploadError = new Error('network')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(uploadError))
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const { result } = renderHook(() => useMediaUpload())

  await act(async () => {
    await expect(
      result.current.upload({ file, boxId: 'b1', itemId: null, kind: 'cover' }),
    ).rejects.toThrow('network')
  })

  expect(mockConfirmUpload).not.toHaveBeenCalled()
  expect(result.current.stage).toBe('error')
  expect(consoleError).toHaveBeenCalledWith('media_upload_failed', {
    boxId: 'b1',
    itemId: null,
    kind: 'cover',
    error: uploadError,
  })
  consoleError.mockRestore()
})
