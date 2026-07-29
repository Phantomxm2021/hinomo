import type { UploadStage } from './useMediaUpload'

const uploadStageLabels: Partial<Record<UploadStage, string>> = {
  compressing: '正在压缩',
  signing: '正在获取上传凭证',
  uploading: '正在上传',
  confirming: '正在确认',
  complete: '上传完成',
}

export function uploadStageLabel(stage: UploadStage) {
  return uploadStageLabels[stage] ?? null
}

export function isUploadPending(stage: UploadStage) {
  return ['compressing', 'signing', 'uploading', 'confirming'].includes(stage)
}
