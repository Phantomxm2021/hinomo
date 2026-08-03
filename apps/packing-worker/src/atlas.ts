import { createHash } from 'node:crypto'
import sharp from 'sharp'
import type { PackingPhoto } from './types.js'

export const ATLAS_TILE_SIZE = 512
export const ATLAS_LABEL_HEIGHT = 40
export const ATLAS_GAP = 8
export const ATLAS_MAX_PHOTOS = 16

export type AtlasSource = Pick<PackingPhoto, 'id' | 'sequence_no'> & { buffer: Buffer }

export function atlasGridSize(photoCount: number): { columns: number; rows: number } {
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > ATLAS_MAX_PHOTOS) {
    throw new Error('atlas_photo_count_invalid')
  }
  const columns = Math.ceil(Math.sqrt(photoCount))
  return { columns, rows: Math.ceil(photoCount / columns) }
}

function labelSvg(label: string): Buffer {
  const safeLabel = label.replace(/[<>&"']/g, '')
  return Buffer.from(`<svg width="${ATLAS_TILE_SIZE}" height="${ATLAS_LABEL_HEIGHT}">
    <rect width="100%" height="100%" fill="#342d27" />
    <text x="16" y="27" font-size="20" font-weight="700" fill="#ffffff" font-family="sans-serif">${safeLabel}</text>
  </svg>`)
}

export async function normalizePackingPhoto(source: Buffer): Promise<{
  buffer: Buffer
  width: number
  height: number
  sha256: string
}> {
  const normalized = await sharp(source)
    .rotate()
    .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer({ resolveWithObject: true })
  return {
    buffer: normalized.data,
    width: normalized.info.width,
    height: normalized.info.height,
    sha256: createHash('sha256').update(normalized.data).digest('hex'),
  }
}

export async function buildPackingAtlas(sources: AtlasSource[]): Promise<{
  buffer: Buffer
  width: number
  height: number
  sha256: string
}> {
  const { columns, rows } = atlasGridSize(sources.length)
  const cellHeight = ATLAS_TILE_SIZE + ATLAS_LABEL_HEIGHT
  const width = columns * ATLAS_TILE_SIZE + (columns - 1) * ATLAS_GAP
  const height = rows * cellHeight + (rows - 1) * ATLAS_GAP
  const composites: sharp.OverlayOptions[] = []

  for (const [index, source] of sources.entries()) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const left = column * (ATLAS_TILE_SIZE + ATLAS_GAP)
    const top = row * (cellHeight + ATLAS_GAP)
    const tile = await sharp(source.buffer)
      .resize(ATLAS_TILE_SIZE, ATLAS_TILE_SIZE, {
        fit: 'contain',
        background: { r: 52, g: 45, b: 39, alpha: 1 },
      })
      .webp({ quality: 88 })
      .toBuffer()
    composites.push({ input: tile, left, top })
    composites.push({ input: labelSvg(`P${String(source.sequence_no).padStart(3, '0')}`), left, top: top + ATLAS_TILE_SIZE })
  }

  const atlas = await sharp({
    create: { width, height, channels: 3, background: { r: 232, g: 226, b: 218 } },
  }).composite(composites).webp({ quality: 88, effort: 4 }).toBuffer()

  return { buffer: atlas, width, height, sha256: createHash('sha256').update(atlas).digest('hex') }
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

export async function cropPackingItem(source: Buffer, rawBox: unknown, paddingRatio = 0.14): Promise<{
  buffer: Buffer
  width: number
  height: number
  bbox: NormalizedBox
}> {
  const bbox = validateNormalizedBox(rawBox)
  const metadata = await sharp(source).metadata()
  if (!metadata.width || !metadata.height) throw new Error('crop_source_dimensions_missing')
  const [xMin, yMin, xMax, yMax] = bbox
  const boxWidth = xMax - xMin
  const boxHeight = yMax - yMin
  const paddedXMin = Math.max(0, xMin - boxWidth * paddingRatio)
  const paddedYMin = Math.max(0, yMin - boxHeight * paddingRatio)
  const paddedXMax = Math.min(1, xMax + boxWidth * paddingRatio)
  const paddedYMax = Math.min(1, yMax + boxHeight * paddingRatio)
  const left = Math.floor(paddedXMin * metadata.width)
  const top = Math.floor(paddedYMin * metadata.height)
  const width = Math.max(1, Math.ceil(paddedXMax * metadata.width) - left)
  const height = Math.max(1, Math.ceil(paddedYMax * metadata.height) - top)
  const result = await sharp(source)
    .extract({ left, top, width: Math.min(width, metadata.width - left), height: Math.min(height, metadata.height - top) })
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer({ resolveWithObject: true })
  return { buffer: result.data, width: result.info.width, height: result.info.height, bbox }
}

export function itemCropObjectKey(input: { ownerId: string; boxId: string; sessionId: string; itemId: string }): string {
  return `users/${input.ownerId}/boxes/${input.boxId}/packing/${input.sessionId}/items/${input.itemId}.webp`
}
