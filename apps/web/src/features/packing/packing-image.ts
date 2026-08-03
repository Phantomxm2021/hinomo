import imageCompression from 'browser-image-compression'

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])
const HEIC_FILE_PATTERN = /\.(heic|heif)$/i

export class PackingImageConversionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackingImageConversionError'
  }
}

export function isHeicCandidate(file: File) {
  return HEIC_MIME_TYPES.has(file.type.toLowerCase()) || HEIC_FILE_PATTERN.test(file.name)
}

async function decodeHeic(file: File): Promise<File> {
  const { heicTo, isHeic } = await import('heic-to/csp')
  if (!await isHeic(file)) throw new PackingImageConversionError('invalid HEIC image')
  try {
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.94 })
    const baseName = file.name.replace(HEIC_FILE_PATTERN, '') || 'packing-photo'
    return new File([jpeg], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch (error) {
    if (error instanceof PackingImageConversionError) throw error
    throw new PackingImageConversionError('HEIC image could not be decoded')
  }
}

async function encodeWebp(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 4.5,
    maxWidthOrHeight: 2560,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.88,
  })
  if (compressed.type !== 'image/webp') {
    throw new PackingImageConversionError('WebP encoding is unavailable')
  }
  return compressed
}

export async function compressPackingPhoto(file: File): Promise<File> {
  if (!isHeicCandidate(file)) return encodeWebp(file)

  // Safari 17+ can decode HEIC natively. Try that path first so Apple devices
  // do not download the optional 2.7 MB decoder chunk unless it is needed.
  try {
    return await encodeWebp(file)
  } catch {
    return encodeWebp(await decodeHeic(file))
  }
}
