import imageCompression from 'browser-image-compression'
import { useCallback, useState } from 'react'
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
        maxSizeMB: 4.5,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
      })

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
      setStage('error')
      throw error
    }
  }, [])

  const reset = useCallback(() => setStage('idle'), [])
  return { stage, upload, reset }
}
