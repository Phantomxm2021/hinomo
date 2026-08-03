import { z } from 'zod'
import type { PackingImagesBinding, PackingR2Bucket } from './cloudflare.js'

export type PackingWorkerEnv = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  QWEN_API_KEY: string
  QWEN_OPENAI_BASE_URL: string
  QWEN_VL_MODEL: string
  PACKING_WORKER_BATCH_SIZE: string
  PACKING_MEDIA: PackingR2Bucket
  IMAGES: PackingImagesBinding
}

const configSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  QWEN_API_KEY: z.string().min(1),
  QWEN_OPENAI_BASE_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  QWEN_VL_MODEL: z.string().min(1).default('qwen3-vl-plus-2025-12-19'),
  PACKING_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(2).default(1),
})

export type WorkerConfig = z.infer<typeof configSchema>

export function loadConfig(environment: PackingWorkerEnv): WorkerConfig {
  return configSchema.parse(environment)
}
