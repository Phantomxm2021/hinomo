import { z } from 'zod'

const configSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  QWEN_API_KEY: z.string().min(1),
  QWEN_OPENAI_BASE_URL: z.string().url().default('https://dashscope.aliyuncs.com/compatible-mode/v1'),
  QWEN_VL_MODEL: z.string().min(1).default('qwen3-vl-plus-2025-12-19'),
  PACKING_WORKER_POLL_MS: z.coerce.number().int().min(500).max(60000).default(3000),
  PACKING_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(10).default(2),
})

export type WorkerConfig = z.infer<typeof configSchema>

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return configSchema.parse(environment)
}
