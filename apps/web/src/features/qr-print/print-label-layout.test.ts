import { expect, test } from 'vitest'
import {
  PRINT_LABEL_CANVAS_PX,
  PRINT_LABEL_COLORS,
  PRINT_LABEL_MM,
  PRINT_SHEET_MM,
  labelPlacementMm,
  labelPlacementPercent,
} from './print-label-layout'

test('defines the fixed A4 and eight-label geometry used by preview and PDF', () => {
  expect(PRINT_SHEET_MM).toEqual({ width: 210, height: 297 })
  expect(PRINT_LABEL_MM).toEqual({
    width: 92.5,
    height: 64,
    left: 10,
    top: 10,
    columnStep: 97.5,
    rowStep: 69,
    columns: 2,
    rows: 4,
    perPage: 8,
  })
  expect(labelPlacementMm(0)).toEqual({ left: 10, top: 10, width: 92.5, height: 64 })
  expect(labelPlacementMm(7)).toEqual({ left: 107.5, top: 217, width: 92.5, height: 64 })
  expect(PRINT_LABEL_MM.perPage).toBe(PRINT_LABEL_MM.columns * PRINT_LABEL_MM.rows)
})

test('defines an integer ten-pixels-per-millimetre canvas with the exact label ratio', () => {
  expect(PRINT_LABEL_CANVAS_PX).toEqual({ pixelsPerMm: 10, width: 925, height: 640 })
  expect(PRINT_LABEL_CANVAS_PX.width / PRINT_LABEL_CANVAS_PX.height)
    .toBe(PRINT_LABEL_MM.width / PRINT_LABEL_MM.height)
})

test('expresses PDF millimetre placement as exact A4 preview percentages', () => {
  expect(labelPlacementPercent(1)).toEqual({
    left: `${107.5 / 210 * 100}%`,
    top: `${10 / 297 * 100}%`,
    width: `${92.5 / 210 * 100}%`,
    height: `${64 / 297 * 100}%`,
  })
})

test('defines the warm print palette once', () => {
  expect(PRINT_LABEL_COLORS).toEqual({
    surface: '#fffdf8',
    line: '#e3d5c5',
    ink: '#30271e',
    brand: '#df6538',
    muted: '#756a5e',
  })
})
