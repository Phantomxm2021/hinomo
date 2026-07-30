import imageCompression from 'browser-image-compression'
import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

export type ProfileRecord = Database['public']['Tables']['profiles']['Row']

export async function getProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function updateLocale(locale: 'zh-CN' | 'en-US') {
  const { error } = await supabase.rpc('update_profile_locale', { p_locale: locale })
  if (error) throw error
}

export async function createAvatarUpload(input: { mimeType: string; sizeBytes: number }) {
  const { data, error } = await supabase.rpc('create_profile_avatar_upload', {
    p_mime_type: input.mimeType,
    p_size_bytes: input.sizeBytes,
  })
  if (error) throw error
  const session = data?.[0]
  if (!session) throw new Error('avatar upload session was not created')
  return session
}

export async function confirmAvatarUpload(uploadId: string) {
  const { error } = await supabase.rpc('confirm_profile_avatar_upload', { p_upload_id: uploadId })
  if (error) throw error
}

export async function getAvatarDownload() {
  const { data, error } = await supabase.rpc('create_profile_avatar_download')
  if (error) throw error
  return data?.[0]?.download_url ?? null
}

export async function uploadAvatar(file: File) {
  const compressed = await imageCompression(file, {
    fileType: 'image/webp',
    initialQuality: 0.82,
    maxSizeMB: 0.5,
    maxWidthOrHeight: 512,
    useWebWorker: true,
  })
  const session = await createAvatarUpload({ mimeType: compressed.type, sizeBytes: compressed.size })
  const response = await fetch(session.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': compressed.type },
    body: compressed,
  })
  if (!response.ok) throw new Error('R2 avatar upload failed')
  await confirmAvatarUpload(session.upload_id)
  return getAvatarDownload()
}
