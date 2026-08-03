import { beforeEach, describe, expect, test, vi } from 'vitest'
import { compressPackingPhoto, isHeicCandidate, PackingImageConversionError } from './packing-image'

const mocks = vi.hoisted(() => ({
  compress: vi.fn(),
  heicTo: vi.fn(),
  isHeic: vi.fn(),
}))

vi.mock('browser-image-compression', () => ({ default: mocks.compress }))
vi.mock('heic-to/csp', () => ({ heicTo: mocks.heicTo, isHeic: mocks.isHeic }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.compress.mockImplementation(async (file: File) => new File([file], 'packing.webp', { type: 'image/webp' }))
  mocks.isHeic.mockResolvedValue(true)
  mocks.heicTo.mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
})

describe('isHeicCandidate', () => {
  test.each([
    ['photo.heic', ''],
    ['PHOTO.HEIF', 'application/octet-stream'],
    ['photo', 'image/heic'],
    ['photo', 'image/heif'],
  ])('accepts %s with MIME %s', (name, type) => {
    expect(isHeicCandidate(new File(['image'], name, { type }))).toBe(true)
  })

  test('does not treat regular JPEG as HEIC', () => {
    expect(isHeicCandidate(new File(['image'], 'photo.jpg', { type: 'image/jpeg' }))).toBe(false)
  })
})

test('decodes HEIC locally before producing the standard WebP upload', async () => {
  const input = new File(['heic'], 'IMG_0001.HEIC', { type: 'image/heic', lastModified: 123 })
  mocks.compress
    .mockRejectedValueOnce(new Error('native HEIC decode unavailable'))
    .mockImplementationOnce(async (file: File) => new File([file], 'packing.webp', { type: 'image/webp' }))

  const result = await compressPackingPhoto(input)

  expect(mocks.isHeic).toHaveBeenCalledWith(input)
  expect(mocks.heicTo).toHaveBeenCalledWith({ blob: input, type: 'image/jpeg', quality: 0.94 })
  expect(mocks.compress).toHaveBeenCalledWith(expect.objectContaining({ name: 'IMG_0001.jpg', type: 'image/jpeg' }), expect.objectContaining({
    fileType: 'image/webp', maxSizeMB: 4.5, maxWidthOrHeight: 2560,
  }))
  expect(result.type).toBe('image/webp')
})

test('rejects a mislabeled HEIC file instead of uploading undecodable bytes', async () => {
  mocks.compress.mockRejectedValueOnce(new Error('native HEIC decode unavailable'))
  mocks.isHeic.mockResolvedValue(false)
  await expect(compressPackingPhoto(new File(['bad'], 'photo.heic', { type: 'image/heic' })))
    .rejects.toBeInstanceOf(PackingImageConversionError)
  expect(mocks.compress).toHaveBeenCalledOnce()
})

test('uses native HEIC decoding when the browser can encode it as WebP', async () => {
  const input = new File(['heic'], 'photo.heic', { type: 'image/heic' })
  const result = await compressPackingPhoto(input)

  expect(result.type).toBe('image/webp')
  expect(mocks.isHeic).not.toHaveBeenCalled()
  expect(mocks.heicTo).not.toHaveBeenCalled()
})
