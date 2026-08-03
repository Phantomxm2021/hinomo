export type PackingImageTransform = {
  width?: number
  height?: number
  background?: string
  fit?: 'scale-down' | 'contain' | 'pad' | 'squeeze' | 'cover' | 'crop'
  trim?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
    width?: number
    height?: number
  }
}

export type PackingImageInfo = {
  format: string
  fileSize?: number
  width?: number
  height?: number
}

export interface PackingImageTransformer {
  transform(transform: PackingImageTransform): PackingImageTransformer
  draw(image: ReadableStream<Uint8Array> | PackingImageTransformer, options?: {
    top?: number
    left?: number
    bottom?: number
    right?: number
  }): PackingImageTransformer
  output(options: {
    format: 'image/webp'
    quality?: number
    anim?: boolean
  }): Promise<{ response(): Response }>
}

export interface PackingImagesBinding {
  input(stream: ReadableStream<Uint8Array>): PackingImageTransformer
  info(stream: ReadableStream<Uint8Array>): Promise<PackingImageInfo>
}

export interface PackingR2Bucket {
  get(key: string): Promise<{
    body: ReadableStream<Uint8Array>
    arrayBuffer(): Promise<ArrayBuffer>
  } | null>
  put(key: string, value: Uint8Array<ArrayBuffer>, options?: {
    httpMetadata?: { contentType?: string }
  }): Promise<unknown>
}

export interface PackingExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}
