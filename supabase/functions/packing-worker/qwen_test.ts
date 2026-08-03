import { atlasObservationSchema, buildQwenChatRequest, localizationSchema } from './qwen.ts'

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
    schema_version: '1', atlas_id: 'atlas-1', observations: [{
      observation_id: 'obs-1', photo_id: 'P001', object_local_id: 'P001-O01', action: 'appeared',
      label: '不透明收纳袋', category: '容器', quantity: { kind: 'exact', value: 1 },
      visibility: 'opaque_container', container_label: null, evidence_photo_ids: ['P001'],
      best_crop_candidate_photo_id: 'P001', requires_original_review: false, review_reason: null,
    }],
  })
  if (parsed.observations[0]?.visibility !== 'opaque_container') throw new Error('opaque container was not preserved')
})

Deno.test('normalizes a numeric model schema version', () => {
  const parsed = atlasObservationSchema.parse({ schema_version: 1, atlas_id: 'atlas-1', observations: [] })
  if (parsed.schema_version !== '1') throw new Error('numeric schema version was not normalized')
})

Deno.test('rejects malformed localization tuples', () => {
  let rejected = false
  try {
    localizationSchema.parse({
      schema_version: '1', photo_id: 'P001', instance_id: 'instance-1', bbox: [0.1, 0.2, 0.9],
      visible_fraction: 'mostly_visible', crop_suitable: true, reason: null,
    })
  } catch { rejected = true }
  if (!rejected) throw new Error('malformed bbox was accepted')
})

Deno.test('truncates verbose localization reasons instead of failing the job', () => {
  const parsed = localizationSchema.parse({
    schema_version: '1', photo_id: 'P001', instance_id: 'instance-1', bbox: [100, 200, 800, 900],
    visible_fraction: 'mostly_visible', crop_suitable: true, reason: '说明'.repeat(180),
  })
  if (!parsed.reason || Array.from(parsed.reason).length !== 240) {
    throw new Error('verbose reason was not normalized')
  }
})
