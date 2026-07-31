export const PRINT_SHEET_MM = {
  width: 210,
  height: 297,
} as const

const PRINT_LABEL_COLUMNS = 2
const PRINT_LABEL_ROWS = 4

export const PRINT_LABEL_MM = {
  width: 92.5,
  height: 64,
  left: 10,
  top: 10,
  columnStep: 97.5,
  rowStep: 69,
  columns: PRINT_LABEL_COLUMNS,
  rows: PRINT_LABEL_ROWS,
  perPage: PRINT_LABEL_COLUMNS * PRINT_LABEL_ROWS,
} as const

const PRINT_PIXELS_PER_MM = 10

export const PRINT_LABEL_CANVAS_PX = {
  pixelsPerMm: PRINT_PIXELS_PER_MM,
  width: PRINT_LABEL_MM.width * PRINT_PIXELS_PER_MM,
  height: PRINT_LABEL_MM.height * PRINT_PIXELS_PER_MM,
} as const

export const PRINT_LABEL_COLORS = {
  surface: '#fffdf8',
  line: '#e3d5c5',
  ink: '#30271e',
  brand: '#df6538',
  muted: '#756a5e',
} as const

export function labelPlacementMm(index: number) {
  const column = index % PRINT_LABEL_MM.columns
  const row = Math.floor(index / PRINT_LABEL_MM.columns)
  return {
    left: PRINT_LABEL_MM.left + column * PRINT_LABEL_MM.columnStep,
    top: PRINT_LABEL_MM.top + row * PRINT_LABEL_MM.rowStep,
    width: PRINT_LABEL_MM.width,
    height: PRINT_LABEL_MM.height,
  }
}

export function labelPlacementPercent(index: number) {
  const placement = labelPlacementMm(index)
  return {
    left: `${placement.left / PRINT_SHEET_MM.width * 100}%`,
    top: `${placement.top / PRINT_SHEET_MM.height * 100}%`,
    width: `${placement.width / PRINT_SHEET_MM.width * 100}%`,
    height: `${placement.height / PRINT_SHEET_MM.height * 100}%`,
  }
}
