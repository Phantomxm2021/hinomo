import imageCompression from 'browser-image-compression'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { getBox } from '../boxes/boxes.api'
import {
  completePackingSession,
  downloadPackingPhoto,
  getOrCreatePackingSession,
  listPackingPhotos,
  uploadPackingPhoto,
  uploadPackingAtlas,
} from './packing.api'
import { buildClientPackingAtlases } from './packing-atlas'
import {
  deletePackingDraft,
  listPackingDrafts,
  savePackingDraft,
  type PackingDraft,
} from './packing-storage'
import { PackingAuthorizedImage } from './PackingAuthorizedImage'

type UploadState = 'idle' | 'compressing' | 'uploading' | 'error'

function useDirectCameraPreference() {
  const query = '(hover: none) and (pointer: coarse)'
  const [preferred, setPreferred] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const update = () => setPreferred(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])
  return preferred
}

export function PackingCaptureSheet({ boxId, onClose, onCompleted }: {
  boxId: string
  onClose: () => void
  onCompleted: () => void
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve())
  const recoveredSessionRef = useRef<string | null>(null)
  const nextSequenceRef = useRef(1)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [localDraftCount, setLocalDraftCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const prefersDirectCamera = useDirectCameraPreference()

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [onClose])

  const boxQuery = useQuery({ queryKey: ['box-id', boxId], queryFn: () => getBox(boxId) })
  const sessionQuery = useQuery({
    queryKey: ['packing-session-active', boxId],
    queryFn: () => getOrCreatePackingSession(boxId),
    enabled: Boolean(boxId),
    retry: false,
  })
  const photosQuery = useQuery({
    queryKey: ['packing-photos', sessionQuery.data?.id],
    queryFn: () => listPackingPhotos(sessionQuery.data?.id ?? ''),
    enabled: Boolean(sessionQuery.data?.id),
  })

  const refreshPhotos = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['packing-photos', sessionQuery.data?.id] })
  }, [queryClient, sessionQuery.data?.id])

  const uploadDraft = useCallback(async (draft: PackingDraft) => {
    setUploadState('uploading')
    setErrorMessage(null)
    try {
      await uploadPackingPhoto({
        sessionId: draft.sessionId,
        sequenceNo: draft.sequenceNo,
        blob: draft.blob,
      })
      await deletePackingDraft(draft.id)
      setLocalDraftCount((count) => Math.max(0, count - 1))
      await refreshPhotos()
      setUploadState('idle')
    } catch {
      setUploadState('error')
      setErrorMessage('照片上传失败，已保存在这台设备上。恢复网络后会继续上传。')
      throw new Error('packing photo upload failed')
    }
  }, [refreshPhotos])

  const enqueueDraft = useCallback((draft: PackingDraft) => {
    uploadQueueRef.current = uploadQueueRef.current.catch(() => undefined).then(() => uploadDraft(draft))
    // Keep the rejected queue available to `finish`, while avoiding an unhandled
    // rejection when a background upload fails before the user finishes.
    void uploadQueueRef.current.catch(() => undefined)
    return uploadQueueRef.current
  }, [uploadDraft])

  const retryPendingDrafts = useCallback(async () => {
    const session = sessionQuery.data
    if (!session) return
    const drafts = await listPackingDrafts(session.id)
    setLocalDraftCount(drafts.length)
    setErrorMessage(null)
    for (const draft of drafts) void enqueueDraft(draft)
  }, [enqueueDraft, sessionQuery.data])

  useEffect(() => {
    const session = sessionQuery.data
    if (!session || recoveredSessionRef.current === session.id) return
    recoveredSessionRef.current = session.id
    void listPackingDrafts(session.id).then((drafts) => {
      const serverMax = Math.max(0, ...(photosQuery.data ?? []).map((photo) => photo.sequence_no))
      const draftMax = Math.max(0, ...drafts.map((draft) => draft.sequenceNo))
      nextSequenceRef.current = Math.max(serverMax, draftMax) + 1
      setLocalDraftCount(drafts.length)
      for (const draft of drafts) void enqueueDraft(draft)
    }).catch(() => setErrorMessage('无法恢复这台设备上的待上传照片。'))
  }, [enqueueDraft, sessionQuery.data, photosQuery.data])

  useEffect(() => {
    const serverMax = Math.max(0, ...(photosQuery.data ?? []).map((photo) => photo.sequence_no))
    nextSequenceRef.current = Math.max(nextSequenceRef.current, serverMax + 1)
  }, [photosQuery.data])

  useEffect(() => {
    const retryWhenOnline = () => { void retryPendingDrafts() }
    window.addEventListener('online', retryWhenOnline)
    return () => window.removeEventListener('online', retryWhenOnline)
  }, [retryPendingDrafts])

  const captureFile = async (file: File | null) => {
    const session = sessionQuery.data
    if (!file || !session) return
    if (nextSequenceRef.current > 100) {
      setErrorMessage('一次装箱最多支持 100 张照片。')
      return
    }

    setUploadState('compressing')
    setErrorMessage(null)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 4.5,
        maxWidthOrHeight: 2560,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.88,
      })
      const sequenceNo = nextSequenceRef.current++
      const draft: PackingDraft = {
        id: `${session.id}:${sequenceNo}`,
        sessionId: session.id,
        sequenceNo,
        blob: compressed,
        createdAt: new Date().toISOString(),
      }
      await savePackingDraft(draft)
      setLocalDraftCount((count) => count + 1)
      void enqueueDraft(draft)
    } catch {
      setUploadState('error')
      setErrorMessage('照片处理失败，请重新拍摄。')
    }
  }

  const finish = async () => {
    const session = sessionQuery.data
    if (!session) return
    setFinishing(true)
    setErrorMessage(null)
    try {
      await uploadQueueRef.current
      const drafts = await listPackingDrafts(session.id)
      if (drafts.length > 0) throw new Error('pending drafts remain')
      const photos = (await listPackingPhotos(session.id)).filter((photo) => photo.upload_status === 'confirmed')
      const atlases = await buildClientPackingAtlases(photos, downloadPackingPhoto)
      for (const atlas of atlases) await uploadPackingAtlas(session.id, atlas)
      await completePackingSession(session.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['packing-session-active', boxId] }),
        queryClient.invalidateQueries({ queryKey: ['packing-sessions', boxId] }),
      ])
      onCompleted()
    } catch {
      setErrorMessage('照片或分析索引尚未上传完成，请检查网络后重试。')
    } finally {
      setFinishing(false)
    }
  }

  if (boxQuery.isPending || sessionQuery.isPending) {
    return createPortal(<PackingSheetFrame title="AI 装箱" onClose={onClose} closeButtonRef={closeButtonRef}><div className="grid min-h-72 place-content-center"><p className="font-bold text-muted">正在准备装箱记录…</p></div></PackingSheetFrame>, document.body)
  }
  if (!boxQuery.data || sessionQuery.isError) {
    return createPortal(<PackingSheetFrame title="AI 装箱" onClose={onClose} closeButtonRef={closeButtonRef}><div className="p-5"><PageState state="error" message="无法开始 AI 装箱" onRetry={() => void sessionQuery.refetch()} /></div></PackingSheetFrame>, document.body)
  }

  const confirmedCount = photosQuery.data?.filter((photo) => photo.upload_status === 'confirmed').length ?? 0
  const latestPhoto = photosQuery.data?.filter((photo) => photo.upload_status === 'confirmed').at(-1)
  const totalCount = confirmedCount + localDraftCount
  const busy = uploadState === 'compressing' || uploadState === 'uploading' || finishing

  return createPortal(
    <PackingSheetFrame
      title="AI 装箱"
      subtitle={`${boxQuery.data.box_code} · ${boxQuery.data.name} · ${totalCount} 张`}
      onClose={onClose}
      closeButtonRef={closeButtonRef}
      action={(
        <button
          className="min-h-11 justify-self-end rounded-full px-2 text-[1.0625rem] font-bold text-brand disabled:text-muted/50"
          type="button"
          disabled={busy || totalCount === 0 || localDraftCount > 0}
          onClick={() => void finish()}
        >{finishing ? '整理中…' : '完成'}</button>
      )}
    >
      <div className="min-h-0 overflow-y-auto">
        <section className="grid min-h-full place-content-center justify-items-center gap-5 px-7 py-8 text-center lg:px-10 lg:py-10">
        {latestPhoto ? (
          <div className="relative aspect-[4/3] w-full max-w-xl overflow-hidden rounded-[1.75rem] bg-placeholder shadow-soft">
            <PackingAuthorizedImage objectKey={latestPhoto.object_key} alt={`第 ${latestPhoto.sequence_no} 张装箱照片`} className="h-full w-full object-cover" />
            <span className="absolute top-3 left-3 rounded-full bg-ink/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">最近一张 · {confirmedCount}</span>
          </div>
        ) : (
          <div className="grid size-24 place-content-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/10">
            <AppIcon name="scan" size={38} />
          </div>
        )}
        <div className="max-w-md">
          <h2 className="m-0 text-[1.45rem] leading-tight font-extrabold text-ink">{latestPhoto ? '继续记录下一件' : '从第一件物品开始'}</h2>
          <p className="mt-2 text-[0.95rem] leading-6 text-muted">每放入一个物件，拍一张。无需填写名称和数量，完成后 AI 会自动整理成带图片的清单。</p>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture={prefersDirectCamera ? 'environment' : undefined}
          aria-label="拍摄装箱照片"
          onChange={(event) => {
            void captureFile(event.target.files?.[0] ?? null)
            event.currentTarget.value = ''
          }}
        />
        <button
          className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-brand px-7 text-base font-extrabold text-white shadow-soft active:scale-[0.98] disabled:opacity-40"
          type="button"
          disabled={uploadState === 'compressing' || totalCount >= 100}
          onClick={() => inputRef.current?.click()}
        >
          <AppIcon name={prefersDirectCamera ? 'scan' : 'plus'} size={21} />
          {uploadState === 'compressing' ? '正在处理…' : prefersDirectCamera ? '拍摄这件物品' : '选择物品照片'}
        </button>
        <p className="min-h-5 text-xs font-semibold text-muted" role="status">
          {uploadState === 'compressing' ? '正在处理照片…' : uploadState === 'uploading' ? `正在安全上传 · ${confirmedCount} 张完成` : localDraftCount > 0 ? `${localDraftCount} 张等待上传` : confirmedCount > 0 ? `${confirmedCount} 张已安全保存` : prefersDirectCamera ? '将请求使用后置相机' : '支持 JPEG、PNG 与 WebP 图片'}
        </p>
          {errorMessage ? <ResponsiveOperationError message={errorMessage} onRetry={() => void retryPendingDrafts()} /> : null}
        </section>
      </div>
    </PackingSheetFrame>,
    document.body,
  )
}

function PackingSheetFrame({ title, subtitle, action, onClose, closeButtonRef, children }: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  onClose: () => void
  closeButtonRef: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] lg:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="grid h-[94dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[1.75rem] bg-canvas shadow-float lg:h-[min(52rem,calc(100dvh-3rem))] lg:rounded-[1.75rem]" role="dialog" aria-modal="true" aria-labelledby="packing-sheet-title">
        <header className="relative grid min-h-[4.75rem] grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center border-b border-line/60 bg-surface/90 px-4 pt-3 backdrop-blur-xl">
          <button ref={closeButtonRef} className="min-h-11 justify-self-start rounded-full px-1 text-[1.0625rem] font-semibold text-brand active:opacity-50" type="button" aria-label="关闭 AI 装箱" onClick={onClose}>取消</button>
          <div className="min-w-0 text-center">
            <div className="absolute top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line lg:hidden" aria-hidden="true" />
            <h1 className="m-0 truncate text-[1.0625rem] font-extrabold text-ink" id="packing-sheet-title">{title}</h1>
            {subtitle ? <p className="mt-0.5 truncate text-xs font-semibold text-muted">{subtitle}</p> : null}
          </div>
          {action ?? <span />}
        </header>
        {children}
      </section>
    </div>
  )
}
