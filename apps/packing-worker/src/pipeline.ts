import type { PostgrestError } from '@supabase/supabase-js'
import {
  ATLAS_MAX_PHOTOS,
  atlasObjectKey,
  buildPackingAtlas,
  cropPackingItem,
  itemCropObjectKey,
  normalizedObjectKey,
  normalizePackingPhoto,
} from './atlas.js'
import {
  consolidateObservations,
  localizeInstance,
  observeAtlas,
  reviewOriginalObservation,
  validateItemCrop,
} from './qwen.js'
import { readR2Object, readR2Stream, writeR2Object, type WorkerServices } from './services.js'
import {
  PACKING_LAYOUT_VERSION,
  PACKING_MODEL_SCHEMA_VERSION,
  PACKING_PROMPT_VERSION,
  type ClaimedJob,
  type PackingAtlas,
  type PackingPhoto,
  type PackingSession,
} from './types.js'

type ModelMetrics = {
  inputTokens: number
  outputTokens: number
  durationMs: number
}

const NORMALIZE_PHOTOS_PER_JOB = 10

function stageOffset(scopeKey: string, prefix: string): number {
  if (scopeKey === 'session') return 0
  const match = new RegExp(`^${prefix}:(\\d+)$`).exec(scopeKey)
  const offset = Number(match?.[1])
  if (!Number.isInteger(offset) || offset < 0) throw new Error(`${prefix}_scope_invalid`)
  return offset
}

function databaseError(error: PostgrestError | null, fallback: string): void {
  if (error) throw new Error(`${fallback}_${error.code}`)
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown_error'
  return message.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 120) || 'unknown_error'
}

async function getSession(services: WorkerServices, sessionId: string): Promise<PackingSession> {
  const { data, error } = await services.database.from('packing_sessions').select('*').eq('id', sessionId).single()
  databaseError(error, 'session_read_failed')
  return data as PackingSession
}

async function getPhotos(services: WorkerServices, sessionId: string): Promise<PackingPhoto[]> {
  const { data, error } = await services.database
    .from('packing_photos')
    .select('*')
    .eq('session_id', sessionId)
    .eq('upload_status', 'confirmed')
    .order('sequence_no')
  databaseError(error, 'photos_read_failed')
  return data as PackingPhoto[]
}

async function completeJob(
  services: WorkerServices,
  jobId: string,
  result: unknown = null,
  metrics?: ModelMetrics,
): Promise<void> {
  const { error } = await services.database.from('packing_analysis_jobs').update({
    status: 'completed',
    lease_expires_at: null,
    last_error_code: null,
    result,
    input_tokens: metrics?.inputTokens ?? null,
    output_tokens: metrics?.outputTokens ?? null,
    duration_ms: metrics?.durationMs ?? null,
  }).eq('id', jobId).eq('status', 'processing')
  databaseError(error, 'job_complete_failed')
}

async function enqueueJob(
  services: WorkerServices,
  sessionId: string,
  stage: string,
  scopeKey: string,
  inputFingerprint: string,
): Promise<void> {
  const { error } = await services.database.from('packing_analysis_jobs').upsert({
    session_id: sessionId,
    stage,
    scope_key: scopeKey,
    input_fingerprint: inputFingerprint,
  }, { onConflict: 'session_id,stage,scope_key,input_fingerprint', ignoreDuplicates: true })
  databaseError(error, 'job_enqueue_failed')
}

async function normalizeSession(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const photos = await getPhotos(services, job.session_id)
  if (photos.length === 0) throw new Error('normalize_photos_missing')
  const offset = stageOffset(job.scope_key, 'photos')
  const chunk = photos.slice(offset, offset + NORMALIZE_PHOTOS_PER_JOB)
  if (chunk.length === 0) throw new Error('normalize_scope_out_of_range')
  for (const photo of chunk) {
    const source = await readR2Stream(services, photo.object_key)
    const normalized = await normalizePackingPhoto(services.images, source)
    const objectKey = normalizedObjectKey(photo)
    await writeR2Object(services, objectKey, normalized.buffer, 'image/webp')
    const { error } = await services.database.from('packing_photos').update({
      normalized_object_key: objectKey,
      width: normalized.width,
      height: normalized.height,
      sha256: normalized.sha256,
    }).eq('id', photo.id)
    databaseError(error, 'photo_normalize_write_failed')
  }
  await completeJob(services, job.job_id)
  const nextOffset = offset + chunk.length
  if (nextOffset < photos.length) {
    await enqueueJob(services, job.session_id, 'normalize', `photos:${nextOffset}`, `${job.input_fingerprint}:${nextOffset}`)
  } else {
    await enqueueJob(services, job.session_id, 'atlas', 'session', `${PACKING_LAYOUT_VERSION}:${photos.length}`)
  }
}

async function generateAtlases(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const session = await getSession(services, job.session_id)
  const photos = await getPhotos(services, job.session_id)
  const offset = stageOffset(job.scope_key, 'photos')
  const group = photos.slice(offset, offset + ATLAS_MAX_PHOTOS)
  if (group.length === 0) throw new Error('atlas_scope_out_of_range')
  const sources = await Promise.all(group.map(async (photo) => ({
    id: photo.id,
    sequence_no: photo.sequence_no,
    stream: await readR2Stream(services, photo.normalized_object_key ?? photo.object_key),
  })))
  const atlas = await buildPackingAtlas(services.images, sources)
  const atlasNo = Math.floor(offset / ATLAS_MAX_PHOTOS) + 1
  const objectKey = atlasObjectKey({
    ownerId: session.owner_id,
    boxId: session.box_id,
    sessionId: session.id,
    atlasNo,
  })
  await writeR2Object(services, objectKey, atlas.buffer, 'image/webp')
  const { error: atlasError } = await services.database.from('packing_atlases').upsert({
    session_id: session.id,
    atlas_no: atlasNo,
    first_sequence_no: group[0]?.sequence_no,
    last_sequence_no: group.at(-1)?.sequence_no,
    object_key: objectKey,
    layout_version: PACKING_LAYOUT_VERSION,
    width: atlas.width,
    height: atlas.height,
    size_bytes: atlas.buffer.length,
    sha256: atlas.sha256,
  }, { onConflict: 'session_id,atlas_no,layout_version' })
  databaseError(atlasError, 'atlas_write_failed')
  await completeJob(services, job.job_id)
  const nextOffset = offset + group.length
  if (nextOffset < photos.length) {
    await enqueueJob(services, session.id, 'atlas', `photos:${nextOffset}`, `${job.input_fingerprint}:${nextOffset}`)
    return
  }
  const { data, error } = await services.database.from('packing_atlases').select('*')
    .eq('session_id', session.id).eq('layout_version', PACKING_LAYOUT_VERSION).order('atlas_no')
  databaseError(error, 'atlases_read_failed')
  for (const atlas of data as PackingAtlas[]) {
    await enqueueJob(services, session.id, 'observe', `atlas:${atlas.atlas_no}`, `${atlas.id}:${atlas.object_key}`)
  }
}

async function observeAtlasJob(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const atlasNo = Number(job.scope_key.split(':')[1])
  if (!Number.isInteger(atlasNo)) throw new Error('observe_scope_invalid')
  const { data, error } = await services.database.from('packing_atlases').select('*')
    .eq('session_id', job.session_id).eq('atlas_no', atlasNo).eq('layout_version', PACKING_LAYOUT_VERSION).single()
  databaseError(error, 'observe_atlas_missing')
  const atlas = data as PackingAtlas
  const image = await readR2Object(services, atlas.object_key)
  const result = await observeAtlas(services.config, atlas.id, image)
  const reviews = []
  const photos = await getPhotos(services, job.session_id)
  for (const observation of result.data.observations.filter((entry) => entry.requires_original_review).slice(0, 4)) {
    const sequence = Number(observation.best_crop_candidate_photo_id.slice(1))
    const photo = photos.find((entry) => entry.sequence_no === sequence)
    if (!photo) throw new Error('original_review_photo_missing')
    const original = await readR2Object(services, photo.normalized_object_key ?? photo.object_key)
    const review = await reviewOriginalObservation(services.config, {
      photoId: observation.best_crop_candidate_photo_id,
      proposedLabel: observation.label,
      image: original,
    })
    reviews.push(review.data)
    result.inputTokens += review.inputTokens
    result.outputTokens += review.outputTokens
    result.durationMs += review.durationMs
  }
  await completeJob(services, job.job_id, { ...result.data, original_reviews: reviews }, result)

  const { count, error: pendingError } = await services.database.from('packing_analysis_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', job.session_id)
    .eq('stage', 'observe')
    .in('status', ['pending', 'processing'])
  databaseError(pendingError, 'observe_pending_count_failed')
  if ((count ?? 0) === 0) {
    await enqueueJob(services, job.session_id, 'track_instances', 'session', `${PACKING_PROMPT_VERSION}:track`)
  }
}

async function trackInstances(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const { data, error } = await services.database.from('packing_analysis_jobs')
    .select('scope_key,result').eq('session_id', job.session_id).eq('stage', 'observe').eq('status', 'completed')
    .order('scope_key')
  databaseError(error, 'observations_read_failed')
  const result = await consolidateObservations(services.config, (data ?? []).map((row) => row.result))
  await completeJob(services, job.job_id, result.data, result)
  await enqueueJob(services, job.session_id, 'consolidate', 'session', `${PACKING_PROMPT_VERSION}:materialize`)
}

function photoByLabel(photos: PackingPhoto[], label: string): PackingPhoto {
  const sequence = Number(label.slice(1))
  const photo = photos.find((candidate) => candidate.sequence_no === sequence)
  if (!photo) throw new Error('consolidation_photo_reference_missing')
  return photo
}

async function materializeConsolidation(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const session = await getSession(services, job.session_id)
  const photos = await getPhotos(services, job.session_id)
  const { data: trackJob, error: trackError } = await services.database.from('packing_analysis_jobs')
    .select('result').eq('session_id', job.session_id).eq('stage', 'track_instances').eq('status', 'completed').single()
  databaseError(trackError, 'track_result_missing')
  const result = trackJob?.result as {
    items: Array<{
      name: string
      category: string | null
      description: string | null
      quantity: { kind: 'exact' | 'at_least' | 'approximate' | 'unknown'; value: number | null }
      visibility: string
      needs_review: boolean
      instances: Array<{
        provisional_name: string
        first_seen_photo_id: string
        last_seen_photo_id: string
        representative_photo_id: string
        evidence_photo_ids: string[]
        tracking_status: 'tracked' | 'ambiguous'
      }>
    }>
  }
  const revision = session.current_revision + 1
  const { error: clearError } = await services.database.from('packing_detected_items')
    .delete().eq('session_id', session.id).eq('analysis_revision', revision).is('published_at', null)
  databaseError(clearError, 'draft_revision_clear_failed')

  for (const item of result.items) {
    const firstPhoto = photoByLabel(photos, item.instances[0]!.first_seen_photo_id)
    const { data: insertedItem, error: itemError } = await services.database.from('packing_detected_items').insert({
      session_id: session.id,
      box_id: session.box_id,
      analysis_revision: revision,
      name: item.name,
      category: item.category,
      description: item.description,
      quantity_kind: item.quantity.kind,
      quantity_value: item.quantity.value,
      visibility: item.visibility,
      review_status: item.needs_review ? 'needs_review' : 'unreviewed',
      crop_status: 'pending',
      first_seen_photo_id: firstPhoto.id,
      model_id: services.config.QWEN_VL_MODEL,
      prompt_version: PACKING_PROMPT_VERSION,
    }).select('*').single()
    databaseError(itemError, 'detected_item_insert_failed')

    let representativeInstanceId: string | null = null
    for (const [instanceIndex, instance] of item.instances.entries()) {
      const representativePhoto = photoByLabel(photos, instance.representative_photo_id)
      const { data: insertedInstance, error: instanceError } = await services.database.from('packing_detected_instances').insert({
        session_id: session.id,
        detected_item_id: insertedItem.id,
        provisional_name: instance.provisional_name,
        tracking_status: instance.tracking_status,
        first_seen_photo_id: photoByLabel(photos, instance.first_seen_photo_id).id,
        last_seen_photo_id: photoByLabel(photos, instance.last_seen_photo_id).id,
        representative_photo_id: representativePhoto.id,
      }).select('*').single()
      databaseError(instanceError, 'detected_instance_insert_failed')
      if (instanceIndex === 0) representativeInstanceId = insertedInstance.id as string

      const evidenceRows = [...new Set(instance.evidence_photo_ids)].map((photoLabel) => {
        const photo = photoByLabel(photos, photoLabel)
        return {
          detected_instance_id: insertedInstance.id,
          photo_id: photo.id,
          evidence_kind: photoLabel === instance.first_seen_photo_id ? 'first_seen' : 'supporting',
          visibility: item.visibility,
          crop_suitable: photoLabel === instance.representative_photo_id,
        }
      })
      const { error: evidenceError } = await services.database.from('packing_detected_instance_evidence').insert(evidenceRows)
      databaseError(evidenceError, 'instance_evidence_insert_failed')
    }
    const { error: representativeError } = await services.database.from('packing_detected_items')
      .update({ representative_instance_id: representativeInstanceId }).eq('id', insertedItem.id)
    databaseError(representativeError, 'representative_instance_update_failed')
  }

  await completeJob(services, job.job_id)
  const { data: items, error: itemsError } = await services.database.from('packing_detected_items')
    .select('id').eq('session_id', session.id).eq('analysis_revision', revision)
  databaseError(itemsError, 'localization_items_read_failed')
  if ((items ?? []).length === 0) {
    await enqueueJob(services, session.id, 'publish', `revision:${revision}`, `${PACKING_PROMPT_VERSION}:publish`)
  } else {
    for (const item of items ?? []) {
      await enqueueJob(services, session.id, 'localize', `item:${item.id}`, `${PACKING_PROMPT_VERSION}:localize`)
    }
  }
}

async function localizeAndCrop(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const itemId = job.scope_key.split(':')[1]
  if (!itemId) throw new Error('localize_scope_invalid')
  const { data: item, error: itemError } = await services.database.from('packing_detected_items')
    .select('*').eq('id', itemId).single()
  databaseError(itemError, 'localize_item_missing')
  const session = await getSession(services, job.session_id)
  const { data: instance, error: instanceError } = await services.database.from('packing_detected_instances')
    .select('*').eq('id', item.representative_instance_id).single()
  databaseError(instanceError, 'localize_instance_missing')
  const { data: evidence, error: evidenceReadError } = await services.database
    .from('packing_detected_instance_evidence').select('photo_id,crop_suitable,created_at')
    .eq('detected_instance_id', instance.id).order('crop_suitable', { ascending: false }).order('created_at').limit(6)
  databaseError(evidenceReadError, 'localize_evidence_read_failed')
  const candidateIds = [...new Set([
    instance.representative_photo_id as string,
    ...(evidence ?? []).map((row) => row.photo_id as string),
  ].filter(Boolean))].slice(0, 3)
  const attempts: unknown[] = []
  const metrics: ModelMetrics = { inputTokens: 0, outputTokens: 0, durationMs: 0 }
  let succeeded = false
  let lastPhotoId: string | null = null
  let lastBox: unknown = null

  for (const candidateId of candidateIds) {
    const { data: photo, error: photoError } = await services.database.from('packing_photos')
      .select('*').eq('id', candidateId).single()
    databaseError(photoError, 'localize_photo_missing')
    const typedPhoto = photo as PackingPhoto
    lastPhotoId = typedPhoto.id
    const source = await readR2Object(services, typedPhoto.normalized_object_key ?? typedPhoto.object_key)
    const photoLabel = `P${String(typedPhoto.sequence_no).padStart(3, '0')}`
    const localization = await localizeInstance(services.config, {
      photoId: photoLabel, instanceId: instance.id as string, itemName: item.name as string, image: source,
    })
    metrics.inputTokens += localization.inputTokens
    metrics.outputTokens += localization.outputTokens
    metrics.durationMs += localization.durationMs
    if (!localization.data.crop_suitable) {
      attempts.push({ photo_id: photoLabel, localization: localization.data })
      continue
    }

    const crop = await cropPackingItem(services.images, new Response(source).body!, localization.data.bbox)
    lastBox = crop.bbox
    const validation = await validateItemCrop(services.config, { itemName: item.name as string, image: crop.buffer })
    metrics.inputTokens += validation.inputTokens
    metrics.outputTokens += validation.outputTokens
    metrics.durationMs += validation.durationMs
    attempts.push({ photo_id: photoLabel, localization: localization.data, validation: validation.data })
    if (!validation.data.valid) continue

    const objectKey = itemCropObjectKey({ ownerId: session.owner_id, boxId: session.box_id, sessionId: session.id, itemId })
    await writeR2Object(services, objectKey, crop.buffer, 'image/webp')
    const { error: itemUpdateError } = await services.database.from('packing_detected_items').update({
      cover_object_key: objectKey, cover_mime_type: 'image/webp', cover_size_bytes: crop.buffer.length,
      cover_width: crop.width, cover_height: crop.height, crop_source_photo_id: typedPhoto.id,
      crop_bbox: crop.bbox, crop_version: `${PACKING_PROMPT_VERSION}:cf-images-14pct-v1`, crop_status: 'ready',
    }).eq('id', itemId)
    databaseError(itemUpdateError, 'crop_item_update_failed')
    const { error: evidenceError } = await services.database.from('packing_detected_instance_evidence').upsert({
      detected_instance_id: instance.id, photo_id: typedPhoto.id, evidence_kind: 'verification',
      bbox: crop.bbox, visibility: item.visibility, crop_suitable: true,
    }, { onConflict: 'detected_instance_id,photo_id,evidence_kind' })
    databaseError(evidenceError, 'crop_evidence_update_failed')
    succeeded = true
    break
  }

  if (!succeeded) {
    const { error } = await services.database.from('packing_detected_items').update({
      crop_status: 'needs_review', review_status: 'needs_review', crop_source_photo_id: lastPhotoId, crop_bbox: lastBox,
    }).eq('id', itemId)
    databaseError(error, 'crop_review_update_failed')
  }
  await completeJob(services, job.job_id, { succeeded, attempts }, metrics)

  const { count, error: pendingError } = await services.database.from('packing_analysis_jobs')
    .select('id', { count: 'exact', head: true }).eq('session_id', job.session_id).eq('stage', 'localize')
    .in('status', ['pending', 'processing'])
  databaseError(pendingError, 'localize_pending_count_failed')
  if ((count ?? 0) === 0) {
    await enqueueJob(services, job.session_id, 'publish', `revision:${item.analysis_revision}`, `${PACKING_PROMPT_VERSION}:publish`)
  }
}

async function publishRevision(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const revision = Number(job.scope_key.split(':')[1])
  if (!Number.isInteger(revision) || revision < 1) throw new Error('publish_revision_invalid')
  const { error } = await services.database.rpc('publish_packing_revision', {
    p_session_id: job.session_id,
    p_revision: revision,
    p_model_id: services.config.QWEN_VL_MODEL,
    p_prompt_version: PACKING_PROMPT_VERSION,
    p_schema_version: PACKING_MODEL_SCHEMA_VERSION,
  })
  databaseError(error, 'publish_revision_failed')
  await completeJob(services, job.job_id)
}

async function promoteDetectedItem(services: WorkerServices, job: ClaimedJob): Promise<void> {
  const promotionId = job.scope_key.split(':')[1]
  if (!promotionId) throw new Error('promotion_scope_invalid')
  const { data: promotion, error: promotionError } = await services.database
    .from('packing_item_promotions').select('*').eq('id', promotionId).single()
  databaseError(promotionError, 'promotion_missing')
  if (promotion.status === 'completed') {
    await completeJob(services, job.job_id)
    return
  }

  const { error: processingError } = await services.database.from('packing_item_promotions').update({
    status: 'processing', last_error_code: null,
  }).eq('id', promotionId)
  databaseError(processingError, 'promotion_processing_update_failed')

  const { data: item, error: itemError } = await services.database.from('packing_detected_items')
    .select('cover_object_key,cover_mime_type,cover_size_bytes').eq('id', promotion.detected_item_id).single()
  databaseError(itemError, 'promotion_item_missing')
  if (!item) throw new Error('promotion_item_missing')
  if (!item.cover_object_key || !item.cover_mime_type || !item.cover_size_bytes) {
    throw new Error('promotion_crop_missing')
  }

  const image = await readR2Object(services, item.cover_object_key)
  await writeR2Object(services, promotion.target_object_key, image, item.cover_mime_type)
  const { error: finalizeError } = await services.database.rpc('finalize_packing_item_promotion', {
    p_promotion_id: promotionId,
    p_mime_type: item.cover_mime_type,
    p_size_bytes: image.length,
  })
  databaseError(finalizeError, 'promotion_finalize_failed')
  await completeJob(services, job.job_id)
}

export async function processPackingJob(services: WorkerServices, job: ClaimedJob): Promise<void> {
  try {
    if (job.stage === 'normalize') await normalizeSession(services, job)
    else if (job.stage === 'atlas') await generateAtlases(services, job)
    else if (job.stage === 'observe') await observeAtlasJob(services, job)
    else if (job.stage === 'track_instances') await trackInstances(services, job)
    else if (job.stage === 'consolidate') await materializeConsolidation(services, job)
    else if (job.stage === 'localize') await localizeAndCrop(services, job)
    else if (job.stage === 'publish' && job.scope_key.startsWith('promotion:')) await promoteDetectedItem(services, job)
    else if (job.stage === 'publish') await publishRevision(services, job)
    else throw new Error(`stage_not_implemented_${job.stage}`)
  } catch (error) {
    const code = safeErrorCode(error)
    if (job.stage === 'publish' && job.scope_key.startsWith('promotion:')) {
      const promotionId = job.scope_key.split(':')[1]
      if (promotionId) {
        await services.database.from('packing_item_promotions').update({
          status: 'failed', last_error_code: code,
        }).eq('id', promotionId)
      }
    }
    const { error: failureError } = await services.database.rpc('fail_packing_analysis_job', {
      p_job_id: job.job_id,
      p_error_code: code,
      p_retryable: !code.startsWith('stage_not_implemented'),
    })
    if (failureError) throw new Error(`job_failure_record_failed_${failureError.code}`)
    throw new Error(code)
  }
}

export async function claimPackingJobs(services: WorkerServices, batchSize: number): Promise<ClaimedJob[]> {
  const { data, error } = await services.database.rpc('claim_packing_analysis_jobs', {
    p_batch_size: batchSize,
    // Match the maximum Queue/Cron wall-clock window so a second Cron
    // invocation cannot reclaim a job while Qwen is still responding.
    p_lease_seconds: 900,
  })
  databaseError(error, 'job_claim_failed')
  return (data ?? []) as ClaimedJob[]
}
