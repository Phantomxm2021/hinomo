import { expect, test } from 'vitest'
import { createSpaceSchema } from './space.schema'

test('uses translated validation copy for space fields', () => {
  const schema = createSpaceSchema((key) => `EN:${key}`)
  const result = schema.safeParse({ venue_id: '', name: '', description: 'x'.repeat(501) })
  expect(result.success).toBe(false)
  if (result.success) return
  expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
    'EN:validation.venueRequired',
    'EN:validation.spaceNameRequired',
    'EN:validation.descriptionMax',
  ]))
})
