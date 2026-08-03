import type { PackingPhoto } from './packing.api'

export const PACKING_ATLAS_TILE_SIZE = 512
export const PACKING_ATLAS_LABEL_HEIGHT = 40
export const PACKING_ATLAS_GAP = 8
export const PACKING_ATLAS_MAX_PHOTOS = 16

export type ClientPackingAtlas = {
  atlasNo: number
  firstSequenceNo: number
  lastSequenceNo: number
  width: number
  height: number
  sha256: string
  blob: Blob
}

export type PackingAtlasRange = {
  atlasNo: number
  firstPhotoIndex: number
  lastPhotoIndex: number
}

export function packingAtlasRanges(photoCount: number): PackingAtlasRange[] {
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > 100) {
    throw new Error('packing photo count is invalid')
  }
  return Array.from({ length: Math.ceil(photoCount / PACKING_ATLAS_MAX_PHOTOS) }, (_, index) => ({
    atlasNo: index + 1,
    firstPhotoIndex: index * PACKING_ATLAS_MAX_PHOTOS,
    lastPhotoIndex: Math.min(photoCount, (index + 1) * PACKING_ATLAS_MAX_PHOTOS) - 1,
  }))
}

export function packingAtlasGrid(photoCount: number) {
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > PACKING_ATLAS_MAX_PHOTOS) {
    throw new Error('packing atlas photo count is invalid')
  }
  const columns = Math.ceil(Math.sqrt(photoCount))
  return { columns, rows: Math.ceil(photoCount / columns) }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new Error('packing atlas WebP encoding is unavailable'))
        return
      }
      resolve(blob)
    }, 'image/webp', quality)
  })
}

async function blobSha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function buildClientPackingAtlases(
  photos: PackingPhoto[],
  downloadPhoto: (photo: PackingPhoto) => Promise<Blob>,
): Promise<ClientPackingAtlas[]> {
  const ordered = [...photos].sort((left, right) => left.sequence_no - right.sequence_no)
  if (ordered.length < 1 || ordered.length > 100) throw new Error('packing photo count is invalid')
  const atlases: ClientPackingAtlas[] = []

  for (const range of packingAtlasRanges(ordered.length)) {
    const group = ordered.slice(range.firstPhotoIndex, range.lastPhotoIndex + 1)
    const { columns, rows } = packingAtlasGrid(group.length)
    const cellHeight = PACKING_ATLAS_TILE_SIZE + PACKING_ATLAS_LABEL_HEIGHT
    const width = columns * PACKING_ATLAS_TILE_SIZE + (columns - 1) * PACKING_ATLAS_GAP
    const height = rows * cellHeight + (rows - 1) * PACKING_ATLAS_GAP
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('packing atlas canvas is unavailable')
    context.fillStyle = '#e8e2da'
    context.fillRect(0, 0, width, height)

    for (const [index, photo] of group.entries()) {
      const bitmap = await createImageBitmap(await downloadPhoto(photo), { imageOrientation: 'from-image' })
      try {
        const column = index % columns
        const row = Math.floor(index / columns)
        const left = column * (PACKING_ATLAS_TILE_SIZE + PACKING_ATLAS_GAP)
        const top = row * (cellHeight + PACKING_ATLAS_GAP)
        context.fillStyle = '#342d27'
        context.fillRect(left, top, PACKING_ATLAS_TILE_SIZE, PACKING_ATLAS_TILE_SIZE)
        const scale = Math.min(PACKING_ATLAS_TILE_SIZE / bitmap.width, PACKING_ATLAS_TILE_SIZE / bitmap.height)
        const drawWidth = Math.round(bitmap.width * scale)
        const drawHeight = Math.round(bitmap.height * scale)
        context.drawImage(
          bitmap,
          left + Math.floor((PACKING_ATLAS_TILE_SIZE - drawWidth) / 2),
          top + Math.floor((PACKING_ATLAS_TILE_SIZE - drawHeight) / 2),
          drawWidth,
          drawHeight,
        )
        context.fillStyle = '#342d27'
        context.fillRect(left, top + PACKING_ATLAS_TILE_SIZE, PACKING_ATLAS_TILE_SIZE, PACKING_ATLAS_LABEL_HEIGHT)
        context.fillStyle = '#fff'
        context.font = '700 20px sans-serif'
        context.textBaseline = 'middle'
        context.fillText(`P${String(photo.sequence_no).padStart(3, '0')}`, left + 16, top + PACKING_ATLAS_TILE_SIZE + 20)
      } finally {
        bitmap.close()
      }
    }

    let blob = await canvasBlob(canvas, 0.88)
    if (blob.size > 7_000_000) blob = await canvasBlob(canvas, 0.74)
    if (blob.size > 7_000_000) throw new Error('packing atlas is too large')
    atlases.push({
      atlasNo: range.atlasNo,
      firstSequenceNo: group[0]!.sequence_no,
      lastSequenceNo: group.at(-1)!.sequence_no,
      width,
      height,
      sha256: await blobSha256(blob),
      blob,
    })
  }
  return atlases
}
