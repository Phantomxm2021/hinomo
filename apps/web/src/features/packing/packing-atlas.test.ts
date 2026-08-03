import { describe, expect, test, vi } from 'vitest'
import { encodePackingAtlasCanvas, packingAtlasGrid, packingAtlasRanges } from './packing-atlas'

test('encodes client Atlases directly as JPEG for iPhone Canvas compatibility', async () => {
  const toBlob = vi.fn((callback: BlobCallback, type?: string) => callback(new Blob(['atlas'], { type })))
  const canvas = { toBlob } as unknown as HTMLCanvasElement

  const blob = await encodePackingAtlasCanvas(canvas, 0.82)

  expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82)
  expect(blob.type).toBe('image/jpeg')
})

describe('packingAtlasGrid', () => {
  test.each([
    [1, 1, 1],
    [2, 2, 1],
    [4, 2, 2],
    [9, 3, 3],
    [16, 4, 4],
  ])('lays out %i photos as %i × %i', (count, columns, rows) => {
    expect(packingAtlasGrid(count)).toEqual({ columns, rows })
  })

  test('rejects invalid group sizes', () => {
    expect(() => packingAtlasGrid(0)).toThrow()
    expect(() => packingAtlasGrid(17)).toThrow()
  })
})

describe('packingAtlasRanges', () => {
  test.each([
    [17, [[1, 0, 15], [2, 16, 16]]],
    [32, [[1, 0, 15], [2, 16, 31]]],
    [50, [[1, 0, 15], [2, 16, 31], [3, 32, 47], [4, 48, 49]]],
    [100, [[1, 0, 15], [2, 16, 31], [3, 32, 47], [4, 48, 63], [5, 64, 79], [6, 80, 95], [7, 96, 99]]],
  ])('splits %i photos into stable groups', (count, expected) => {
    expect(packingAtlasRanges(count).map((range) => [range.atlasNo, range.firstPhotoIndex, range.lastPhotoIndex])).toEqual(expected)
  })
})
