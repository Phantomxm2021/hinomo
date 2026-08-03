import imageCompression from 'browser-image-compression'

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])
const HEIC_FILE_PATTERN = /\.(heic|heif)$/i
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

export type PackingImageErrorCode = 'heic_not_supported' | 'unsupported_image' | 'jpeg_encoding_failed'

export class PackingImageConversionError extends Error {
  readonly code: PackingImageErrorCode

  constructor(code: PackingImageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PackingImageConversionError'
    this.code = code
  }
}

export function isHeicCandidate(file: File) {
  const mimeType = file.type.toLowerCase()
  // iOS can honor `accept="image/jpeg"` while preserving the original .HEIC
  // filename. An explicit JPEG MIME type is the authoritative signal here.
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return false
  return HEIC_MIME_TYPES.has(mimeType) || HEIC_FILE_PATTERN.test(file.name)
}

function readHeader(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('image header could not be read'))
    reader.readAsArrayBuffer(file.slice(0, 32))
  })
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end))
}

async function detectImageMimeType(file: File) {
  const bytes = await readHeader(file)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'image/png'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp'
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brands = ascii(bytes, 8, bytes.length)
    if (/(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(brands)) return 'image/heic'
  }
  const declaredType = file.type.toLowerCase()
  return SUPPORTED_MIME_TYPES.has(declaredType) ? declaredType : null
}

async function normalizePackingImage(file: File) {
  const detectedType = await detectImageMimeType(file)
  if (detectedType === 'image/heic' || (detectedType === null && isHeicCandidate(file))) {
    throw new PackingImageConversionError('heic_not_supported', 'HEIC input is not accepted')
  }
  if (!detectedType) {
    throw new PackingImageConversionError('unsupported_image', 'The selected file is not a supported image')
  }
  const normalizedType = detectedType === 'image/jpg' ? 'image/jpeg' : detectedType
  if (file.type === normalizedType) return file
  return new File([file], file.name, { type: normalizedType, lastModified: file.lastModified })
}

export async function compressPackingPhoto(file: File): Promise<File> {
  const normalized = await normalizePackingImage(file)

  let compressed: File
  try {
    compressed = await imageCompression(normalized, {
      maxSizeMB: 4.5,
      maxWidthOrHeight: 2560,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.88,
    })
  } catch (error) {
    throw new PackingImageConversionError('jpeg_encoding_failed', 'The browser could not encode this image as JPEG', { cause: error })
  }
  if (compressed.type !== 'image/jpeg') {
    throw new PackingImageConversionError('jpeg_encoding_failed', 'JPEG encoding is unavailable')
  }
  return compressed
}
