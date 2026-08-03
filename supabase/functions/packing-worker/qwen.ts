import OpenAI from 'openai'
import { z } from 'zod'
import type { PackingServices } from './services.ts'
import { PACKING_MODEL_SCHEMA_VERSION, PACKING_PROMPT_VERSION } from './types.ts'

const quantitySchema = z.object({
  kind: z.enum(['exact', 'at_least', 'approximate', 'unknown']),
  value: z.number().int().positive().nullable(),
}).superRefine((quantity, context) => {
  if ((quantity.kind === 'unknown') !== (quantity.value === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid quantity precision' })
  }
})

export const atlasObservationSchema = z.object({
  schema_version: z.literal(PACKING_MODEL_SCHEMA_VERSION),
  atlas_id: z.string().min(1),
  observations: z.array(z.object({
    observation_id: z.string().min(1),
    photo_id: z.string().regex(/^P\d{3}$/),
    object_local_id: z.string().min(1),
    action: z.enum(['appeared', 'persisted', 'disappeared', 'uncertain']),
    label: z.string().min(1).max(120),
    category: z.string().max(80).nullable(),
    quantity: quantitySchema,
    visibility: z.enum(['clear', 'partial', 'occluded', 'reflective', 'opaque_container', 'unknown']),
    container_label: z.string().max(120).nullable(),
    evidence_photo_ids: z.array(z.string().regex(/^P\d{3}$/)).min(1),
    best_crop_candidate_photo_id: z.string().regex(/^P\d{3}$/),
    requires_original_review: z.boolean(),
    review_reason: z.string().max(240).nullable(),
  })),
})

export const consolidationSchema = z.object({
  schema_version: z.literal(PACKING_MODEL_SCHEMA_VERSION),
  items: z.array(z.object({
    client_id: z.string().min(1),
    name: z.string().min(1).max(120),
    category: z.string().max(80).nullable(),
    description: z.string().max(500).nullable(),
    quantity: quantitySchema,
    visibility: z.enum(['clear', 'partial', 'occluded', 'reflective', 'opaque_container', 'unknown']),
    needs_review: z.boolean(),
    instances: z.array(z.object({
      client_id: z.string().min(1),
      provisional_name: z.string().min(1).max(120),
      first_seen_photo_id: z.string().regex(/^P\d{3}$/),
      last_seen_photo_id: z.string().regex(/^P\d{3}$/),
      representative_photo_id: z.string().regex(/^P\d{3}$/),
      evidence_photo_ids: z.array(z.string().regex(/^P\d{3}$/)).min(1),
      tracking_status: z.enum(['tracked', 'ambiguous']),
    })).min(1),
  })),
})

export const localizationSchema = z.object({
  schema_version: z.literal(PACKING_MODEL_SCHEMA_VERSION),
  photo_id: z.string().regex(/^P\d{3}$/),
  instance_id: z.string().min(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  visible_fraction: z.enum(['fully_visible', 'mostly_visible', 'partially_visible']),
  crop_suitable: z.boolean(),
  reason: z.string().max(240).nullable(),
})

const cropValidationSchema = z.object({
  schema_version: z.literal(PACKING_MODEL_SCHEMA_VERSION),
  valid: z.boolean(),
  reason: z.string().max(240).nullable(),
})

export const originalReviewSchema = z.object({
  schema_version: z.literal(PACKING_MODEL_SCHEMA_VERSION),
  photo_id: z.string().regex(/^P\d{3}$/),
  evidence_confirmed: z.boolean(),
  label: z.string().min(1).max(120),
  category: z.string().max(80).nullable(),
  quantity: quantitySchema,
  visibility: z.enum(['clear', 'partial', 'occluded', 'reflective', 'opaque_container', 'unknown']),
  review_reason: z.string().max(240).nullable(),
})

export type QwenResult<T> = {
  data: T
  inputTokens: number
  outputTokens: number
  durationMs: number
}

function imageBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return btoa(binary)
}

function client(services: PackingServices): OpenAI {
  return new OpenAI({
    apiKey: services.qwenApiKey,
    baseURL: services.qwenBaseUrl.replace(/\/$/, ''),
    maxRetries: 0,
    timeout: 75_000,
  })
}

async function callQwen<T>(input: {
  services: PackingServices
  system: string
  text: string
  image?: Uint8Array
  schema: z.ZodType<T>
}): Promise<QwenResult<T>> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  if (input.image) content.push({
    type: 'image_url', image_url: { url: `data:image/webp;base64,${imageBase64(input.image)}` },
  })
  content.push({ type: 'text', text: input.text })
  const started = Date.now()
  let raw: OpenAI.Chat.Completions.ChatCompletion
  try {
    raw = await client(input.services).chat.completions.create({
      model: input.services.qwenModel,
      messages: [{ role: 'system', content: input.system }, { role: 'user', content }],
      response_format: { type: 'json_object' },
    }, { body: { enable_thinking: false } })
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) throw new Error('qwen_timeout')
    if (error instanceof OpenAI.APIError) throw new Error(`qwen_http_${error.status ?? 'unknown'}`)
    if (error instanceof OpenAI.APIConnectionError) throw new Error('qwen_connection_error')
    throw error
  }
  const contentText = raw.choices[0]?.message.content
  if (!contentText) throw new Error('qwen_response_empty')
  let parsed: unknown
  try { parsed = JSON.parse(contentText) } catch { throw new Error('qwen_json_invalid') }
  return {
    data: input.schema.parse(parsed),
    inputTokens: raw.usage?.prompt_tokens ?? 0,
    outputTokens: raw.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - started,
  }
}

const rules = `你是 Nomo 的装箱视觉分析器。只陈述照片中可见的事实。不得猜测不透明容器内部内容；只能将其记录为容器。相同物体在连续照片中出现时不得重复计数。数量无法精确确认时必须使用 at_least、approximate 或 unknown。只返回严格 JSON。Schema 版本为 ${PACKING_MODEL_SCHEMA_VERSION}，提示词版本为 ${PACKING_PROMPT_VERSION}。`

export function observeAtlas(services: PackingServices, atlasId: string, image: Uint8Array) {
  return callQwen({ services, system: rules, image, schema: atlasObservationSchema,
    text: `分析这张按拍摄时间从左到右、从上到下排列的装箱 Atlas。每格标题 PNNN 是原始照片编号。输出物体的出现、持续、消失或不确定观察。atlas_id 必须为 ${JSON.stringify(atlasId)}。给出最佳裁剪候选照片，但不要在 Atlas 上输出 bbox。` })
}

export function consolidateObservations(services: PackingServices, observations: unknown[]) {
  return callQwen({ services, system: rules, schema: consolidationSchema,
    text: `根据以下按时间排列且已经过校验的观察构建物理实例。同一个真实物体跨照片只能生成一个实例；后来新增的同款物体必须生成另一个实例。聚合清单和数量。无法确认时 needs_review=true。\n${JSON.stringify(observations)}` })
}

export function reviewOriginalObservation(services: PackingServices, input: { photoId: string; proposedLabel: string; image: Uint8Array }) {
  return callQwen({ services, system: rules, image: input.image, schema: originalReviewSchema,
    text: `用高清原图复核 ${JSON.stringify(input.proposedLabel)}。photo_id 必须为 ${JSON.stringify(input.photoId)}。只保留原图明确支持的事实。` })
}

export function localizeInstance(services: PackingServices, input: { photoId: string; instanceId: string; itemName: string; image: Uint8Array }) {
  return callQwen({ services, system: rules, image: input.image, schema: localizationSchema,
    text: `定位 ${JSON.stringify(input.itemName)}。photo_id=${JSON.stringify(input.photoId)}，instance_id=${JSON.stringify(input.instanceId)}。bbox 为归一化 [x_min,y_min,x_max,y_max]，完整包围目标，不能框整个箱子。` })
}

export function validateItemCrop(services: PackingServices, input: { itemName: string; image: Uint8Array }) {
  return callQwen({ services, system: rules, image: input.image, schema: cropValidationSchema,
    text: `验证裁剪图主体是否确实是 ${JSON.stringify(input.itemName)}，且没有明显截断。无法确认时 valid=false。` })
}
