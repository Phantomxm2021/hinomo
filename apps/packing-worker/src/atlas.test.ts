import { describe, expect, test } from 'vitest'
import {
  ATLAS_LABEL_HEIGHT,
  ATLAS_TILE_SIZE,
  atlasDimensions,
  atlasGridSize,
  atlasLabel,
  paddedCrop,
  validateNormalizedBox,
} from './atlas.js'

describe('Cloudflare Images atlas layout', () => {
  test.each([
    [1, 1, 1],
    [2, 2, 1],
    [4, 2, 2],
    [9, 3, 3],
    [16, 4, 4],
  ])('places %i photos in a %i by %i grid', (count, columns, rows) => {
    expect(atlasGridSize(count)).toEqual({ columns, rows })
  })

  test('uses the smallest labelled canvas for the final partial atlas', () => {
    expect(atlasDimensions(2)).toEqual({
      columns: 2,
      rows: 1,
      width: ATLAS_TILE_SIZE * 2 + 8,
      height: ATLAS_TILE_SIZE + ATLAS_LABEL_HEIGHT,
    })
    expect(atlasLabel(17)).toBe('P017')
  })

  test('rejects an empty or oversized group', () => {
    expect(() => atlasGridSize(0)).toThrow('atlas_photo_count_invalid')
    expect(() => atlasGridSize(17)).toThrow('atlas_photo_count_invalid')
  })
})

test('validates and pads normalized boxes before Cloudflare Images trim', () => {
  expect(validateNormalizedBox([0.1, 0.2, 0.8, 0.9])).toEqual([0.1, 0.2, 0.8, 0.9])
  expect(() => validateNormalizedBox([0.8, 0.2, 0.1, 0.9])).toThrow('localization_bbox_out_of_bounds')
  expect(() => validateNormalizedBox([-0.1, 0.2, 0.8, 0.9])).toThrow('localization_bbox_out_of_bounds')

  const crop = paddedCrop([0.25, 0.25, 0.75, 0.75])
  expect(crop.bbox).toEqual([0.25, 0.25, 0.75, 0.75])
  for (const value of Object.values(crop.trim)) expect(value).toBeCloseTo(0.18)
})
