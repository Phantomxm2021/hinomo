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

export async function compressPackingPhoto(file: File): Promise<File> {
  if (isHeicCandidate(file)) {
    throw new PackingImageConversionError('HEIC input is not accepted')
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 4.5,
    maxWidthOrHeight: 2560,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.88,
  })
  if (compressed.type !== 'image/jpeg') {
    throw new PackingImageConversionError('JPEG encoding is unavailable')
  }
  return compressed
}
