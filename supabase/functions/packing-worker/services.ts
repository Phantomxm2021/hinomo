import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type PackingServices = {
  database: SupabaseClient
  qwenApiKey: string
  qwenBaseUrl: string
  qwenModel: string
}

function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

export function createPackingServices(): PackingServices {
  return {
    database: createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    qwenApiKey: required('QWEN_API_KEY'),
    qwenBaseUrl: Deno.env.get('QWEN_OPENAI_BASE_URL') ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    qwenModel: Deno.env.get('QWEN_VL_MODEL') ?? 'qwen3-vl-plus-2025-12-19',
  }
}

async function signedMediaUrl(services: PackingServices, method: 'GET' | 'PUT', objectKey: string): Promise<string> {
  const { data, error } = await services.database.rpc('create_packing_service_media_url', {
    p_method: method,
    p_object_key: objectKey,
    p_content_type: method === 'PUT' ? 'image/webp' : null,
  })
  if (error || !data) throw new Error(`packing_media_sign_failed_${error?.code ?? 'empty'}`)
  return data as string
}

export async function readMedia(services: PackingServices, objectKey: string): Promise<Uint8Array> {
  const response = await fetch(await signedMediaUrl(services, 'GET', objectKey))
  if (!response.ok) throw new Error(`packing_media_read_${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function writeMedia(services: PackingServices, objectKey: string, bytes: Uint8Array): Promise<void> {
  const response = await fetch(await signedMediaUrl(services, 'PUT', objectKey), {
    method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: bytes,
  })
  if (!response.ok) throw new Error(`packing_media_write_${response.status}`)
}
