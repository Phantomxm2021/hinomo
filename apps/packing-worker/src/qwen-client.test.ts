import { beforeEach, expect, test, vi } from 'vitest'
import type { WorkerConfig } from './config.js'

const mocks = vi.hoisted(() => ({ create: vi.fn(), constructorOptions: vi.fn() }))

vi.mock('openai', () => ({
  default: class OpenAI {
    static APIConnectionTimeoutError = class extends Error {}
    static APIConnectionError = class extends Error {}
    static APIError = class extends Error {}
    chat = { completions: { create: mocks.create } }
    constructor(options: unknown) { mocks.constructorOptions(options) }
  },
}))

import { observeAtlas } from './qwen.js'

const config = {
  SUPABASE_URL: 'https://project.example.com', SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  R2_ACCOUNT_ID: 'account', R2_BUCKET_NAME: 'bucket', R2_ACCESS_KEY_ID: 'access', R2_SECRET_ACCESS_KEY: 'secret',
  QWEN_API_KEY: 'qwen-key', QWEN_OPENAI_BASE_URL: 'https://qwen-compatible.example.com/v1/',
  QWEN_VL_MODEL: 'qwen3-vl-plus-2025-12-19', PACKING_WORKER_POLL_MS: 3000, PACKING_WORKER_BATCH_SIZE: 2,
} satisfies WorkerConfig

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockReturnValue({
    withResponse: async () => ({
      request_id: 'request-1',
      data: {
        id: 'completion-1', choices: [{ message: { content: JSON.stringify({ schema_version: '1', atlas_id: 'atlas-1', observations: [] }) } }],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      },
    }),
  })
})

test('uses the official OpenAI client against the configured compatible endpoint', async () => {
  const result = await observeAtlas(config, 'atlas-1', Buffer.from('image'))

  expect(mocks.constructorOptions).toHaveBeenCalledWith(expect.objectContaining({
    apiKey: 'qwen-key', baseURL: 'https://qwen-compatible.example.com/v1', maxRetries: 0,
  }))
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
    model: 'qwen3-vl-plus-2025-12-19', response_format: { type: 'json_object' },
  }), { body: { enable_thinking: false } })
  expect(result).toMatchObject({ inputTokens: 12, outputTokens: 5, requestId: 'request-1' })
})
