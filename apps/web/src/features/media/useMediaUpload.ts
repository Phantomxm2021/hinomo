import imageCompression from 'browser-image-compression'
import { useCallback, useState } from 'react'
import {
  assertPhotoUploadSize,
  PHOTO_UPLOAD_INITIAL_QUALITY,
  PHOTO_UPLOAD_MAX_DIMENSION,
  PHOTO_UPLOAD_MAX_ITERATIONS,
  PHOTO_UPLOAD_MAX_SIZE_MB,
} from '../../lib/photo-compression'
import { confirmMediaUpload, createMediaUpload } from './media.api'

export type UploadStage =
  | 'idle'
  | 'compressing'
  | 'signing'
  | 'uploading'
  | 'confirming'
  | 'complete'
  | 'error'

type UploadInput = {
  file: File
  boxId: string
  itemId: string | null
  kind: 'cover' | 'item'
}

export function useMediaUpload() {
  const [stage, setStage] = useState<UploadStage>('idle')

  const upload = useCallback(async (input: UploadInput) => {
    try {
      setStage('compressing')
      const compressed = await imageCompression(input.file, {
        fileType: 'image/jpeg',
        initialQuality: PHOTO_UPLOAD_INITIAL_QUALITY,
        maxSizeMB: PHOTO_UPLOAD_MAX_SIZE_MB,
        maxWidthOrHeight: PHOTO_UPLOAD_MAX_DIMENSION,
        maxIteration: PHOTO_UPLOAD_MAX_ITERATIONS,
        useWebWorker: true,
      })
      assertPhotoUploadSize(compressed)

      setStage('signing')
      const session = await createMediaUpload({
        boxId: input.boxId,
        itemId: input.itemId,
        kind: input.kind,
        mimeType: compressed.type,
        sizeBytes: compressed.size,
      })

      setStage('uploading')
      const response = await fetch(session.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      })
      if (!response.ok) throw new Error('R2 upload failed')

      setStage('confirming')
      await confirmMediaUpload(session.upload_id)
      setStage('complete')
      return session.object_key
    } catch (error) {
      console.error('media_upload_failed', {
        boxId: input.boxId,
        itemId: input.itemId,
        kind: input.kind,
        error,
      })
      setStage('error')
      throw error
    }
  }, [])

  const reset = useCallback(() => setStage('idle'), [])
  return { stage, upload, reset }
}
