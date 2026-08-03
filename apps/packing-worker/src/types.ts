export const PACKING_MODEL_SCHEMA_VERSION = '1'
export const PACKING_PROMPT_VERSION = 'packing-atlas-v1'
export const PACKING_LAYOUT_VERSION = 'grid-4x4-v1'

export type PackingJobStage =
  | 'normalize'
  | 'atlas'
  | 'observe'
  | 'verify'
  | 'track_instances'
  | 'consolidate'
  | 'localize'
  | 'crop'
  | 'validate_crops'
  | 'publish'

export type ClaimedJob = {
  job_id: string
  session_id: string
  stage: PackingJobStage
  scope_key: string
  attempts: number
  input_fingerprint: string
}

export type PackingPhoto = {
  id: string
  session_id: string
  box_id: string
  owner_id: string
  sequence_no: number
  object_key: string
  normalized_object_key: string | null
  mime_type: string
  size_bytes: number
  width: number | null
  height: number | null
  upload_status: 'pending' | 'confirmed' | 'expired'
}

export type PackingAtlas = {
  id: string
  session_id: string
  atlas_no: number
  first_sequence_no: number
  last_sequence_no: number
  object_key: string
  layout_version: string
}

export type PackingSession = {
  id: string
  box_id: string
  owner_id: string
  photo_count: number
  current_revision: number
  status: string
}
