import { expect, test } from 'vitest'
import { createBoxSchema } from './box.schema'

test('uses translated validation copy for box fields', () => {
  const schema = createBoxSchema((key) => `EN:${key}`)
  const result = schema.safeParse({ space_id: '', name: '', category: 'x'.repeat(81), location: '', description: '', visibility: 'private' })
  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
    'EN:validation.spaceRequired',
    'EN:validation.boxNameRequired',
    'EN:validation.categoryMax',
  ]))
})
