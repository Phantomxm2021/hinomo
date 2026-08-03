import OpenAI from 'openai'
import { z } from 'zod'
import type { PackingServices } from './services.ts'
import type { PackingImageMimeType } from './types.ts'
import { PACKING_MODEL_SCHEMA_VERSION, PACKING_PROMPT_VERSION } from './types.ts'

const quantitySchema = z.object({
  kind: z.enum(['exact', 'at_least', 'approximate', 'unknown']),
  value: z.number().int().positive().nullable(),
}).superRefine((quantity, context) => {
  if ((quantity.kind === 'unknown') !== (quantity.value === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid quantity precision' })
  }
})

const schemaVersionSchema = z.union([
  z.literal(PACKING_MODEL_SCHEMA_VERSION),
  z.literal(Number(PACKING_MODEL_SCHEMA_VERSION)),
]).transform(() => PACKING_MODEL_SCHEMA_VERSION)

const conciseReasonSchema = z.string().transform((value) =>
  Array.from(value.trim()).slice(0, 240).join('')
).nullable()

export const atlasObservationSchema = z.object({
  schema_version: schemaVersionSchema,
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
    review_reason: conciseReasonSchema,
  })),
})

export const consolidationSchema = z.object({
  schema_version: schemaVersionSchema,
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
  schema_version: schemaVersionSchema,
  photo_id: z.string().regex(/^P\d{3}$/),
  instance_id: z.string().min(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  visible_fraction: z.enum(['fully_visible', 'mostly_visible', 'partially_visible']),
  crop_suitable: z.boolean(),
  reason: conciseReasonSchema,
})

const cropValidationSchema = z.object({
  schema_version: schemaVersionSchema,
  valid: z.boolean(),
  reason: conciseReasonSchema,
})

export const originalReviewSchema = z.object({
  schema_version: schemaVersionSchema,
  photo_id: z.string().regex(/^P\d{3}$/),
  evidence_confirmed: z.boolean(),
  label: z.string().min(1).max(120),
  category: z.string().max(80).nullable(),
  quantity: quantitySchema,
  visibility: z.enum(['clear', 'partial', 'occluded', 'reflective', 'opaque_container', 'unknown']),
  review_reason: conciseReasonSchema,
})

export type QwenResult<T> = {
  data: T
  inputTokens: number
  outputTokens: number
  durationMs: number
}

export type QwenUsageContext = {
  sessionId: string
  jobId: string
  operation: 'observe' | 'original_review' | 'track_instances' | 'localize' | 'crop_validation'
}

function imageBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return btoa(binary)
}

export function packingImageDataUrl(image: Uint8Array, mimeType: PackingImageMimeType): string {
  return `data:${mimeType};base64,${imageBase64(image)}`
}

function client(services: PackingServices): OpenAI {
  return new OpenAI({
    apiKey: services.qwenApiKey,
    baseURL: services.qwenBaseUrl.replace(/\/$/, ''),
    maxRetries: 0,
    timeout: 75_000,
  })
}

export function buildQwenChatRequest(input: {
  model: string
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
}): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { enable_thinking: boolean } {
  return {
    model: input.model,
    messages: input.messages,
    response_format: { type: 'json_object' },
    // Qwen's Node.js OpenAI-compatible API requires non-standard parameters
    // at the top level. Passing this through request options.body replaces the
    // generated model/messages body and causes an HTTP 400 response.
    enable_thinking: false,
  }
}

async function callQwen<S extends z.ZodTypeAny>(input: {
  services: PackingServices
  usage: QwenUsageContext
  system: string
  text: string
  image?: Uint8Array
  imageMimeType?: PackingImageMimeType
  schema: S
}): Promise<QwenResult<z.output<S>>> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []
  if (input.image) content.push({
    type: 'image_url', image_url: { url: packingImageDataUrl(input.image, input.imageMimeType ?? 'image/webp') },
  })
  content.push({ type: 'text', text: input.text })
  const started = Date.now()
  let raw: OpenAI.Chat.Completions.ChatCompletion
  try {
    const request = buildQwenChatRequest({
      model: input.services.qwenModel,
      messages: [{ role: 'system', content: input.system }, { role: 'user', content }],
    })
    raw = await client(input.services).chat.completions.create(request)
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) throw new Error('qwen_timeout')
    if (error instanceof OpenAI.APIError) {
      console.error('qwen_api_error', {
        status: error.status ?? null,
        code: error.code ?? null,
        type: error.type ?? null,
        param: error.param ?? null,
        requestId: error.requestID ?? null,
        message: error.message.slice(0, 500),
      })
      throw new Error(`qwen_http_${error.status ?? 'unknown'}_${error.code ?? 'unknown'}`)
    }
    if (error instanceof OpenAI.APIConnectionError) throw new Error('qwen_connection_error')
    throw error
  }
  const durationMs = Date.now() - started
  const recordUsage = async (status: 'valid' | 'empty' | 'json_invalid' | 'schema_invalid') => {
    const { error } = await input.services.database.from('ai_model_usage_events').upsert({
      session_id: input.usage.sessionId,
      job_id: input.usage.jobId,
      operation: input.usage.operation,
      provider_request_id: raw.id,
      model_id: input.services.qwenModel,
      response_status: status,
      input_tokens: raw.usage?.prompt_tokens ?? 0,
      output_tokens: raw.usage?.completion_tokens ?? 0,
      duration_ms: durationMs,
    }, { onConflict: 'job_id,operation,provider_request_id', ignoreDuplicates: true })
    if (error) console.error('qwen_usage_record_failed', { code: error.code, jobId: input.usage.jobId })
  }
  const contentText = raw.choices[0]?.message.content
  if (!contentText) {
    await recordUsage('empty')
    throw new Error('qwen_response_empty')
  }
  let parsed: unknown
  try { parsed = JSON.parse(contentText) } catch {
    await recordUsage('json_invalid')
    throw new Error('qwen_json_invalid')
  }
  const validated = input.schema.safeParse(parsed)
  if (!validated.success) {
    await recordUsage('schema_invalid')
    console.error('qwen_schema_error', {
      issues: validated.error.issues.map((issue) => ({
        path: issue.path.join('.'), code: issue.code, message: issue.message,
      })),
    })
    throw new Error('qwen_schema_invalid')
  }
  await recordUsage('valid')
  return {
    data: validated.data,
    inputTokens: raw.usage?.prompt_tokens ?? 0,
    outputTokens: raw.usage?.completion_tokens ?? 0,
    durationMs,
  }
}

const rules = `你是 Nomo 的装箱视觉分析器。只陈述照片中可见的事实。不得猜测不透明容器内部内容；只能将其记录为容器。相同物体在连续照片中出现时不得重复计数。数量无法精确确认时必须使用 at_least、approximate 或 unknown。reason 和 review_reason 只写一句简短结论，不得超过 120 个汉字。只返回严格 JSON。Schema 版本为 ${PACKING_MODEL_SCHEMA_VERSION}，提示词版本为 ${PACKING_PROMPT_VERSION}。`

const quantityContract = `quantity 必须是 {"kind":"exact|at_least|approximate|unknown","value":正整数或null}；仅 kind=unknown 时 value=null。`
const observationContract = `JSON 结构必须严格为 {"schema_version":"1","atlas_id":string,"observations":[{"observation_id":string,"photo_id":"PNNN","object_local_id":string,"action":"appeared|persisted|disappeared|uncertain","label":string,"category":string|null,"quantity":{"kind":string,"value":number|null},"visibility":"clear|partial|occluded|reflective|opaque_container|unknown","container_label":string|null,"evidence_photo_ids":["PNNN"],"best_crop_candidate_photo_id":"PNNN","requires_original_review":boolean,"review_reason":string|null}]}。${quantityContract}`
const consolidationContract = `JSON 结构必须严格为 {"schema_version":"1","items":[{"client_id":string,"name":string,"category":string|null,"description":string|null,"quantity":{"kind":string,"value":number|null},"visibility":"clear|partial|occluded|reflective|opaque_container|unknown","needs_review":boolean,"instances":[{"client_id":string,"provisional_name":string,"first_seen_photo_id":"PNNN","last_seen_photo_id":"PNNN","representative_photo_id":"PNNN","evidence_photo_ids":["PNNN"],"tracking_status":"tracked|ambiguous"}]}]}。每个 items[].instances 至少一项。${quantityContract}`
const reviewContract = `JSON 结构必须严格为 {"schema_version":"1","photo_id":"PNNN","evidence_confirmed":boolean,"label":string,"category":string|null,"quantity":{"kind":string,"value":number|null},"visibility":"clear|partial|occluded|reflective|opaque_container|unknown","review_reason":string|null}。${quantityContract}`
const localizationContract = `JSON 结构必须严格为 {"schema_version":"1","photo_id":"PNNN","instance_id":string,"bbox":[number,number,number,number],"visible_fraction":"fully_visible|mostly_visible|partially_visible","crop_suitable":boolean,"reason":string|null}。bbox 使用 Qwen 原生 1000×1000 相对坐标系，四个值均在 0～1000。`
const cropValidationContract = `JSON 结构必须严格为 {"schema_version":"1","valid":boolean,"reason":string|null}。`

export function observeAtlas(services: PackingServices, usage: QwenUsageContext, atlasId: string, image: Uint8Array, imageMimeType: PackingImageMimeType = 'image/jpeg') {
  return callQwen({ services, usage, system: rules, image, imageMimeType, schema: atlasObservationSchema,
    text: `分析这张按拍摄时间从左到右、从上到下排列的装箱 Atlas。每格标题 PNNN 是原始照片编号。输出物体的出现、持续、消失或不确定观察。atlas_id 必须为 ${JSON.stringify(atlasId)}。给出最佳裁剪候选照片，但不要在 Atlas 上输出 bbox。${observationContract}` })
}

export function consolidateObservations(services: PackingServices, usage: QwenUsageContext, observations: unknown[]) {
  return callQwen({ services, usage, system: rules, schema: consolidationSchema,
    text: `根据以下按时间排列且已经过校验的观察构建物理实例。同一个真实物体跨照片只能生成一个实例；后来新增的同款物体必须生成另一个实例。聚合清单和数量。无法确认时 needs_review=true。${consolidationContract}\n观察数据：${JSON.stringify(observations)}` })
}

export function reviewOriginalObservation(services: PackingServices, usage: QwenUsageContext, input: { photoId: string; proposedLabel: string; image: Uint8Array; imageMimeType: PackingImageMimeType }) {
  return callQwen({ services, usage, system: rules, image: input.image, imageMimeType: input.imageMimeType, schema: originalReviewSchema,
    text: `用高清原图复核 ${JSON.stringify(input.proposedLabel)}。photo_id 必须为 ${JSON.stringify(input.photoId)}。只保留原图明确支持的事实。${reviewContract}` })
}

export function localizeInstance(services: PackingServices, usage: QwenUsageContext, input: { photoId: string; instanceId: string; itemName: string; image: Uint8Array; imageMimeType: PackingImageMimeType }) {
  return callQwen({ services, usage, system: rules, image: input.image, imageMimeType: input.imageMimeType, schema: localizationSchema,
    text: `定位 ${JSON.stringify(input.itemName)}。photo_id=${JSON.stringify(input.photoId)}，instance_id=${JSON.stringify(input.instanceId)}。bbox 为 [x_min,y_min,x_max,y_max]，完整包围目标，不能框整个箱子。${localizationContract}` })
}

export function validateItemCrop(services: PackingServices, usage: QwenUsageContext, input: { itemName: string; image: Uint8Array }) {
  return callQwen({ services, usage, system: rules, image: input.image, schema: cropValidationSchema,
    text: `验证裁剪图主体是否确实是 ${JSON.stringify(input.itemName)}，且没有明显截断。无法确认时 valid=false。${cropValidationContract}` })
}
