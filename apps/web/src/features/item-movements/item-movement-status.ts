export type ItemAvailability = 'stored' | 'partial' | 'out'

export type ItemAvailabilityStatus = {
  availability: ItemAvailability
  outQuantity: number
  storedQuantity: number
  totalQuantity: number
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
  locale: 'zh-CN' | 'en' = 'zh-CN',
) {
  const count = `${status.storedQuantity}/${status.totalQuantity}`
  if (locale === 'en') {
    if (status.availability === 'stored') return `Stored · ${count}`
    if (status.availability === 'partial') return `Partially out · ${count} stored`
    return `Out · ${count} stored`
  }

  if (status.availability === 'stored') return `在位 · ${count}`
  if (status.availability === 'partial') return `部分取出 · ${count} 在箱中`
  return `已取出 · ${count} 在箱中`
}
