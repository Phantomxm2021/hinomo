export type NormalizedBox = [number, number, number, number]

export function validateNormalizedBox(value: unknown): NormalizedBox {
  if (!Array.isArray(value) || value.length !== 4 || value.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
    throw new Error('localization_bbox_invalid')
  }
  const numeric = value as number[]
  const usesQwenGrid = numeric.some((entry) => entry > 1)
  const [xMin, yMin, xMax, yMax] = (usesQwenGrid
    ? numeric.map((entry) => entry / 1000)
    : numeric) as NormalizedBox
  if (xMin < 0 || yMin < 0 || xMax > 1 || yMax > 1 || xMin >= xMax || yMin >= yMax) {
    throw new Error('localization_bbox_out_of_bounds')
  }
  if ((xMax - xMin) * (yMax - yMin) < 0.0004) throw new Error('localization_bbox_too_small')
  return [xMin, yMin, xMax, yMax]
}
