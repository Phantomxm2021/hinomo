import { describe, expect, it } from 'vitest'
import { deriveItemAvailability, formatItemAvailability } from './item-movement-status'

describe('item availability', () => {
  it.each([
    [3, 3, 'stored', 0],
    [3, 1, 'partial', 2],
    [1, 0, 'out', 1],
  ] as const)('derives %s total and %s stored', (total, stored, availability, out) => {
    const status = deriveItemAvailability(total, stored)
    expect(status).toEqual({
      availability,
      outQuantity: out,
      storedQuantity: stored,
      totalQuantity: total,
    })
    expect(formatItemAvailability(status)).toEqual(expect.objectContaining({ key: expect.any(String), params: expect.any(Object) }))
  })

  it('treats a missing stored quantity as fully stored for staged deployments', () => {
    expect(deriveItemAvailability(2)).toMatchObject({ availability: 'stored', storedQuantity: 2 })
  })

  it('formats the same domain state independently for English', () => {
    expect(formatItemAvailability(deriveItemAvailability(4, 2))).toEqual({
      key: 'itemMovement.availability.partial',
      params: { stored: 2, total: 4 },
    })
  })

  it.each([[0, 0], [2, -1], [2, 3], [2, 1.5]])('rejects invalid quantities (%s, %s)', (total, stored) => {
    expect(() => deriveItemAvailability(total, stored)).toThrow(RangeError)
  })
})
