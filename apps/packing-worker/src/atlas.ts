import type { PackingPhoto } from './types.js'
import type { PackingImageInfo, PackingImagesBinding, PackingImageTransform } from './cloudflare.js'

export const ATLAS_TILE_SIZE = 512
export const ATLAS_LABEL_HEIGHT = 40
export const ATLAS_GAP = 8
export const ATLAS_MAX_PHOTOS = 16
export const MODEL_IMAGE_MAX_BYTES = 7_000_000

export type AtlasSource = Pick<PackingPhoto, 'id' | 'sequence_no'> & { stream: ReadableStream<Uint8Array> }

function bytesStream(bytes: Uint8Array<ArrayBuffer>): ReadableStream<Uint8Array> {
  return new Response(bytes).body!
}

function svgStream(svg: string): ReadableStream<Uint8Array> {
  return bytesStream(new TextEncoder().encode(svg))
}

async function responseBytes(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await response.arrayBuffer())
}

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function constrainModelImage(images: PackingImagesBinding, buffer: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (buffer.byteLength <= MODEL_IMAGE_MAX_BYTES) return buffer
  const recompressed = await images.input(bytesStream(buffer))
    .output({ format: 'image/webp', quality: 75, anim: false })
  const result = await responseBytes(recompressed.response())
  if (result.byteLength > MODEL_IMAGE_MAX_BYTES) throw new Error('model_image_size_limit_exceeded')
  return result
}

function imageDimensions(info: PackingImageInfo): { width: number; height: number } {
  if (!info.width || !info.height) throw new Error('image_dimensions_missing')
  return { width: info.width, height: info.height }
}

export function atlasGridSize(photoCount: number): { columns: number; rows: number } {
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > ATLAS_MAX_PHOTOS) {
    throw new Error('atlas_photo_count_invalid')
  }
  const columns = Math.ceil(Math.sqrt(photoCount))
  return { columns, rows: Math.ceil(photoCount / columns) }
}

export function atlasDimensions(photoCount: number): { width: number; height: number; columns: number; rows: number } {
  const { columns, rows } = atlasGridSize(photoCount)
  const cellHeight = ATLAS_TILE_SIZE + ATLAS_LABEL_HEIGHT
  return {
    columns,
    rows,
    width: columns * ATLAS_TILE_SIZE + (columns - 1) * ATLAS_GAP,
    height: rows * cellHeight + (rows - 1) * ATLAS_GAP,
  }
}

export function atlasLabel(sequenceNo: number): string {
  if (!Number.isInteger(sequenceNo) || sequenceNo < 1 || sequenceNo > 999) throw new Error('atlas_sequence_invalid')
  return `P${String(sequenceNo).padStart(3, '0')}`
}

function canvasSvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#e8e2da"/></svg>`
}

function labelSvg(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS_TILE_SIZE}" height="${ATLAS_LABEL_HEIGHT}" viewBox="0 0 ${ATLAS_TILE_SIZE} ${ATLAS_LABEL_HEIGHT}"><rect width="100%" height="100%" fill="#342d27"/><text x="16" y="27" font-size="20" font-weight="700" fill="#fff" font-family="sans-serif">${label}</text></svg>`
}

export async function normalizePackingPhoto(images: PackingImagesBinding, source: ReadableStream<Uint8Array>): Promise<{
  buffer: Uint8Array<ArrayBuffer>
  width: number
  height: number
  sha256: string
}> {
  const transformed = await images.input(source)
    .transform({ width: 2560, height: 2560, fit: 'scale-down' })
    .output({ format: 'image/webp', quality: 88, anim: false })
  const buffer = await constrainModelImage(images, await responseBytes(transformed.response()))
  const dimensions = imageDimensions(await images.info(bytesStream(buffer)))
  return { buffer, ...dimensions, sha256: await sha256(buffer) }
}

export async function buildPackingAtlas(images: PackingImagesBinding, sources: AtlasSource[]): Promise<{
  buffer: Uint8Array<ArrayBuffer>
  width: number
  height: number
  sha256: string
}> {
  const { columns, width, height } = atlasDimensions(sources.length)
  const cellHeight = ATLAS_TILE_SIZE + ATLAS_LABEL_HEIGHT
  let canvas = images.input(svgStream(canvasSvg(width, height)))

  for (const [index, source] of sources.entries()) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const left = column * (ATLAS_TILE_SIZE + ATLAS_GAP)
    const top = row * (cellHeight + ATLAS_GAP)
    const tile = images.input(source.stream).transform({
      width: ATLAS_TILE_SIZE,
      height: ATLAS_TILE_SIZE,
      fit: 'pad',
      background: '#342d27',
    })
    canvas = canvas.draw(tile, { left, top })
      .draw(svgStream(labelSvg(atlasLabel(source.sequence_no))), { left, top: top + ATLAS_TILE_SIZE })
  }

  const output = await canvas.output({ format: 'image/webp', quality: 88, anim: false })
  const buffer = await constrainModelImage(images, await responseBytes(output.response()))
  return { buffer, width, height, sha256: await sha256(buffer) }
}

export function normalizedObjectKey(photo: PackingPhoto): string {
  return `users/${photo.owner_id}/boxes/${photo.box_id}/packing/${photo.session_id}/normalized/${photo.id}.webp`
}

export function atlasObjectKey(input: { ownerId: string; boxId: string; sessionId: string; atlasNo: number }): string {
  return `users/${input.ownerId}/boxes/${input.boxId}/packing/${input.sessionId}/atlas/${String(input.atlasNo).padStart(3, '0')}.webp`
}

export type NormalizedBox = [number, number, number, number]

export function validateNormalizedBox(value: unknown): NormalizedBox {
  if (!Array.isArray(value) || value.length !== 4 || value.some((coordinate) => typeof coordinate !== 'number' || !Number.isFinite(coordinate))) {
    throw new Error('localization_bbox_invalid')
  }
  const [xMin, yMin, xMax, yMax] = value
  if (xMin < 0 || yMin < 0 || xMax > 1 || yMax > 1 || xMin >= xMax || yMin >= yMax) {
    throw new Error('localization_bbox_out_of_bounds')
  }
  if ((xMax - xMin) * (yMax - yMin) < 0.0004) throw new Error('localization_bbox_too_small')
  return [xMin, yMin, xMax, yMax]
}

export function paddedCrop(value: unknown, paddingRatio = 0.14): { bbox: NormalizedBox; trim: NonNullable<PackingImageTransform['trim']> } {
  const bbox = validateNormalizedBox(value)
  const [xMin, yMin, xMax, yMax] = bbox
  const boxWidth = xMax - xMin
  const boxHeight = yMax - yMin
  const left = Math.max(0, xMin - boxWidth * paddingRatio)
  const top = Math.max(0, yMin - boxHeight * paddingRatio)
  const right = Math.max(0, 1 - Math.min(1, xMax + boxWidth * paddingRatio))
  const bottom = Math.max(0, 1 - Math.min(1, yMax + boxHeight * paddingRatio))
  return { bbox, trim: { top, right, bottom, left } }
}

export async function cropPackingItem(images: PackingImagesBinding, source: ReadableStream<Uint8Array>, rawBox: unknown): Promise<{
  buffer: Uint8Array<ArrayBuffer>
  width: number
  height: number
  bbox: NormalizedBox
}> {
  const { bbox, trim } = paddedCrop(rawBox)
  const transformed = await images.input(source)
    .transform({ trim })
    .transform({ width: 1024, height: 1024, fit: 'scale-down' })
    .output({ format: 'image/webp', quality: 88, anim: false })
  const buffer = await responseBytes(transformed.response())
  const dimensions = imageDimensions(await images.info(bytesStream(buffer)))
  return { buffer, ...dimensions, bbox }
}

export function itemCropObjectKey(input: { ownerId: string; boxId: string; sessionId: string; itemId: string }): string {
  return `users/${input.ownerId}/boxes/${input.boxId}/packing/${input.sessionId}/items/${input.itemId}.webp`
}
