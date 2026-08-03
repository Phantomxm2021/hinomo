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

test('normalizes an iPhone JPEG with an empty MIME type before compression', async () => {
  const input = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'IMG_0001.JPG', { type: '' })

  await compressPackingPhoto(input)

  expect(mocks.compress).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/jpeg' }), expect.any(Object))
})

test('detects HEIC bytes even when iOS labels the file as JPEG', async () => {
  const input = new File([new Uint8Array([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63,
  ])], 'IMG_0001.HEIC', { type: 'image/jpeg' })

  await expect(compressPackingPhoto(input)).rejects.toMatchObject({ code: 'heic_not_supported' })
  expect(mocks.compress).not.toHaveBeenCalled()
})

test('rejects HEIC without loading a conversion library', async () => {
  await expect(compressPackingPhoto(new File(['heic'], 'photo.heic', { type: 'image/heic' })))
    .rejects.toBeInstanceOf(PackingImageConversionError)
  expect(mocks.compress).not.toHaveBeenCalled()
})
