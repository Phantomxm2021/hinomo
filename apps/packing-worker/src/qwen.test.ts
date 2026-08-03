import { describe, expect, test } from 'vitest'
import { atlasObservationSchema, consolidationSchema, localizationSchema } from './qwen.js'

describe('Qwen packing schemas', () => {
  test('accepts an opaque container without inventing its contents', () => {
    const result = atlasObservationSchema.parse({
      schema_version: '1', atlas_id: 'atlas-1', observations: [{
        observation_id: 'obs-1', photo_id: 'P001', object_local_id: 'P001-O01',
        action: 'appeared', label: '黑色收纳袋', category: '袋装物品',
        quantity: { kind: 'exact', value: 1 }, visibility: 'opaque_container',
        container_label: null, evidence_photo_ids: ['P001'],
        best_crop_candidate_photo_id: 'P001', requires_original_review: false,
        review_reason: '内容不可见，只记录外部容器',
      }],
    })
    expect(result.observations[0]?.visibility).toBe('opaque_container')
  })

  test('rejects malformed photo references', () => {
    expect(() => consolidationSchema.parse({
      schema_version: '1', items: [{
        client_id: 'item-1', name: '充电器', category: null, description: null,
        quantity: { kind: 'exact', value: 1 }, visibility: 'clear', needs_review: false,
        instances: [{ client_id: 'instance-1', provisional_name: '充电器',
          first_seen_photo_id: 'photo-one', last_seen_photo_id: 'P002',
          representative_photo_id: 'P001', evidence_photo_ids: ['P001'], tracking_status: 'tracked' }],
      }],
    })).toThrow()
  })

  test('rejects localization output with the wrong tuple shape', () => {
    expect(() => localizationSchema.parse({
      schema_version: '1', photo_id: 'P001', instance_id: 'instance-1',
      bbox: [0.1, 0.2, 0.9], visible_fraction: 'mostly_visible', crop_suitable: true, reason: null,
    })).toThrow()
  })
})
