export const PHOTO_UPLOAD_MAX_BYTES = 500_000
export const PHOTO_UPLOAD_MAX_SIZE_MB = PHOTO_UPLOAD_MAX_BYTES / (1024 * 1024)
export const PHOTO_UPLOAD_MAX_DIMENSION = 1920
export const PHOTO_UPLOAD_INITIAL_QUALITY = 0.8
export const PHOTO_UPLOAD_MAX_ITERATIONS = 15

export function assertPhotoUploadSize(blob: Blob) {
  if (blob.size > PHOTO_UPLOAD_MAX_BYTES) {
    throw new Error(`compressed photo exceeds ${PHOTO_UPLOAD_MAX_BYTES} bytes`)
  }
}
