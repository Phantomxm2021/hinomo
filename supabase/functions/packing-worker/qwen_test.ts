import {
  atlasObservationSchema,
  buildLanguageRepairPrompt,
  buildQwenChatRequest,
  buildSearchAliasesPrompt,
  consolidationSchema,
  localizationSchema,
  packingLanguageRules,
  packingImageDataUrl,
} from './qwen.ts'
import type { QwenUsageContext } from './qwen.ts'

Deno.test('labels JPEG Atlas bytes correctly for the vision request', () => {
  const url = packingImageDataUrl(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg')
  if (url !== 'data:image/jpeg;base64,/9j/') throw new Error('JPEG data URL has the wrong MIME type')
})

Deno.test('builds Qwen non-thinking JSON requests without replacing the OpenAI body', () => {
  const request = buildQwenChatRequest({
    model: 'qwen3-vl-plus',
    messages: [{ role: 'user', content: 'return json' }],
  })
  if (request.model !== 'qwen3-vl-plus') throw new Error('model was omitted')
  if (request.messages.length !== 1) throw new Error('messages were omitted')
  if (request.response_format?.type !== 'json_object') throw new Error('JSON mode was omitted')
  if (request.enable_thinking !== false) throw new Error('thinking mode was not disabled')
  if ('body' in request) throw new Error('request contains a nested replacement body')
})

Deno.test('accepts an opaque container without inventing contents', () => {
  const parsed = atlasObservationSchema.parse({
    schema_version: '2', atlas_id: 'atlas-1', observations: [{
      observation_id: 'obs-1', photo_id: 'P001', object_local_id: 'P001-O01', action: 'appeared',
      label: '不透明收纳袋', category: '容器', quantity: { kind: 'exact', value: 1 },
      visibility: 'opaque_container', container_label: null, evidence_photo_ids: ['P001'],
      best_crop_candidate_photo_id: 'P001', requires_original_review: false, review_reason: null,
    }],
  })
  if (parsed.observations[0]?.visibility !== 'opaque_container') throw new Error('opaque container was not preserved')
})

Deno.test('normalizes a numeric model schema version', () => {
  const parsed = atlasObservationSchema.parse({ schema_version: 2, atlas_id: 'atlas-1', observations: [] })
  if (parsed.schema_version !== '2') throw new Error('numeric schema version was not normalized')
})

Deno.test('rejects malformed localization tuples', () => {
  let rejected = false
  try {
    localizationSchema.parse({
      schema_version: '2', photo_id: 'P001', instance_id: 'instance-1', bbox: [0.1, 0.2, 0.9],
      visible_fraction: 'mostly_visible', crop_suitable: true, reason: null,
    })
  } catch { rejected = true }
  if (!rejected) throw new Error('malformed bbox was accepted')
})

Deno.test('truncates verbose localization reasons instead of failing the job', () => {
  const parsed = localizationSchema.parse({
    schema_version: '2', photo_id: 'P001', instance_id: 'instance-1', bbox: [100, 200, 800, 900],
    visible_fraction: 'mostly_visible', crop_suitable: true, reason: '说明'.repeat(180),
  })
  if (!parsed.reason || Array.from(parsed.reason).length !== 240) {
    throw new Error('verbose reason was not normalized')
  }
})

Deno.test('builds explicit Chinese output rules', () => {
  const rules = packingLanguageRules('zh-CN')
  if (!rules.includes('简体中文')) throw new Error('Chinese locale rule is missing')
  if (!rules.includes('品牌、型号和行业缩写')) throw new Error('brand preservation rule is missing')
})

Deno.test('builds explicit English output rules', () => {
  const rules = packingLanguageRules('en-US')
  if (!rules.includes('English')) throw new Error('English locale rule is missing')
  if (!rules.includes('brands, model numbers, and industry abbreviations')) throw new Error('brand preservation rule is missing')
})

Deno.test('accepts bilingual aliases and drops malformed alias entries', () => {
  const parsed = consolidationSchema.parse({
    schema_version: '2',
    items: [{
      client_id: 'item-1', name: '键盘', category: '电脑配件', description: null,
      search_aliases: { 'zh-CN': ['电脑键盘', 7], 'en-US': ['keyboard'] },
      quantity: { kind: 'exact', value: 1 }, visibility: 'clear', needs_review: false,
      instances: [{ client_id: 'instance-1', provisional_name: '键盘', first_seen_photo_id: 'P001',
        last_seen_photo_id: 'P001', representative_photo_id: 'P001', evidence_photo_ids: ['P001'], tracking_status: 'tracked' }],
    }],
  })
  if (parsed.items[0]?.search_aliases['zh-CN'].length !== 1) throw new Error('bad alias was not dropped')
})

Deno.test('accepts a malformed locale alias value as an empty list', () => {
  const parsed = consolidationSchema.parse({
    schema_version: '2',
    items: [{
      client_id: 'item-1', name: '键盘', category: null, description: null,
      search_aliases: { 'zh-CN': 'not-an-array', 'en-US': ['keyboard'] },
      quantity: { kind: 'exact', value: 1 }, visibility: 'clear', needs_review: false,
      instances: [{ client_id: 'instance-1', provisional_name: '键盘', first_seen_photo_id: 'P001',
        last_seen_photo_id: 'P001', representative_photo_id: 'P001', evidence_photo_ids: ['P001'], tracking_status: 'tracked' }],
    }],
  })
  if (parsed.items[0]?.search_aliases['zh-CN'].length !== 0) throw new Error('malformed alias list was not normalized')
})

Deno.test('rejects bilingual aliases when a locale key is missing', () => {
  let rejected = false
  try {
    consolidationSchema.parse({
      schema_version: '2',
      items: [{
        client_id: 'item-1', name: '键盘', category: null, description: null,
        search_aliases: { 'zh-CN': ['电脑键盘'] },
        quantity: { kind: 'exact', value: 1 }, visibility: 'clear', needs_review: false,
        instances: [{ client_id: 'instance-1', provisional_name: '键盘', first_seen_photo_id: 'P001',
          last_seen_photo_id: 'P001', representative_photo_id: 'P001', evidence_photo_ids: ['P001'], tracking_status: 'tracked' }],
      }],
    })
  } catch { rejected = true }
  if (!rejected) throw new Error('missing locale alias key was accepted')
})

Deno.test('language repair prompt is text-only and preserves evidence fields', () => {
  const prompt = buildLanguageRepairPrompt({
    schema_version: '2',
    items: [],
  }, 'zh-CN')
  if (!prompt.includes('只修改自然语言字段')) throw new Error('repair prompt does not constrain edits')
  if (!prompt.includes('evidence')) throw new Error('repair prompt does not preserve evidence')
  if (!prompt.includes('简体中文')) throw new Error('repair prompt has no locale rule')
  if (prompt.includes('image_url')) throw new Error('repair prompt unexpectedly requests an image')
})

Deno.test('search alias prompt is text-only and requests both locale keys', () => {
  const prompt = buildSearchAliasesPrompt({ name: 'keyboard', category: 'computer accessory' }, 'en-US')
  if (!prompt.includes('zh-CN')) throw new Error('alias prompt omits Chinese aliases')
  if (!prompt.includes('en-US')) throw new Error('alias prompt omits English aliases')
  if (!prompt.includes('不添加照片中不存在的事实')) throw new Error('alias prompt permits invented facts')
  if (prompt.includes('image_url')) throw new Error('alias prompt unexpectedly requests an image')
})

Deno.test('usage context accepts text-only language operations', () => {
  const operations: QwenUsageContext['operation'][] = ['language_repair', 'alias_backfill']
  if (operations.length !== 2) throw new Error('text-only operations are not available')
})
