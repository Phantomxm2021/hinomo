import { describe, expect, it } from 'vitest'
import { deriveItemAvailability, formatItemAvailability } from './item-movement-status'

describe('item availability', () => {
  it.each([
    [3, 3, 'stored', 0, '在位 · 3/3'],
    [3, 1, 'partial', 2, '部分取出 · 1/3 在箱中'],
    [1, 0, 'out', 1, '已取出 · 0/1 在箱中'],
  ] as const)('derives %s total and %s stored', (total, stored, availability, out, label) => {
    const status = deriveItemAvailability(total, stored)
    expect(status).toEqual({
      availability,
      outQuantity: out,
      storedQuantity: stored,
      totalQuantity: total,
    })
    expect(formatItemAvailability(status)).toBe(label)
  })

  it('treats a missing stored quantity as fully stored for staged deployments', () => {
    expect(deriveItemAvailability(2)).toMatchObject({ availability: 'stored', storedQuantity: 2 })
  })

  it('formats the same domain state independently for English', () => {
    expect(formatItemAvailability(deriveItemAvailability(4, 2), 'en')).toBe('Partially out · 2/4 stored')
  })

  it.each([[0, 0], [2, -1], [2, 3], [2, 1.5]])('rejects invalid quantities (%s, %s)', (total, stored) => {
    expect(() => deriveItemAvailability(total, stored)).toThrow(RangeError)
  })
})
