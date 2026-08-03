import { atlasObservationSchema, localizationSchema } from './qwen.ts'

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
