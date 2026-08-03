import sharp from 'sharp'
import { describe, expect, test } from 'vitest'
import {
  ATLAS_LABEL_HEIGHT,
  ATLAS_TILE_SIZE,
  atlasGridSize,
  buildPackingAtlas,
  cropPackingItem,
  validateNormalizedBox,
} from './atlas.js'

async function image(width: number, height: number, color: string): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).webp().toBuffer()
}

describe('atlasGridSize', () => {
  test.each([
    [1, 1, 1],
    [2, 2, 1],
    [4, 2, 2],
    [9, 3, 3],
    [16, 4, 4],
  ])('places %i photos in a %i by %i grid', (count, columns, rows) => {
    expect(atlasGridSize(count)).toEqual({ columns, rows })
  })

  test('rejects an empty or oversized group', () => {
    expect(() => atlasGridSize(0)).toThrow('atlas_photo_count_invalid')
    expect(() => atlasGridSize(17)).toThrow('atlas_photo_count_invalid')
  })
})

test('builds a labelled atlas without cropping portrait and landscape sources', async () => {
  const result = await buildPackingAtlas([
    { id: 'one', sequence_no: 1, buffer: await image(300, 600, '#ff0000') },
    { id: 'two', sequence_no: 2, buffer: await image(800, 300, '#00ff00') },
  ])
  const metadata = await sharp(result.buffer).metadata()

  expect(metadata.width).toBe(ATLAS_TILE_SIZE * 2 + 8)
  expect(metadata.height).toBe(ATLAS_TILE_SIZE + ATLAS_LABEL_HEIGHT)
  expect(result.sha256).toMatch(/^[0-9a-f]{64}$/)
})

test('validates normalized boxes before deterministic cropping', async () => {
  expect(validateNormalizedBox([0.1, 0.2, 0.8, 0.9])).toEqual([0.1, 0.2, 0.8, 0.9])
  expect(() => validateNormalizedBox([0.8, 0.2, 0.1, 0.9])).toThrow('localization_bbox_out_of_bounds')
  expect(() => validateNormalizedBox([-0.1, 0.2, 0.8, 0.9])).toThrow('localization_bbox_out_of_bounds')

  const result = await cropPackingItem(await image(1000, 800, '#336699'), [0.25, 0.25, 0.75, 0.75])
  expect(result.width).toBeGreaterThan(0)
  expect(result.height).toBeGreaterThan(0)
  expect(result.bbox).toEqual([0.25, 0.25, 0.75, 0.75])
})
