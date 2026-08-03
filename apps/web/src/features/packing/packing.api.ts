import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { ClientPackingAtlas } from './packing-atlas'

export type PackingSession = Database['public']['Tables']['packing_sessions']['Row']
export type PackingPhoto = Database['public']['Tables']['packing_photos']['Row']
export type PackingDetectedItem = Database['public']['Tables']['packing_detected_items']['Row']

export async function getOrCreatePackingSession(boxId: string): Promise<PackingSession> {
  const { data: active, error: activeError } = await supabase
    .from('packing_sessions')
    .select('*')
    .eq('box_id', boxId)
    .in('status', ['capturing', 'uploading'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (activeError) throw activeError
  if (active) return active

  const { data, error } = await supabase.rpc('create_packing_session', { p_box_id: boxId })
  if (error) throw error
  if (!data) throw new Error('packing session was not created')
  return data
}

export async function listPackingPhotos(sessionId: string): Promise<PackingPhoto[]> {
  const { data, error } = await supabase
    .from('packing_photos')
    .select('*')
    .eq('session_id', sessionId)
    .order('sequence_no')
  if (error) throw error
  return data
}

export async function uploadPackingPhoto(input: {
  sessionId: string
  sequenceNo: number
  blob: Blob
}): Promise<void> {
  const { data, error } = await supabase.rpc('create_packing_photo_upload', {
    p_session_id: input.sessionId,
    p_sequence_no: input.sequenceNo,
    p_mime_type: input.blob.type,
    p_size_bytes: input.blob.size,
  })
  if (error) throw error
  const upload = data?.[0]
  if (!upload) throw new Error('packing photo upload was not created')

  const response = await fetch(upload.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': input.blob.type },
    body: input.blob,
  })
  if (!response.ok) throw new Error('packing photo upload failed')

  const { error: confirmError } = await supabase.rpc('confirm_packing_photo_upload', {
    p_photo_id: upload.photo_id,
  })
  if (confirmError) throw confirmError
}

export async function completePackingSession(sessionId: string): Promise<PackingSession> {
  const { data, error } = await supabase.rpc('complete_packing_session', { p_session_id: sessionId })
  if (error) throw error
  if (!data) throw new Error('packing session was not completed')
  return data
}

export async function downloadPackingPhoto(photo: PackingPhoto): Promise<Blob> {
  const download = await createPackingMediaDownload(photo.object_key)
  const response = await fetch(download.download_url)
  if (!response.ok) throw new Error('packing photo download failed')
  return response.blob()
}

export async function uploadPackingAtlas(sessionId: string, atlas: ClientPackingAtlas): Promise<void> {
  const { data, error } = await supabase.rpc('create_packing_atlas_upload', {
    p_session_id: sessionId,
    p_atlas_no: atlas.atlasNo,
    p_first_sequence_no: atlas.firstSequenceNo,
    p_last_sequence_no: atlas.lastSequenceNo,
    p_width: atlas.width,
    p_height: atlas.height,
    p_size_bytes: atlas.blob.size,
    p_sha256: atlas.sha256,
  })
  if (error) throw error
  const upload = data?.[0]
  if (!upload) throw new Error('packing atlas upload was not created')
  const response = await fetch(upload.upload_url, {
    method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: atlas.blob,
  })
  if (!response.ok) throw new Error('packing atlas upload failed')
  const { error: confirmError } = await supabase.rpc('confirm_packing_atlas_upload', { p_atlas_id: upload.atlas_id })
  if (confirmError) throw confirmError
}

export async function cancelPackingSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_packing_session', { p_session_id: sessionId })
  if (error) throw error
}

export async function listPackingSessions(boxId: string): Promise<PackingSession[]> {
  const { data, error } = await supabase
    .from('packing_sessions')
    .select('*')
    .eq('box_id', boxId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listDetectedPackingItems(boxId: string): Promise<PackingDetectedItem[]> {
  const { data, error } = await supabase
    .from('packing_detected_items')
    .select('*')
    .eq('box_id', boxId)
    .not('published_at', 'is', null)
    .not('review_status', 'in', '(dismissed,promoted)')
    .order('created_at')
  if (error) throw error
  return data
}

export async function updateDetectedPackingItem(
  itemId: string,
  input: Pick<PackingDetectedItem, 'name' | 'category' | 'description' | 'quantity_kind' | 'quantity_value' | 'review_status'>,
): Promise<void> {
  const { error } = await supabase.rpc('update_packing_detected_item', {
    p_detected_item_id: itemId,
    p_name: input.name,
    p_category: input.category,
    p_description: input.description,
    p_quantity_kind: input.quantity_kind,
    p_quantity_value: input.quantity_value,
    p_review_status: input.review_status,
  })
  if (error) throw error
}

export async function getPackingPhoto(photoId: string): Promise<PackingPhoto> {
  const { data, error } = await supabase.from('packing_photos').select('*').eq('id', photoId).single()
  if (error) throw error
  return data
}

export async function requestPackingItemPromotion(itemId: string) {
  const { data, error } = await supabase.rpc('request_packing_item_promotion', { p_detected_item_id: itemId })
  if (error) throw error
  return data
}

export async function mergeDetectedPackingItems(targetItemId: string, sourceItemId: string): Promise<void> {
  const { error } = await supabase.rpc('merge_packing_detected_items', {
    p_target_item_id: targetItemId,
    p_source_item_id: sourceItemId,
  })
  if (error) throw error
}

export async function requestPackingReanalysis(sessionId: string): Promise<PackingSession> {
  const { data, error } = await supabase.rpc('request_packing_reanalysis', { p_session_id: sessionId })
  if (error) throw error
  return data
}

export async function createPackingMediaDownload(objectKey: string) {
  const { data, error } = await supabase.rpc('create_packing_media_download', { p_object_key: objectKey })
  if (error) throw error
  const download = data?.[0]
  if (!download) throw new Error('packing media download was not created')
  return download
}
