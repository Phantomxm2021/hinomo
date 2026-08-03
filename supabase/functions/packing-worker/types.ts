export const PACKING_MODEL_SCHEMA_VERSION = '1'
export const PACKING_PROMPT_VERSION = 'packing-atlas-v4'
export const PACKING_LAYOUT_VERSION = 'client-grid-4x4-v1'

export type PackingJobStage = 'observe' | 'track_instances' | 'consolidate' | 'localize' | 'publish'
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
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp'
}
export type PackingAtlas = {
  id: string
  session_id: string
  atlas_no: number
  object_key: string
}
export type PackingSession = {
  id: string
  box_id: string
  owner_id: string
  current_revision: number
}
