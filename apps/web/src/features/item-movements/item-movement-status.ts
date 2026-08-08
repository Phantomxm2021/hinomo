export type ItemAvailability = 'stored' | 'partial' | 'out'

export type ItemAvailabilityStatus = {
  availability: ItemAvailability
  outQuantity: number
  storedQuantity: number
  totalQuantity: number
}

export type ItemAvailabilityCopy = {
  key: `itemMovement.availability.${ItemAvailability}`
  params: { stored: number; total: number }
}

export function deriveItemAvailability(
  totalQuantity: number,
  storedQuantity = totalQuantity,
): ItemAvailabilityStatus {
  if (!Number.isInteger(totalQuantity) || totalQuantity <= 0) {
    throw new RangeError('total quantity must be a positive integer')
  }
  if (!Number.isInteger(storedQuantity) || storedQuantity < 0 || storedQuantity > totalQuantity) {
    throw new RangeError('stored quantity must be an integer within the total quantity')
  }

  return {
    availability: storedQuantity === totalQuantity ? 'stored' : storedQuantity === 0 ? 'out' : 'partial',
    outQuantity: totalQuantity - storedQuantity,
    storedQuantity,
    totalQuantity,
  }
}

export function formatItemAvailability(
  status: ItemAvailabilityStatus,
): ItemAvailabilityCopy {
  return {
    key: `itemMovement.availability.${status.availability}`,
    params: { stored: status.storedQuantity, total: status.totalQuantity },
  }
}
