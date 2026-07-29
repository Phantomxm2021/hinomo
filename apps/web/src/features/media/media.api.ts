import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

type MediaKind = Database['public']['Enums']['media_kind']

export async function createMediaUpload(input: {
  boxId: string
  itemId: string | null
  kind: MediaKind
  mimeType: string
  sizeBytes: number
}) {
  const { data, error } = await supabase.rpc('create_media_upload', {
    p_box_id: input.boxId,
    p_item_id: input.itemId,
    p_media_kind: input.kind,
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
  })
  if (error) throw error
  const session = data?.[0]
  if (!session) throw new Error('media upload session was not created')
  return session
}

export async function confirmMediaUpload(uploadId: string) {
  const { error } = await supabase.rpc('confirm_media_upload', {
    p_upload_id: uploadId,
  })
  if (error) throw error
}

export async function createMediaDownload(objectKey: string) {
  const { data, error } = await supabase.rpc('create_media_download', {
    p_object_key: objectKey,
  })
  if (error) throw error
  const download = data?.[0]
  if (!download) throw new Error('media download URL was not created')
  return download
}
