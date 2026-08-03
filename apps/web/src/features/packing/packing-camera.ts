export function captureVideoFrameAsJpeg(video: HTMLVideoElement): Promise<File> {
  if (video.videoWidth < 1 || video.videoHeight < 1) {
    return Promise.reject(new Error('camera frame is not ready'))
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('camera canvas is unavailable'))
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('camera JPEG encoding failed'))
        return
      }
      resolve(new File([blob], `packing-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }))
    }, 'image/jpeg', 0.92)
  })
}
