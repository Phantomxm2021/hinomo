import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useI18n } from '../../i18n/I18nProvider'
import { PHOTO_UPLOAD_MAX_BYTES } from '../../lib/photo-compression'
import { getBox } from '../boxes/boxes.api'
import {
  completePackingSession,
  deletePackingPhoto,
  downloadPackingPhoto,
  getOrCreatePackingSession,
  listPackingPhotos,
  uploadPackingPhoto,
  uploadPackingAtlas,
  PackingPhotoUploadError,
} from './packing.api'
import { buildClientPackingAtlases } from './packing-atlas'
import { compressPackingPhoto, PackingImageConversionError } from './packing-image'
import {
  deletePackingDraft,
  listPackingDrafts,
  savePackingDraft,
  type PackingDraft,
} from './packing-storage'
import { PackingPhotoDeck } from './PackingPhotoDeck'
import { packingBillingError } from '../credits/credits.api'

type UploadState = 'idle' | 'compressing' | 'uploading' | 'error'
type FinishStage = 'wait_photo_uploads' | 'check_pending_drafts' | 'load_confirmed_photos' | 'build_atlas' | 'upload_atlas' | 'complete_session' | 'refresh_state'
type PackingError = { key: string; params?: Record<string, string | number | boolean> }

const LIBRARY_ACCEPT = 'image/jpeg,image/png,image/webp'
const CAMERA_ACCEPT = 'image/jpeg'

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    const cause = error.cause
    return {
      name: error.name,
      message: error.message,
      stage: error instanceof PackingPhotoUploadError ? error.stage : undefined,
      status: error instanceof PackingPhotoUploadError ? error.status : undefined,
      cause: cause instanceof Error
        ? { name: cause.name, message: cause.message }
        : cause && typeof cause === 'object'
          ? Object.fromEntries(Object.entries(cause).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)))
          : cause ? String(cause) : undefined,
    }
  }
  if (error && typeof error === 'object') {
    return Object.fromEntries(Object.entries(error).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)))
  }
  return { value: String(error) }
}

function reportPackingDevError(event: string, details: Record<string, unknown>) {
  const payload = {
    event,
    page: window.location.href,
    userAgent: navigator.userAgent,
    ...details,
  }
  console.error(event, payload)
  if (import.meta.env.DEV) {
    void fetch('/__nomo/dev-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined)
  }
}

function reportPackingPhotoError(file: Pick<File, 'name' | 'type' | 'size'>, error: unknown, event = 'packing_photo_processing_failed') {
  reportPackingDevError(event, {
    file: { name: file.name, type: file.type || '(empty)', size: file.size },
    code: error instanceof PackingImageConversionError ? error.code : 'unexpected_error',
    error: errorDetails(error),
  })
}

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

export function PackingCaptureSheet({ boxId, onClose, onCompleted, onBillingBlocked, onVenueAccessDenied }: {
  boxId: string
  onClose: () => void
  onCompleted: () => void
  onBillingBlocked?: (reason: 'insufficient_credits', requiredCredits: number) => void
  onVenueAccessDenied: (error: unknown) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve())
  const volatileDraftsRef = useRef(new Map<string, PackingDraft>())
  const recoveredSessionRef = useRef<string | null>(null)
  const nextSequenceRef = useRef(1)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [localDraftCount, setLocalDraftCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<PackingError | null>(null)
  const [canRetryUploads, setCanRetryUploads] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null)
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

  useEffect(() => {
    for (const error of [boxQuery.error, sessionQuery.error, photosQuery.error]) {
      if (error) onVenueAccessDenied(error)
    }
  }, [boxQuery.error, onVenueAccessDenied, photosQuery.error, sessionQuery.error])

  const refreshPhotos = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['packing-photos', sessionQuery.data?.id] })
  }, [queryClient, sessionQuery.data?.id])

  const uploadDraft = useCallback(async (draft: PackingDraft, persisted = true) => {
    setUploadState('uploading')
    setErrorMessage(null)
    let readyDraft = draft
    if (draft.blob.size > PHOTO_UPLOAD_MAX_BYTES) {
      try {
        const recompressed = await compressPackingPhoto(new File(
          [draft.blob],
          `packing-${draft.sequenceNo}.jpg`,
          { type: draft.blob.type || 'image/jpeg' },
        ))
        readyDraft = { ...draft, blob: new Blob([recompressed], { type: 'image/jpeg' }) }
        if (persisted) await savePackingDraft(readyDraft)
        else volatileDraftsRef.current.set(readyDraft.id, readyDraft)
      } catch (error) {
        reportPackingPhotoError({
          name: `packing-${draft.sequenceNo}.jpg`,
          type: draft.blob.type,
          size: draft.blob.size,
        }, error, 'packing_draft_recompression_failed')
        setUploadState('error')
        setCanRetryUploads(true)
        setErrorMessage({ key: 'packing.compressFailed' })
        throw new Error('packing draft recompression failed')
      }
    }
    try {
      await uploadPackingPhoto({
        sessionId: readyDraft.sessionId,
        sequenceNo: readyDraft.sequenceNo,
        blob: readyDraft.blob,
      })
    } catch (error) {
      reportPackingPhotoError({
        name: `packing-${draft.sequenceNo}.jpg`,
        type: readyDraft.blob.type,
        size: readyDraft.blob.size,
      }, error, 'packing_photo_upload_failed')
      setUploadState('error')
      setCanRetryUploads(true)
      setErrorMessage({ key: persisted ? 'packing.uploadFailedStored' : 'packing.uploadFailedLost' })
      onVenueAccessDenied(error)
      throw new Error('packing photo upload failed', { cause: error })
    }

    try {
      if (persisted) await deletePackingDraft(draft.id)
      volatileDraftsRef.current.delete(draft.id)
      setLocalDraftCount((count) => Math.max(0, count - 1))
      await refreshPhotos()
      setUploadState('idle')
    } catch (error) {
      console.error('packing_draft_cleanup_failed', { draftId: draft.id, error: errorDetails(error) })
      setLocalDraftCount((count) => Math.max(0, count - 1))
      await refreshPhotos()
      setUploadState('idle')
    }
  }, [onVenueAccessDenied, refreshPhotos])

  const enqueueDraft = useCallback((draft: PackingDraft, persisted = true) => {
    uploadQueueRef.current = uploadQueueRef.current.catch(() => undefined).then(() => uploadDraft(draft, persisted))
    // Keep the rejected queue available to `finish`, while avoiding an unhandled
    // rejection when a background upload fails before the user finishes.
    void uploadQueueRef.current.catch(() => undefined)
    return uploadQueueRef.current
  }, [uploadDraft])

  const retryPendingDrafts = useCallback(async () => {
    const session = sessionQuery.data
    if (!session) return
    const persistedDrafts = await listPackingDrafts(session.id).catch(() => [])
    const drafts = [...persistedDrafts, ...volatileDraftsRef.current.values()]
    setLocalDraftCount(drafts.length)
    setErrorMessage(null)
    setCanRetryUploads(false)
    for (const draft of persistedDrafts) void enqueueDraft(draft, true)
    for (const draft of volatileDraftsRef.current.values()) void enqueueDraft(draft, false)
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
    }).catch(() => {
      setCanRetryUploads(false)
      setErrorMessage({ key: 'packing.resumeFailed' })
    })
  }, [enqueueDraft, sessionQuery.data, photosQuery.data, t])

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
      setErrorMessage({ key: 'packing.maxPhotos' })
      return
    }

    setUploadState('compressing')
    setErrorMessage(null)
    setCanRetryUploads(false)
    let compressed: File
    try {
      compressed = await compressPackingPhoto(file)
    } catch (error) {
      reportPackingPhotoError(file, error)
      setUploadState('error')
      setErrorMessage(error instanceof PackingImageConversionError && error.code === 'heic_not_supported'
        ? { key: 'packing.heicUnsupported' }
        : error instanceof PackingImageConversionError && error.code === 'unsupported_image'
          ? { key: 'packing.invalidPhoto' }
          : { key: 'packing.photoCompressFailed' })
      return
    }

    const sequenceNo = nextSequenceRef.current++
    const draft: PackingDraft = {
      id: `${session.id}:${sequenceNo}`,
      sessionId: session.id,
      sequenceNo,
      blob: new Blob([compressed], { type: 'image/jpeg' }),
      createdAt: new Date().toISOString(),
    }
    let persisted = true
    try {
      await savePackingDraft(draft)
    } catch (error) {
      persisted = false
      volatileDraftsRef.current.set(draft.id, draft)
      reportPackingPhotoError(file, error, 'packing_draft_storage_failed')
    }
    setLocalDraftCount((count) => count + 1)
    void enqueueDraft(draft, persisted)
  }

  const removePhoto = async (photoId: string) => {
    setRemovingPhotoId(photoId)
    setErrorMessage(null)
    setCanRetryUploads(false)
    try {
      await deletePackingPhoto(photoId)
      await refreshPhotos()
    } catch (error) {
      onVenueAccessDenied(error)
      setErrorMessage({ key: 'packing.removePhotoFailed' })
    } finally {
      setRemovingPhotoId(null)
    }
  }

  const finish = async () => {
    const session = sessionQuery.data
    if (!session) return
    let stage: FinishStage = 'wait_photo_uploads'
    let confirmedPhotoCount = 0
    let atlasCount = 0
    let currentAtlasNo: number | null = null
    setFinishing(true)
    setErrorMessage(null)
    setCanRetryUploads(false)
    try {
      await uploadQueueRef.current
      stage = 'check_pending_drafts'
      const drafts = await listPackingDrafts(session.id)
      if (drafts.length > 0 || volatileDraftsRef.current.size > 0) throw new Error('pending drafts remain')
      stage = 'load_confirmed_photos'
      const photos = (await listPackingPhotos(session.id)).filter((photo) => photo.upload_status === 'confirmed')
      confirmedPhotoCount = photos.length
      stage = 'build_atlas'
      const atlases = await buildClientPackingAtlases(photos, downloadPackingPhoto)
      atlasCount = atlases.length
      stage = 'upload_atlas'
      for (const atlas of atlases) {
        currentAtlasNo = atlas.atlasNo
        await uploadPackingAtlas(session.id, atlas)
      }
      currentAtlasNo = null
      stage = 'complete_session'
      await completePackingSession(session.id)
      stage = 'refresh_state'
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['packing-session-active', boxId] }),
        queryClient.invalidateQueries({ queryKey: ['packing-sessions', boxId] }),
      ])
      onCompleted()
    } catch (error) {
      const billingError = packingBillingError(error)
      if (billingError) {
        onBillingBlocked?.(billingError, Math.max(1, (photosQuery.data?.length ?? 0) + localDraftCount))
        return
      }
      onVenueAccessDenied(error)
      reportPackingDevError('packing_finish_failed', {
        stage,
        sessionId: session.id,
        confirmedPhotoCount,
        atlasCount,
        currentAtlasNo,
        persistentDraftCount: await listPackingDrafts(session.id).then((drafts) => drafts.length).catch(() => null),
        volatileDraftCount: volatileDraftsRef.current.size,
        error: errorDetails(error),
      })
      setErrorMessage({ key: 'packing.uploadIncomplete' })
      setCanRetryUploads(true)
    } finally {
      setFinishing(false)
    }
  }

  if (boxQuery.isPending || sessionQuery.isPending) {
    return createPortal(<PackingSheetFrame title={t('packing.title')} onClose={onClose} closeButtonRef={closeButtonRef}><div className="grid min-h-72 place-content-center"><p className="font-bold text-muted">{t('packing.prepare')}</p></div></PackingSheetFrame>, document.body)
  }
  if (!boxQuery.data || sessionQuery.isError) {
    return createPortal(<PackingSheetFrame title={t('packing.title')} onClose={onClose} closeButtonRef={closeButtonRef}><div className="p-5"><PageState state="error" message={t('packing.startFailed')} onRetry={() => void sessionQuery.refetch()} /></div></PackingSheetFrame>, document.body)
  }

  const confirmedPhotos = photosQuery.data?.filter((photo) => photo.upload_status === 'confirmed') ?? []
  const confirmedCount = confirmedPhotos.length
  const latestPhoto = confirmedPhotos.at(-1)
  const totalCount = confirmedCount + localDraftCount
  const busy = uploadState === 'compressing' || uploadState === 'uploading' || finishing || Boolean(removingPhotoId)

  return createPortal(
    <PackingSheetFrame
      title={t('packing.title')}
      subtitle={`${boxQuery.data.box_code} · ${boxQuery.data.name} · ${t('packing.countLabel', { count: totalCount })}`}
      onClose={onClose}
      closeButtonRef={closeButtonRef}
      action={(
        <button
          className="min-h-11 justify-self-end rounded-full px-2 text-[1.0625rem] font-bold text-brand disabled:text-muted/50"
          type="button"
          disabled={busy || totalCount === 0 || localDraftCount > 0}
          onClick={() => void finish()}
        >{finishing ? t('packing.finishing') : t('packing.finish')}</button>
      )}
    >
      <div className="min-h-0 overflow-y-auto">
        <section className="grid min-h-full place-content-center justify-items-center gap-5 px-7 py-8 text-center lg:px-10 lg:py-10">
        {latestPhoto ? (
          <PackingPhotoDeck photos={confirmedPhotos} removingPhotoId={removingPhotoId} onRemove={(photo) => void removePhoto(photo.id)} />
        ) : (
          <div className="grid size-24 place-content-center rounded-full bg-brand/10 text-brand ring-1 ring-brand/10">
            <AppIcon name="scan" size={38} />
          </div>
        )}
        <div className="max-w-md">
          <h2 className="m-0 text-[1.45rem] leading-tight font-extrabold text-ink">{latestPhoto ? t('packing.continueNext') : t('packing.startFirst')}</h2>
          <p className="mt-2 text-[0.95rem] leading-6 text-muted">{t('packing.instructions')}</p>
          {totalCount > 0 ? <p className="mt-2 text-sm font-extrabold text-brand">{t('packing.creditsCost', { count: totalCount })}</p> : null}
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={prefersDirectCamera ? CAMERA_ACCEPT : LIBRARY_ACCEPT}
          capture={prefersDirectCamera ? 'environment' : undefined}
          aria-label={t('packing.captureLabel')}
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
          {uploadState === 'compressing' ? t('packing.process') : prefersDirectCamera ? t('packing.captureItem') : t('packing.choosePhoto')}
        </button>
        <p className="min-h-5 text-xs font-semibold text-muted" role="status">
          {uploadState === 'compressing' ? t('packing.processPhoto') : uploadState === 'uploading' ? t('packing.uploadProgress', { count: confirmedCount }) : localDraftCount > 0 ? t('packing.pendingUpload', { count: localDraftCount }) : confirmedCount > 0 ? t('packing.savedCount', { count: confirmedCount }) : prefersDirectCamera ? t('packing.cameraHint') : t('packing.formatHint')}
        </p>
          {errorMessage ? <ResponsiveOperationError message={t(errorMessage.key, errorMessage.params)} onRetry={canRetryUploads ? () => void retryPendingDrafts() : undefined} /> : null}
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
  const { t } = useI18n()
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] lg:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="grid h-[94dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[1.75rem] bg-canvas shadow-float lg:h-[min(52rem,calc(100dvh-3rem))] lg:rounded-[1.75rem]" role="dialog" aria-modal="true" aria-labelledby="packing-sheet-title">
        <header className="relative grid min-h-[4.75rem] grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center border-b border-line/60 bg-surface/90 px-4 pt-3 backdrop-blur-xl">
          <button ref={closeButtonRef} className="min-h-11 justify-self-start rounded-full px-1 text-[1.0625rem] font-semibold text-brand active:opacity-50" type="button" aria-label={t('packing.close')} onClick={onClose}>{t('packing.cancel')}</button>
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
