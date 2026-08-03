import type { PostgrestError } from '@supabase/supabase-js'
import { cropPackingItem, itemCropObjectKey } from './image.ts'
import { consolidateObservations, localizeInstance, observeAtlas, reviewOriginalObservation, validateItemCrop } from './qwen.ts'
import { readMedia, writeMedia, type PackingServices } from './services.ts'
import {
  PACKING_LAYOUT_VERSION,
  PACKING_MODEL_SCHEMA_VERSION,
  PACKING_PROMPT_VERSION,
  type ClaimedJob,
  type PackingAtlas,
  type PackingPhoto,
  type PackingSession,
} from './types.ts'

type Metrics = { inputTokens: number; outputTokens: number; durationMs: number }

function databaseError(error: PostgrestError | null, fallback: string): void {
  if (error) throw new Error(`${fallback}_${error.code}`)
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown_error'
  return message.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 120) || 'unknown_error'
}

async function getSession(services: PackingServices, id: string): Promise<PackingSession> {
  const { data, error } = await services.database.from('packing_sessions').select('*').eq('id', id).single()
  databaseError(error, 'session_read_failed')
  return data as PackingSession
}

async function getPhotos(services: PackingServices, sessionId: string): Promise<PackingPhoto[]> {
  const { data, error } = await services.database.from('packing_photos').select('*')
    .eq('session_id', sessionId).eq('upload_status', 'confirmed').order('sequence_no')
  databaseError(error, 'photos_read_failed')
  return data as PackingPhoto[]
}

async function completeJob(services: PackingServices, jobId: string, result: unknown = null, metrics?: Metrics): Promise<void> {
  const { error } = await services.database.from('packing_analysis_jobs').update({
    status: 'completed', lease_expires_at: null, last_error_code: null, result,
    input_tokens: metrics?.inputTokens ?? null,
    output_tokens: metrics?.outputTokens ?? null,
    duration_ms: metrics?.durationMs ?? null,
  }).eq('id', jobId).eq('status', 'processing')
  databaseError(error, 'job_complete_failed')
}

async function enqueueJob(services: PackingServices, sessionId: string, stage: string, scopeKey: string, fingerprint: string): Promise<void> {
  const { error } = await services.database.from('packing_analysis_jobs').upsert({
    session_id: sessionId, stage, scope_key: scopeKey, input_fingerprint: fingerprint,
  }, { onConflict: 'session_id,stage,scope_key,input_fingerprint', ignoreDuplicates: true })
  databaseError(error, 'job_enqueue_failed')
}

function photoByLabel(photos: PackingPhoto[], label: string): PackingPhoto {
  const sequence = Number(label.slice(1))
  const photo = photos.find((candidate) => candidate.sequence_no === sequence)
  if (!photo) throw new Error('photo_reference_missing')
  return photo
}

async function observe(services: PackingServices, job: ClaimedJob): Promise<void> {
  const atlasNo = Number(job.scope_key.split(':')[1])
  if (!Number.isInteger(atlasNo)) throw new Error('observe_scope_invalid')
  const { data, error } = await services.database.from('packing_atlases').select('*')
    .eq('session_id', job.session_id).eq('atlas_no', atlasNo)
    .eq('layout_version', PACKING_LAYOUT_VERSION).eq('upload_status', 'confirmed').single()
  databaseError(error, 'observe_atlas_missing')
  const atlas = data as PackingAtlas
  const result = await observeAtlas(services, {
    sessionId: job.session_id, jobId: job.job_id, operation: 'observe',
  }, atlas.id, await readMedia(services, atlas.object_key), atlas.object_key.endsWith('.jpg') ? 'image/jpeg' : 'image/webp')
  const reviews = []
  const candidate = result.data.observations.find((entry) => entry.requires_original_review)
  if (candidate) {
    const photo = photoByLabel(await getPhotos(services, job.session_id), candidate.best_crop_candidate_photo_id)
    const review = await reviewOriginalObservation(services, {
      sessionId: job.session_id, jobId: job.job_id, operation: 'original_review',
    }, {
      photoId: candidate.best_crop_candidate_photo_id,
      proposedLabel: candidate.label,
      image: await readMedia(services, photo.object_key),
      imageMimeType: photo.mime_type,
    })
    reviews.push(review.data)
    result.inputTokens += review.inputTokens
    result.outputTokens += review.outputTokens
    result.durationMs += review.durationMs
  }
  await completeJob(services, job.job_id, { ...result.data, original_reviews: reviews }, result)
  const { count, error: pendingError } = await services.database.from('packing_analysis_jobs')
    .select('id', { count: 'exact', head: true }).eq('session_id', job.session_id)
    .eq('stage', 'observe').in('status', ['pending', 'processing'])
  databaseError(pendingError, 'observe_pending_failed')
  if ((count ?? 0) === 0) await enqueueJob(services, job.session_id, 'track_instances', 'session', `${PACKING_PROMPT_VERSION}:track`)
}

async function track(services: PackingServices, job: ClaimedJob): Promise<void> {
  const { data, error } = await services.database.from('packing_analysis_jobs').select('scope_key,result')
    .eq('session_id', job.session_id).eq('stage', 'observe').eq('status', 'completed').order('scope_key')
  databaseError(error, 'observations_read_failed')
  const result = await consolidateObservations(services, {
    sessionId: job.session_id, jobId: job.job_id, operation: 'track_instances',
  }, (data ?? []).map((row) => row.result))
  await completeJob(services, job.job_id, result.data, result)
  await enqueueJob(services, job.session_id, 'consolidate', 'session', `${PACKING_PROMPT_VERSION}:materialize`)
}

type ConsolidatedItem = {
  name: string
  category: string | null
  description: string | null
  quantity: { kind: string; value: number | null }
  visibility: string
  needs_review: boolean
  instances: Array<{
    provisional_name: string
    first_seen_photo_id: string
    last_seen_photo_id: string
    representative_photo_id: string
    evidence_photo_ids: string[]
    tracking_status: string
  }>
}

async function materialize(services: PackingServices, job: ClaimedJob): Promise<void> {
  const session = await getSession(services, job.session_id)
  const photos = await getPhotos(services, job.session_id)
  const { data: trackJob, error: trackError } = await services.database.from('packing_analysis_jobs').select('result')
    .eq('session_id', job.session_id).eq('stage', 'track_instances').eq('status', 'completed').single()
  databaseError(trackError, 'track_result_missing')
  const items = ((trackJob?.result as { items?: ConsolidatedItem[] })?.items ?? [])
  const revision = session.current_revision + 1
  const { error: clearError } = await services.database.from('packing_detected_items').delete()
    .eq('session_id', session.id).eq('analysis_revision', revision).is('published_at', null)
  databaseError(clearError, 'draft_revision_clear_failed')

  for (const item of items) {
    const firstPhoto = photoByLabel(photos, item.instances[0]!.first_seen_photo_id)
    const { data: insertedItem, error: itemError } = await services.database.from('packing_detected_items').insert({
      session_id: session.id, box_id: session.box_id, analysis_revision: revision,
      name: item.name, category: item.category, description: item.description,
      quantity_kind: item.quantity.kind, quantity_value: item.quantity.value,
      visibility: item.visibility, review_status: item.needs_review ? 'needs_review' : 'unreviewed',
      crop_status: 'pending', first_seen_photo_id: firstPhoto.id,
      model_id: services.qwenModel, prompt_version: PACKING_PROMPT_VERSION,
    }).select('*').single()
    databaseError(itemError, 'detected_item_insert_failed')
    let representativeInstanceId: string | null = null
    for (const [index, instance] of item.instances.entries()) {
      const representativePhoto = photoByLabel(photos, instance.representative_photo_id)
      const { data: insertedInstance, error: instanceError } = await services.database.from('packing_detected_instances').insert({
        session_id: session.id, detected_item_id: insertedItem.id,
        provisional_name: instance.provisional_name, tracking_status: instance.tracking_status,
        first_seen_photo_id: photoByLabel(photos, instance.first_seen_photo_id).id,
        last_seen_photo_id: photoByLabel(photos, instance.last_seen_photo_id).id,
        representative_photo_id: representativePhoto.id,
      }).select('*').single()
      databaseError(instanceError, 'instance_insert_failed')
      if (index === 0) representativeInstanceId = insertedInstance.id as string
      const evidenceRows = [...new Set(instance.evidence_photo_ids)].map((label) => ({
        detected_instance_id: insertedInstance.id,
        photo_id: photoByLabel(photos, label).id,
        evidence_kind: label === instance.first_seen_photo_id ? 'first_seen' : 'supporting',
        visibility: item.visibility,
        crop_suitable: label === instance.representative_photo_id,
      }))
      const { error: evidenceError } = await services.database.from('packing_detected_instance_evidence').insert(evidenceRows)
      databaseError(evidenceError, 'evidence_insert_failed')
    }
    const { error: representativeError } = await services.database.from('packing_detected_items')
      .update({ representative_instance_id: representativeInstanceId }).eq('id', insertedItem.id)
    databaseError(representativeError, 'representative_update_failed')
  }
  await completeJob(services, job.job_id)
  const { data: createdItems, error } = await services.database.from('packing_detected_items').select('id')
    .eq('session_id', session.id).eq('analysis_revision', revision)
  databaseError(error, 'items_read_failed')
  if ((createdItems ?? []).length === 0) {
    await enqueueJob(services, session.id, 'publish', `revision:${revision}`, `${PACKING_PROMPT_VERSION}:publish`)
  } else {
    for (const item of createdItems ?? []) {
      await enqueueJob(services, session.id, 'localize', `item:${item.id}`, `${PACKING_PROMPT_VERSION}:localize`)
    }
  }
}

async function localize(services: PackingServices, job: ClaimedJob): Promise<void> {
  const itemId = job.scope_key.split(':')[1]
  if (!itemId) throw new Error('localize_scope_invalid')
  const { data: item, error: itemError } = await services.database.from('packing_detected_items').select('*').eq('id', itemId).single()
  databaseError(itemError, 'localize_item_missing')
  const session = await getSession(services, job.session_id)
  const { data: instance, error: instanceError } = await services.database.from('packing_detected_instances')
    .select('*').eq('id', item.representative_instance_id).single()
  databaseError(instanceError, 'localize_instance_missing')
  const { data: photo, error: photoError } = await services.database.from('packing_photos')
    .select('*').eq('id', instance.representative_photo_id).single()
  databaseError(photoError, 'localize_photo_missing')
  const typedPhoto = photo as PackingPhoto
  const source = await readMedia(services, typedPhoto.object_key)
  const photoLabel = `P${String(typedPhoto.sequence_no).padStart(3, '0')}`
  const result = await localizeInstance(services, {
    sessionId: job.session_id, jobId: job.job_id, operation: 'localize',
  }, {
    photoId: photoLabel, instanceId: instance.id as string, itemName: item.name as string,
    image: source, imageMimeType: typedPhoto.mime_type,
  })
  const metrics: Metrics = { inputTokens: result.inputTokens, outputTokens: result.outputTokens, durationMs: result.durationMs }
  let succeeded = false
  let validationResult: unknown = null
  if (result.data.crop_suitable) {
    const crop = cropPackingItem(source, result.data.bbox)
    const validation = await validateItemCrop(services, {
      sessionId: job.session_id, jobId: job.job_id, operation: 'crop_validation',
    }, { itemName: item.name as string, image: crop.bytes })
    metrics.inputTokens += validation.inputTokens
    metrics.outputTokens += validation.outputTokens
    metrics.durationMs += validation.durationMs
    validationResult = validation.data
    if (validation.data.valid) {
      const objectKey = itemCropObjectKey({ ownerId: session.owner_id, boxId: session.box_id, sessionId: session.id, itemId })
      await writeMedia(services, objectKey, crop.bytes)
      const { error } = await services.database.from('packing_detected_items').update({
        cover_object_key: objectKey, cover_mime_type: 'image/webp', cover_size_bytes: crop.bytes.length,
        cover_width: crop.width, cover_height: crop.height, crop_source_photo_id: typedPhoto.id,
        crop_bbox: crop.bbox, crop_version: `${PACKING_PROMPT_VERSION}:magick-wasm-14pct-v1`, crop_status: 'ready',
      }).eq('id', itemId)
      databaseError(error, 'crop_update_failed')
      succeeded = true
    }
  }
  if (!succeeded) {
    const { error } = await services.database.from('packing_detected_items').update({
      crop_status: 'needs_review', review_status: 'needs_review', crop_source_photo_id: typedPhoto.id,
      crop_bbox: result.data.bbox,
    }).eq('id', itemId)
    databaseError(error, 'crop_review_update_failed')
  }
  await completeJob(services, job.job_id, { succeeded, localization: result.data, validation: validationResult }, metrics)
  const { count, error: pendingError } = await services.database.from('packing_analysis_jobs')
    .select('id', { count: 'exact', head: true }).eq('session_id', job.session_id)
    .eq('stage', 'localize').in('status', ['pending', 'processing'])
  databaseError(pendingError, 'localize_pending_failed')
  if ((count ?? 0) === 0) await enqueueJob(services, job.session_id, 'publish', `revision:${item.analysis_revision}`, `${PACKING_PROMPT_VERSION}:publish`)
}

async function publish(services: PackingServices, job: ClaimedJob): Promise<void> {
  if (job.scope_key.startsWith('promotion:')) return promote(services, job)
  const revision = Number(job.scope_key.split(':')[1])
  if (!Number.isInteger(revision) || revision < 1) throw new Error('publish_revision_invalid')
  const { error } = await services.database.rpc('publish_packing_revision', {
    p_session_id: job.session_id, p_revision: revision, p_model_id: services.qwenModel,
    p_prompt_version: PACKING_PROMPT_VERSION, p_schema_version: PACKING_MODEL_SCHEMA_VERSION,
  })
  databaseError(error, 'publish_revision_failed')
  await completeJob(services, job.job_id)
}

async function promote(services: PackingServices, job: ClaimedJob): Promise<void> {
  const promotionId = job.scope_key.split(':')[1]
  if (!promotionId) throw new Error('promotion_scope_invalid')
  const { data: promotion, error } = await services.database.from('packing_item_promotions').select('*').eq('id', promotionId).single()
  databaseError(error, 'promotion_missing')
  if (promotion.status === 'completed') return completeJob(services, job.job_id)
  await services.database.from('packing_item_promotions').update({ status: 'processing', last_error_code: null }).eq('id', promotionId)
  const { data: item, error: itemError } = await services.database.from('packing_detected_items')
    .select('cover_object_key,cover_mime_type,representative_instance_id,first_seen_photo_id').eq('id', promotion.detected_item_id).single()
  databaseError(itemError, 'promotion_item_missing')
  if (!item) throw new Error('promotion_item_missing')
  let sourceObjectKey = item.cover_object_key
  let sourceMimeType = item.cover_mime_type
  if (!sourceObjectKey || !sourceMimeType) {
    let sourcePhotoId = item.first_seen_photo_id
    if (item.representative_instance_id) {
      const { data: instance, error: instanceError } = await services.database.from('packing_detected_instances')
        .select('representative_photo_id').eq('id', item.representative_instance_id).single()
      databaseError(instanceError, 'promotion_instance_missing')
      sourcePhotoId = instance?.representative_photo_id ?? sourcePhotoId
    }
    if (!sourcePhotoId) throw new Error('promotion_source_photo_missing')
    const { data: photo, error: photoError } = await services.database.from('packing_photos')
      .select('object_key,mime_type').eq('id', sourcePhotoId).single()
    databaseError(photoError, 'promotion_source_photo_missing')
    sourceObjectKey = photo?.object_key ?? null
    sourceMimeType = photo?.mime_type ?? null
  }
  if (!sourceObjectKey || !sourceMimeType) throw new Error('promotion_source_photo_missing')
  const bytes = await readMedia(services, sourceObjectKey)
  await writeMedia(services, promotion.target_object_key, bytes)
  const { error: finalizeError } = await services.database.rpc('finalize_packing_item_promotion', {
    p_promotion_id: promotionId, p_mime_type: sourceMimeType, p_size_bytes: bytes.length,
  })
  databaseError(finalizeError, 'promotion_finalize_failed')
  await completeJob(services, job.job_id)
}

export async function processPackingJob(services: PackingServices, job: ClaimedJob): Promise<void> {
  try {
    if (job.stage === 'observe') await observe(services, job)
    else if (job.stage === 'track_instances') await track(services, job)
    else if (job.stage === 'consolidate') await materialize(services, job)
    else if (job.stage === 'localize') await localize(services, job)
    else if (job.stage === 'publish') await publish(services, job)
    else throw new Error(`stage_not_implemented_${job.stage}`)
  } catch (error) {
    const code = safeErrorCode(error)
    const retryable = !code.startsWith('stage_not_implemented')
    const terminal = !retryable || job.attempts >= 5
    if (job.scope_key.startsWith('promotion:')) {
      const promotionId = job.scope_key.split(':')[1]
      if (promotionId) await services.database.from('packing_item_promotions').update({ status: 'failed', last_error_code: code }).eq('id', promotionId)
    }
    if (terminal && job.stage === 'localize' && job.scope_key.startsWith('item:')) {
      const itemId = job.scope_key.split(':')[1]
      if (itemId) await services.database.from('packing_detected_items')
        .update({ crop_status: 'failed', review_status: 'needs_review' }).eq('id', itemId)
    }
    const { error: failureError } = await services.database.rpc('fail_packing_analysis_job', {
      p_job_id: job.job_id, p_error_code: code, p_retryable: retryable,
    })
    if (failureError) throw new Error(`job_failure_record_failed_${failureError.code}`)
    throw new Error(code)
  }
}

export async function claimPackingJobs(services: PackingServices): Promise<ClaimedJob[]> {
  const { data, error } = await services.database.rpc('claim_packing_analysis_jobs', {
    p_batch_size: 1, p_lease_seconds: 390,
  })
  databaseError(error, 'job_claim_failed')
  return (data ?? []) as ClaimedJob[]
}
