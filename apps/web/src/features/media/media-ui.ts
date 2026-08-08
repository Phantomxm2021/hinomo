import type { UploadStage } from './useMediaUpload'

const uploadStageLabels: Partial<Record<UploadStage, string>> = {
  compressing: 'media.upload.compressing',
  signing: 'media.upload.signing',
  uploading: 'media.upload.uploading',
  confirming: 'media.upload.confirming',
  complete: 'media.upload.complete',
}

export function uploadStageLabel(stage: UploadStage) {
  return uploadStageLabels[stage] ?? null
}

export function isUploadPending(stage: UploadStage) {
  return ['compressing', 'signing', 'uploading', 'confirming'].includes(stage)
}
