import { expect, test } from 'vitest'
import { deserializePackingDraft, serializePackingDraft, type PackingDraft } from './packing-storage'

const draft: PackingDraft = {
  id: 'session-1:1',
  sessionId: 'session-1',
  sequenceNo: 1,
  blob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
  createdAt: '2026-08-04T00:00:00.000Z',
}

test('stores packing image bytes instead of a Blob for iPhone IndexedDB compatibility', async () => {
  const stored = await serializePackingDraft(draft)

  expect(stored).not.toHaveProperty('blob')
  expect(stored.blobBytes).toBeInstanceOf(ArrayBuffer)
  expect(stored.mimeType).toBe('image/jpeg')

  const restored = deserializePackingDraft(stored)
  expect(restored).toMatchObject({ id: draft.id, sessionId: draft.sessionId, sequenceNo: 1 })
  expect(restored.blob).toBeInstanceOf(Blob)
  expect(restored.blob.type).toBe('image/jpeg')
  expect(restored.blob.size).toBe(draft.blob.size)
})

test('continues to read legacy IndexedDB records that contain a Blob', () => {
  const restored = deserializePackingDraft(draft)

  expect(restored.blob).toBe(draft.blob)
})
