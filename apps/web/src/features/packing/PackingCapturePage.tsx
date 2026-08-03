import imageCompression from 'browser-image-compression'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { getBox } from '../boxes/boxes.api'
import {
  completePackingSession,
  getOrCreatePackingSession,
  listPackingPhotos,
  uploadPackingPhoto,
} from './packing.api'
import {
  deletePackingDraft,
  listPackingDrafts,
  savePackingDraft,
  type PackingDraft,
} from './packing-storage'
import { PackingAuthorizedImage } from './PackingAuthorizedImage'

type UploadState = 'idle' | 'compressing' | 'uploading' | 'error'

export function PackingCapturePage() {
  const { boxId = '' } = useParams<{ boxId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve())
  const recoveredSessionRef = useRef<string | null>(null)
  const nextSequenceRef = useRef(1)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [localDraftCount, setLocalDraftCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

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
        maxSizeMB: 7.5,
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
      await completePackingSession(session.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['packing-session-active', boxId] }),
        queryClient.invalidateQueries({ queryKey: ['packing-sessions', boxId] }),
      ])
      navigate(`/app/boxes/${boxId}`, { replace: true })
    } catch {
      setErrorMessage('还有照片未上传完成，请检查网络后重试。')
    } finally {
      setFinishing(false)
    }
  }

  if (boxQuery.isPending || sessionQuery.isPending) {
    return <main className="mx-auto grid min-h-[70dvh] max-w-3xl place-content-center"><p className="font-bold text-muted">正在准备装箱记录…</p></main>
  }
  if (!boxQuery.data || sessionQuery.isError) {
    return <main className="mx-auto w-full max-w-3xl py-6"><PageState state="error" message="无法开始 AI 装箱" onRetry={() => void sessionQuery.refetch()} /></main>
  }

  const confirmedCount = photosQuery.data?.filter((photo) => photo.upload_status === 'confirmed').length ?? 0
  const latestPhoto = photosQuery.data?.filter((photo) => photo.upload_status === 'confirmed').at(-1)
  const totalCount = confirmedCount + localDraftCount
  const busy = uploadState === 'compressing' || uploadState === 'uploading' || finishing

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-3xl grid-rows-[auto_1fr_auto] gap-5 py-3 pb-[calc(7rem+var(--safe-area-bottom))] lg:py-6 lg:pb-8">
      <nav className="flex items-center justify-between gap-3" aria-label="AI 装箱导航">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 font-bold text-ink no-underline" to={`/app/boxes/${boxId}`}>
          <AppIcon className="rotate-180" name="chevron-right" />返回
        </Link>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold text-muted">{boxQuery.data.box_code}</p>
          <h1 className="m-0 truncate text-lg font-extrabold text-ink">{boxQuery.data.name}</h1>
        </div>
        <span className="min-w-14 text-right text-sm font-bold text-brand">{totalCount} 张</span>
      </nav>

      <section className="grid place-content-center justify-items-center gap-6 rounded-[1.75rem] bg-surface px-5 py-10 text-center shadow-soft">
        {latestPhoto ? (
          <div className="aspect-[4/3] w-full max-w-sm overflow-hidden rounded-[1.25rem] bg-placeholder shadow-soft">
            <PackingAuthorizedImage objectKey={latestPhoto.object_key} alt={`第 ${latestPhoto.sequence_no} 张装箱照片`} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="grid size-28 place-content-center rounded-full bg-brand/10 text-brand">
            <AppIcon name="plus" size={44} />
          </div>
        )}
        <div className="max-w-md">
          <h2 className="m-0 text-section-title font-extrabold text-ink">每放入一批，拍一张</h2>
          <p className="mt-2 leading-7 text-muted">无需填写信息。照片会安全上传，装箱完成后由 AI 自动生成带图片的物品清单。</p>
        </div>
        <button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[1rem] bg-brand px-8 text-lg font-extrabold text-white disabled:opacity-50" type="button" disabled={uploadState === 'compressing' || totalCount >= 100} onClick={() => inputRef.current?.click()}>
          <AppIcon name="plus" size={24} />{uploadState === 'compressing' ? '正在处理…' : '拍照'}
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label="拍摄装箱照片"
          onChange={(event) => {
            void captureFile(event.target.files?.[0] ?? null)
            event.currentTarget.value = ''
          }}
        />
        <p className="min-h-6 text-sm font-bold text-muted" role="status">
          {uploadState === 'uploading' ? `正在上传 · ${confirmedCount} 张已完成` : localDraftCount > 0 ? `${localDraftCount} 张等待上传` : confirmedCount > 0 ? `${confirmedCount} 张已安全保存` : '从箱底开始记录效果更好'}
        </p>
      </section>

      {errorMessage ? <ResponsiveOperationError message={errorMessage} onRetry={() => void retryPendingDrafts()} /> : null}

      <div className="fixed inset-x-4 bottom-[max(1rem,var(--safe-area-bottom))] z-20 flex gap-2 rounded-control border border-line bg-surface/95 p-2 shadow-float backdrop-blur min-[360px]:inset-x-5 lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <button className="min-h-12 flex-1 rounded-control border border-line bg-canvas px-4 font-bold text-ink" type="button" disabled={uploadState === 'compressing'} onClick={() => inputRef.current?.click()}>继续拍照</button>
        <button className="min-h-12 flex-1 rounded-control bg-brand px-4 font-extrabold text-white disabled:opacity-50" type="button" disabled={busy || totalCount === 0 || localDraftCount > 0} onClick={() => void finish()}>{finishing ? '正在完成…' : '装箱完成'}</button>
      </div>
    </main>
  )
}
