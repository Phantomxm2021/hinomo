import { z } from 'zod'
import type { WorkerConfig } from './config.js'
import { PACKING_MODEL_SCHEMA_VERSION, PACKING_PROMPT_VERSION } from './types.js'

const quantitySchema = z.object({
  kind: z.enum(['exact', 'at_least', 'approximate', 'unknown']),
  value: z.number().int().positive().nullable(),
}).superRefine((quantity, context) => {
  if ((quantity.kind === 'unknown') !== (quantity.value === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'unknown quantity must be null; known quantity needs a value' })
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

type ModelUsage = { prompt_tokens?: number; completion_tokens?: number }

type QwenResponse = {
  choices?: Array<{ message?: { content?: string } }>
  usage?: ModelUsage
  id?: string
}

export type QwenResult<T> = {
  data: T
  inputTokens: number
  outputTokens: number
  durationMs: number
  requestId: string | null
}

async function callQwen<T>(input: {
  config: WorkerConfig
  system: string
  text: string
  image?: Buffer
  schema: z.ZodType<T>
}): Promise<QwenResult<T>> {
  const content: Array<Record<string, unknown>> = []
  if (input.image) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/webp;base64,${input.image.toString('base64')}` },
    })
  }
  content.push({ type: 'text', text: input.text })
  const started = Date.now()
  const response = await fetch(`${input.config.DASHSCOPE_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.config.QWEN_VL_MODEL,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      enable_thinking: false,
    }),
  })
  if (!response.ok) throw new Error(`qwen_http_${response.status}`)
  const raw = await response.json() as QwenResponse
  const modelContent = raw.choices?.[0]?.message?.content
  if (!modelContent) throw new Error('qwen_response_empty')
  let parsed: unknown
  try {
    parsed = JSON.parse(modelContent)
  } catch {
    throw new Error('qwen_json_invalid')
  }
  return {
    data: input.schema.parse(parsed),
    inputTokens: raw.usage?.prompt_tokens ?? 0,
    outputTokens: raw.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - started,
    requestId: raw.id ?? null,
  }
}

const sharedRules = `你是 Nomo 的装箱视觉分析器。只陈述照片中可见的事实。不得猜测不透明容器内部内容；只能将其记录为容器。相同物体在连续照片中出现时不得重复计数。数量无法精确确认时必须使用 at_least、approximate 或 unknown。只返回严格 JSON。Schema 版本为 ${PACKING_MODEL_SCHEMA_VERSION}，提示词版本为 ${PACKING_PROMPT_VERSION}。`

export function observeAtlas(config: WorkerConfig, atlasId: string, atlas: Buffer) {
  return callQwen({
    config,
    system: sharedRules,
    image: atlas,
    schema: atlasObservationSchema,
    text: `分析这张按拍摄时间从左到右、从上到下排列的装箱 Atlas。每格标题 PNNN 是原始照片编号。输出每张照片相对之前照片中新出现、持续、消失或不确定的物体观察。atlas_id 必须为 ${JSON.stringify(atlasId)}。每个观察给出最佳裁剪候选照片，但不要在 Atlas 上输出 bbox。`,
  })
}

export function consolidateObservations(config: WorkerConfig, observations: unknown[]) {
  return callQwen({
    config,
    system: sharedRules,
    schema: consolidationSchema,
    text: `下面是按时间排列、已经过 Schema 校验的 Atlas 观察 JSON。构建物理实例：同一个真实物体跨照片持续出现只能生成一个实例；后来新增的外观相同物体必须生成另一个实例。然后把同类实例聚合为一个清单项并计算数量。无法确认是否相同时保留不同实例并 needs_review。\n${JSON.stringify(observations)}`,
  })
}

export function reviewOriginalObservation(config: WorkerConfig, input: {
  photoId: string
  proposedLabel: string
  image: Buffer
}) {
  return callQwen({
    config,
    system: sharedRules,
    image: input.image,
    schema: originalReviewSchema,
    text: `使用这张高清原图复核 Atlas 中不确定的观察 ${JSON.stringify(input.proposedLabel)}。photo_id 必须为 ${JSON.stringify(input.photoId)}。只保留原图明确支持的名称、数量和可见性；不支持则 evidence_confirmed=false。`,
  })
}

export function localizeInstance(config: WorkerConfig, input: {
  photoId: string
  instanceId: string
  itemName: string
  image: Buffer
}) {
  return callQwen({
    config,
    system: sharedRules,
    image: input.image,
    schema: localizationSchema,
    text: `在这张高清原图中定位清单物品 ${JSON.stringify(input.itemName)}。photo_id 必须为 ${JSON.stringify(input.photoId)}，instance_id 必须为 ${JSON.stringify(input.instanceId)}。bbox 使用 [x_min,y_min,x_max,y_max]，坐标归一化到 0～1。框应完整包围目标物品，不能框整个箱子。`,
  })
}

export function validateItemCrop(config: WorkerConfig, input: { itemName: string; image: Buffer }) {
  return callQwen({
    config,
    system: sharedRules,
    image: input.image,
    schema: cropValidationSchema,
    text: `验证这张裁剪图的主体是否确实是 ${JSON.stringify(input.itemName)}，并且没有明显截断主体。无法确认时 valid=false。`,
  })
}
