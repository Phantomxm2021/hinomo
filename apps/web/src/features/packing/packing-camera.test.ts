import { afterEach, expect, test, vi } from 'vitest'
import { captureVideoFrameAsJpeg } from './packing-camera'

afterEach(() => vi.restoreAllMocks())

test('captures the current camera frame as a JPEG file', async () => {
  const drawImage = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
    callback(new Blob(['jpeg'], { type: type ?? 'image/jpeg' }))
  })
  const video = document.createElement('video')
  Object.defineProperties(video, {
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
  })

  const result = await captureVideoFrameAsJpeg(video)

  expect(result.type).toBe('image/jpeg')
  expect(result.name).toMatch(/^packing-\d+\.jpg$/)
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1920, 1080)
})

test('does not capture before the camera has a frame', async () => {
  await expect(captureVideoFrameAsJpeg(document.createElement('video'))).rejects.toThrow('camera frame is not ready')
})
