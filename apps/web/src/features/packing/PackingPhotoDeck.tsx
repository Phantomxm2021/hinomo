import { useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import type { PackingPhoto } from './packing.api'
import { PackingAuthorizedImage } from './PackingAuthorizedImage'

const SWIPE_THRESHOLD = 42

function stackedCardStyle(distance: number) {
  if (distance === 0) return { transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1)', opacity: 1 }
  const depth = Math.abs(distance)
  const direction = distance > 0 ? 1 : depth % 2 === 0 ? 1 : -1
  return {
    transform: `translate3d(${direction * (10 + depth * 4)}px, ${depth * 8}px, 0) rotate(${direction * (1.5 + depth * 0.75)}deg) scale(${1 - depth * 0.035})`,
    opacity: 1 - depth * 0.12,
  }
}

export function PackingPhotoDeck({ photos, onRemove, removingPhotoId }: {
  photos: PackingPhoto[]
  onRemove?: (photo: PackingPhoto) => void
  removingPhotoId?: string | null
}) {
  const orderedPhotos = useMemo(() => [...photos].sort((a, b) => a.sequence_no - b.sequence_no), [photos])
  const newestPhotoId = orderedPhotos.at(-1)?.id
  const [activeIndex, setActiveIndex] = useState(() => Math.max(orderedPhotos.length - 1, 0))
  const pointerStartX = useRef<number | null>(null)

  useEffect(() => {
    setActiveIndex(Math.max(orderedPhotos.length - 1, 0))
  }, [newestPhotoId, orderedPhotos.length])

  if (orderedPhotos.length === 0) return null

  const showPrevious = () => setActiveIndex((index) => Math.max(index - 1, 0))
  const showNext = () => setActiveIndex((index) => Math.min(index + 1, orderedPhotos.length - 1))
  const visiblePhotos = orderedPhotos
    .map((photo, index) => ({ photo, index, distance: index - activeIndex }))
    .filter(({ distance }) => Math.abs(distance) <= 2)

  return (
    <div className="w-full max-w-xl" role="region" aria-label="已拍照片">
      <div
        className="relative mx-5 aspect-[4/3] touch-pan-y select-none [&_img]:pointer-events-none"
        onPointerDown={(event) => {
          pointerStartX.current = event.clientX
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerUp={(event) => {
          if (pointerStartX.current === null) return
          const movement = event.clientX - pointerStartX.current
          pointerStartX.current = null
          if (movement <= -SWIPE_THRESHOLD) showNext()
          if (movement >= SWIPE_THRESHOLD) showPrevious()
        }}
        onPointerCancel={() => { pointerStartX.current = null }}
      >
        {visiblePhotos.map(({ photo, index, distance }) => (
          <div
            key={photo.id}
            className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/70 bg-placeholder shadow-float transition-[transform,opacity] duration-300 ease-out"
            style={{ ...stackedCardStyle(distance), zIndex: distance === 0 ? 10 : 5 - Math.abs(distance) }}
            aria-hidden={distance !== 0}
          >
            <PackingAuthorizedImage
              objectKey={photo.object_key}
              alt={`第 ${photo.sequence_no} 张装箱照片`}
              className="h-full w-full object-cover"
            />
            {distance === 0 ? (
              <>
                <span className="absolute top-3 left-3 rounded-full bg-ink/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                  第 {index + 1} 张
                </span>
                {onRemove ? (
                  <button
                    className="absolute top-3 right-3 min-h-9 rounded-full bg-ink/65 px-3 text-xs font-bold text-white backdrop-blur-md disabled:opacity-50"
                    type="button"
                    disabled={Boolean(removingPhotoId)}
                    aria-label={`移除第 ${index + 1} 张照片`}
                    onClick={() => onRemove(photo)}
                  >{removingPhotoId === photo.id ? '移除中…' : '移除'}</button>
                ) : null}
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-soft disabled:opacity-25"
          type="button"
          aria-label="上一张照片"
          disabled={activeIndex === 0}
          onClick={showPrevious}
        >
          <AppIcon className="rotate-180" name="chevron-right" size={19} />
        </button>
        <p className="min-w-24 text-sm font-bold tabular-nums text-muted" aria-live="polite">
          {activeIndex + 1} / {orderedPhotos.length}
          <span className="sr-only">，左右滑动切换</span>
        </p>
        <button
          className="grid size-10 place-items-center rounded-full bg-surface text-ink shadow-soft disabled:opacity-25"
          type="button"
          aria-label="下一张照片"
          disabled={activeIndex === orderedPhotos.length - 1}
          onClick={showNext}
        >
          <AppIcon name="chevron-right" size={19} />
        </button>
      </div>
    </div>
  )
}
