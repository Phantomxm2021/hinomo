import { expect, test } from 'vitest'
import { assertPhotoUploadSize, PHOTO_UPLOAD_MAX_BYTES } from './photo-compression'

test('accepts regular photos at the 500 KB hard limit', () => {
  expect(() => assertPhotoUploadSize(new Blob([new Uint8Array(PHOTO_UPLOAD_MAX_BYTES)]))).not.toThrow()
})

test('rejects regular photos above the 500 KB hard limit', () => {
  expect(() => assertPhotoUploadSize(new Blob([new Uint8Array(PHOTO_UPLOAD_MAX_BYTES + 1)])))
    .toThrow('compressed photo exceeds 500000 bytes')
})
