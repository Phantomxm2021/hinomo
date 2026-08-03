import { beforeEach, describe, expect, test, vi } from 'vitest'
import { compressPackingPhoto, isHeicCandidate, PackingImageConversionError } from './packing-image'

const mocks = vi.hoisted(() => ({ compress: vi.fn() }))

vi.mock('browser-image-compression', () => ({ default: mocks.compress }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.compress.mockImplementation(async (file: File) => new File([file], 'packing.jpg', { type: 'image/jpeg' }))
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

  test('trusts JPEG MIME from iOS even when the filename still uses a HEIC extension', () => {
    expect(isHeicCandidate(new File(['image'], 'IMG_0001.HEIC', { type: 'image/jpeg' }))).toBe(false)
  })
})

test('compresses supported camera and library images directly to JPEG', async () => {
  const input = new File(['photo'], 'photo.png', { type: 'image/png' })
  const result = await compressPackingPhoto(input)

  expect(mocks.compress).toHaveBeenCalledWith(input, expect.objectContaining({
    fileType: 'image/jpeg', maxSizeMB: 4.5, maxWidthOrHeight: 2560,
  }))
  expect(result.type).toBe('image/jpeg')
})

test('rejects HEIC without loading a conversion library', async () => {
  await expect(compressPackingPhoto(new File(['heic'], 'photo.heic', { type: 'image/heic' })))
    .rejects.toBeInstanceOf(PackingImageConversionError)
  expect(mocks.compress).not.toHaveBeenCalled()
})
