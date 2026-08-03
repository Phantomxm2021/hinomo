import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PackingImagesBinding, PackingR2Bucket } from './cloudflare.js'
import { loadConfig, type PackingWorkerEnv, type WorkerConfig } from './config.js'

export type WorkerServices = {
  database: SupabaseClient
  media: PackingR2Bucket
  images: PackingImagesBinding
  config: WorkerConfig
}

export function createWorkerServices(environment: PackingWorkerEnv): WorkerServices {
  const config = loadConfig(environment)
  return {
    config,
    database: createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    media: environment.PACKING_MEDIA,
    images: environment.IMAGES,
  }
}

export async function readR2Object(services: WorkerServices, objectKey: string): Promise<Uint8Array<ArrayBuffer>> {
  const object = await services.media.get(objectKey)
  if (!object) throw new Error('r2_object_missing')
  return new Uint8Array(await object.arrayBuffer())
}

export async function readR2Stream(services: WorkerServices, objectKey: string): Promise<ReadableStream<Uint8Array>> {
  const object = await services.media.get(objectKey)
  if (!object) throw new Error('r2_object_missing')
  return object.body
}

export async function writeR2Object(
  services: WorkerServices,
  objectKey: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<void> {
  await services.media.put(objectKey, body, { httpMetadata: { contentType } })
}
