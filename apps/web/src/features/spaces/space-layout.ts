import type { SpacePosition } from './spaces.api'

const snap = (value: number) => Math.round(value / 2) * 2
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, snap(value)))

export function constrainResize(
  position: SpacePosition,
  widthDelta: number,
  heightDelta: number,
): SpacePosition {
  return {
    ...position,
    width: clamp(position.width + widthDelta, 12, 100 - position.x),
    height: clamp(position.height + heightDelta, 12, 100 - position.y),
  }
}

export function autoSpaceLayout(index: number, total: number): SpacePosition {
  const columns = total <= 1 ? 1 : 2
  const rows = Math.ceil(total / columns)
  const width = columns === 1 ? 60 : Math.floor((92 - (columns - 1) * 4) / columns)
  const height = rows === 1 ? 42 : Math.max(10, Math.min(42, Math.floor((92 - (rows - 1) * 4) / rows)))
  const column = index % columns
  const row = Math.floor(index / columns)
  return {
    x: columns === 1 ? 20 : 4 + column * (width + 4),
    y: rows === 1 ? 29 : 4 + row * (height + 4),
    width,
    height,
  }
}
