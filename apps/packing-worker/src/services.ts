import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WorkerConfig } from './config.js'

export type WorkerServices = {
  database: SupabaseClient
  r2: S3Client
  bucket: string
  config: WorkerConfig
}

export function createWorkerServices(config: WorkerConfig): WorkerServices {
  return {
    config,
    database: createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    r2: new S3Client({
      region: 'auto',
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    }),
    bucket: config.R2_BUCKET_NAME,
  }
}

export async function readR2Object(services: WorkerServices, objectKey: string): Promise<Buffer> {
  const response = await services.r2.send(new GetObjectCommand({ Bucket: services.bucket, Key: objectKey }))
  if (!response.Body) throw new Error('r2_object_body_missing')
  return Buffer.from(await response.Body.transformToByteArray())
}

export async function writeR2Object(
  services: WorkerServices,
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await services.r2.send(new PutObjectCommand({
    Bucket: services.bucket,
    Key: objectKey,
    Body: body,
    ContentType: contentType,
  }))
}
