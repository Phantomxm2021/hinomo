import { ImageMagick, initializeImageMagick, MagickFormat, MagickGeometry } from '@imagemagick/magick-wasm'
import { validateNormalizedBox, type NormalizedBox } from './bbox.ts'

export { validateNormalizedBox, type NormalizedBox } from './bbox.ts'

const wasmBytes = await Deno.readFile(new URL('magick.wasm', import.meta.resolve('@imagemagick/magick-wasm')))
await initializeImageMagick(wasmBytes)

export function cropPackingItem(source: Uint8Array, rawBox: unknown, paddingRatio = 0.14): {
  bytes: Uint8Array
  width: number
  height: number
  bbox: NormalizedBox
} {
  const bbox = validateNormalizedBox(rawBox)
  return ImageMagick.read(source, (image) => {
    const [xMin, yMin, xMax, yMax] = bbox
    const boxWidth = xMax - xMin
    const boxHeight = yMax - yMin
    const left = Math.floor(Math.max(0, xMin - boxWidth * paddingRatio) * image.width)
    const top = Math.floor(Math.max(0, yMin - boxHeight * paddingRatio) * image.height)
    const right = Math.ceil(Math.min(1, xMax + boxWidth * paddingRatio) * image.width)
    const bottom = Math.ceil(Math.min(1, yMax + boxHeight * paddingRatio) * image.height)
    image.crop(new MagickGeometry(left, top, Math.max(1, right - left), Math.max(1, bottom - top)))
    const scale = Math.min(1, 1024 / image.width, 1024 / image.height)
    if (scale < 1) image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)))
    return {
      bytes: image.write(MagickFormat.WebP, (data) => Uint8Array.from(data)),
      width: image.width,
      height: image.height,
      bbox,
    }
  })
}

export function itemCropObjectKey(input: { ownerId: string; boxId: string; sessionId: string; itemId: string }): string {
  return `users/${input.ownerId}/boxes/${input.boxId}/packing/${input.sessionId}/items/${input.itemId}.webp`
}
