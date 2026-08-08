import { expect, test } from 'vitest'
import { uploadStageLabel } from './media-ui'

test('returns a stable translation key for each upload stage', () => {
  expect(uploadStageLabel('compressing')).toBe('media.upload.compressing')
  expect(uploadStageLabel('signing')).toBe('media.upload.signing')
  expect(uploadStageLabel('uploading')).toBe('media.upload.uploading')
  expect(uploadStageLabel('confirming')).toBe('media.upload.confirming')
  expect(uploadStageLabel('complete')).toBe('media.upload.complete')
})
