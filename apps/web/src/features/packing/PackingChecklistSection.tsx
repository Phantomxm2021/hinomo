import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'
import { getVenueAccessSummary } from '../venues/venue-sharing.api'
import { PackingAuthorizedImage } from './PackingAuthorizedImage'
import {
  getPackingPhoto,
  getPackingItemPromotion,
  listDetectedPackingItems,
  listPackingSessions,
  mergeDetectedPackingItems,
  requestPackingItemPromotion,
  requestPackingReanalysis,
  updateDetectedPackingItem,
  type PackingDetectedItem,
} from './packing.api'

type PackingTranslationError = { key: string; params?: Record<string, string | number | boolean> }

function quantityLabel(t: ReturnType<typeof useI18n>['t'], kind: string, value: number | null): string {
  if (kind === 'unknown' || value === null) return t('packing.quantityUnknown')
  if (kind === 'at_least') return t('packing.quantityAtLeast', { count: value })
  if (kind === 'approximate') return t('packing.quantityApproximate', { count: value })
  return t('packing.quantityExact', { count: value })
}

function normalizedBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4 || value.some((part) => typeof part !== 'number')) return null
  const [x1, y1, x2, y2] = value as number[]
  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return null
  return [x1, y1, x2, y2]
}

function EvidenceOverlay({ item, onClose, onVenueAccessDenied }: {
  item: PackingDetectedItem
  onClose: () => void
  onVenueAccessDenied: (error: unknown) => void
}) {
  const { t } = useI18n()
  const photoId = item.crop_source_photo_id ?? item.first_seen_photo_id
  const photoQuery = useQuery({
    queryKey: ['packing-evidence-photo', photoId],
    queryFn: () => getPackingPhoto(photoId ?? ''),
    enabled: Boolean(photoId),
  })
  useEffect(() => {
    if (photoQuery.error) onVenueAccessDenied(photoQuery.error)
  }, [onVenueAccessDenied, photoQuery.error])
  const bbox = normalizedBbox(item.crop_bbox)

  return createPortal(
    <div className="fixed inset-0 z-[140] grid place-items-center bg-ink/70 p-4" role="dialog" aria-modal="true" aria-label={t('packing.evidenceDialog', { name: item.name })}>
      <div className="w-full max-w-3xl rounded-[1.25rem] bg-surface p-4 shadow-float">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="font-extrabold text-ink">{item.name}</p><p className="text-sm text-muted">{t('packing.evidenceHint')}</p></div>
          <button className="min-h-11 rounded-control px-4 font-bold text-ink" type="button" onClick={onClose}>{t('common.close')}</button>
        </div>
        {photoQuery.data ? (
          <div className="relative mx-auto max-h-[70dvh] w-fit overflow-hidden rounded-control bg-placeholder">
            <PackingAuthorizedImage objectKey={photoQuery.data.object_key} alt={t('packing.sourceImageAlt', { name: item.name })} className="block max-h-[70dvh] max-w-full object-contain" />
            {bbox ? <span className="pointer-events-none absolute border-[3px] border-danger shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" style={{ left: `${bbox[0] * 100}%`, top: `${bbox[1] * 100}%`, width: `${(bbox[2] - bbox[0]) * 100}%`, height: `${(bbox[3] - bbox[1]) * 100}%` }} /> : null}
          </div>
        ) : <p className="grid min-h-48 place-content-center text-muted">{photoId ? t('packing.readingEvidence') : t('packing.noEvidence')}</p>}
      </div>
    </div>,
    document.body,
  )
}

function ChecklistItem({ item, boxId, mergeTargets, onPromotionAccepted, onVenueAccessDenied }: {
  item: PackingDetectedItem
  boxId: string
  mergeTargets: PackingDetectedItem[]
  onPromotionAccepted: (item: PackingDetectedItem, promotionId: string) => void
  onVenueAccessDenied: (error: unknown) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showEvidence, setShowEvidence] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [quantityKind, setQuantityKind] = useState(item.quantity_kind)
  const [quantityValue, setQuantityValue] = useState(item.quantity_value?.toString() ?? '')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['packing-detected-items', boxId] })
  const updateMutation = useMutation({
    mutationFn: (reviewStatus: PackingDetectedItem['review_status']) => updateDetectedPackingItem(item.id, {
      name: name.trim(), category: category.trim() || null, description: description.trim() || null,
      quantity_kind: quantityKind,
      quantity_value: quantityKind === 'unknown' ? null : Number(quantityValue),
      review_status: reviewStatus,
    }),
    onSuccess: () => { setEditing(false); void refresh() },
    onError: (error) => onVenueAccessDenied(error),
  })
  const promotionMutation = useMutation({
    mutationFn: () => requestPackingItemPromotion(item.id),
    onSuccess: (promotion) => onPromotionAccepted(item, promotion.id),
    onError: (error) => onVenueAccessDenied(error),
  })
  const mergeMutation = useMutation({
    mutationFn: () => mergeDetectedPackingItems(mergeTargetId, item.id),
    onSuccess: () => { setMerging(false); void refresh() },
    onError: (error) => onVenueAccessDenied(error),
  })

  const canSave = name.trim().length > 0 && (quantityKind === 'unknown' || Number(quantityValue) > 0)
  const hasSourcePhoto = Boolean(item.cover_object_key || item.first_seen_photo_id || item.representative_instance_id)
  const promotionLabel = promotionMutation.isPending ? t('packing.submitting') : hasSourcePhoto ? t('packing.addToList') : t('packing.photoUnavailableShort')

  return (
    <article className="border-b border-line/60 p-3 last:border-b-0">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3">
        <button className="grid size-14 place-content-center overflow-hidden rounded-[0.9rem] bg-placeholder text-muted" type="button" aria-label={t('packing.viewEvidence', { name: item.name })} onClick={() => setShowEvidence(true)}>
          {item.cover_object_key ? <PackingAuthorizedImage objectKey={item.cover_object_key} alt={t('packing.evidenceImageAlt', { name: item.name })} className="h-full w-full object-cover" /> : <AppIcon name="box" />}
        </button>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2"><h3 className="m-0 truncate font-bold text-ink">{item.name}</h3><span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[0.6875rem] font-bold text-brand">{t('packing.aiDetected')}</span></div>
          <p className="mt-0.5 truncate text-sm text-muted">{item.description || item.category || t('packing.uncategorized')}</p>
          <p className="mt-1 text-sm font-extrabold text-ink">{quantityLabel(t, item.quantity_kind, item.quantity_value)}</p>
        </div>
        <button className="grid size-10 place-items-center rounded-full text-muted active:bg-canvas" type="button" aria-label={t('packing.moreActions', { name: item.name })} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><AppIcon name="more" /></button>
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2 rounded-control bg-canvas p-3">
          <input className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label={t('packing.itemName')} value={name} onChange={(event) => setName(event.target.value)} />
          <div className="grid grid-cols-2 gap-2"><input className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label={t('packing.itemCategory')} placeholder={t('packing.categoryOptional')} value={category} onChange={(event) => setCategory(event.target.value)} /><input className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label={t('packing.itemDescription')} placeholder={t('packing.descriptionOptional')} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2"><select className="min-h-11 rounded-control border border-line bg-surface px-3" aria-label={t('packing.quantityKind')} value={quantityKind} onChange={(event) => setQuantityKind(event.target.value as PackingDetectedItem['quantity_kind'])}><option value="exact">{t('packing.exact')}</option><option value="at_least">{t('packing.atLeast')}</option><option value="approximate">{t('packing.approximate')}</option><option value="unknown">{t('packing.unknown')}</option></select><input className="min-h-11 rounded-control border border-line bg-surface px-3 disabled:opacity-50" aria-label={t('packing.quantity')} type="number" min="1" disabled={quantityKind === 'unknown'} value={quantityValue} onChange={(event) => setQuantityValue(event.target.value)} /></div>
          <div className="flex justify-end gap-2"><button className="min-h-10 px-3 font-bold text-muted" type="button" onClick={() => setEditing(false)}>{t('common.cancel')}</button><button className="min-h-10 rounded-control bg-brand px-4 font-bold text-white disabled:opacity-50" type="button" disabled={!canSave || updateMutation.isPending} onClick={() => updateMutation.mutate('corrected')}>{t('packing.saveCorrection')}</button></div>
        </div>
      ) : merging ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-control bg-canvas p-3">
          <label className="mr-auto text-sm font-bold text-muted" htmlFor={`merge-${item.id}`}>{t('packing.mergeInto')}</label>
          <select id={`merge-${item.id}`} className="min-h-10 min-w-40 rounded-control border border-line bg-surface px-3" value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}><option value="">{t('packing.chooseKeep')}</option>{mergeTargets.map((target) => <option key={target.id} value={target.id}>{target.name} · {quantityLabel(t, target.quantity_kind, target.quantity_value)}</option>)}</select>
          <button className="min-h-10 px-3 font-bold text-muted" type="button" onClick={() => setMerging(false)}>{t('common.cancel')}</button>
          <button className="min-h-10 rounded-control bg-brand px-4 font-bold text-white disabled:opacity-50" type="button" disabled={!mergeTargetId || mergeMutation.isPending} onClick={() => mergeMutation.mutate()}>{t('packing.confirmMerge')}</button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          {menuOpen ? <div className="flex items-center justify-end gap-1 rounded-control bg-canvas p-1.5">
            <button className="min-h-10 px-3 text-sm font-bold text-muted" type="button" onClick={() => { setMenuOpen(false); setEditing(true) }}>{t('packing.edit')}</button>
            {mergeTargets.length > 0 ? <button className="min-h-10 px-3 text-sm font-bold text-muted" type="button" onClick={() => { setMenuOpen(false); setMerging(true) }}>{t('packing.merge')}</button> : null}
            <button className="min-h-10 px-3 text-sm font-bold text-danger" type="button" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate('dismissed')}>{t('packing.dismiss')}</button>
          </div> : null}
          <button className="min-h-11 w-full rounded-control bg-ink px-4 font-extrabold text-white disabled:bg-placeholder disabled:text-muted" type="button" disabled={!hasSourcePhoto || promotionMutation.isPending} onClick={() => promotionMutation.mutate()}>{promotionLabel}</button>
        </div>
      )}
      {updateMutation.isError || promotionMutation.isError || mergeMutation.isError ? <p className="mt-2 text-right text-xs font-bold text-danger">{t('packing.operationFailed')}</p> : null}
      {showEvidence ? <EvidenceOverlay item={item} onClose={() => setShowEvidence(false)} onVenueAccessDenied={onVenueAccessDenied} /> : null}
    </article>
  )
}

export function PackingChecklistSection({ boxId, venueId, onVenueAccessDenied }: {
  boxId: string
  venueId: string | null
  onVenueAccessDenied: (error: unknown) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [promotionTasks, setPromotionTasks] = useState<Array<{ item: PackingDetectedItem; promotionId: string }>>([])
  const [promotionError, setPromotionError] = useState<PackingTranslationError | null>(null)
  const handledPromotionsRef = useRef(new Set<string>())
  const sessionsQuery = useQuery({
    queryKey: ['packing-sessions', boxId],
    queryFn: async () => {
      if (venueId) await getVenueAccessSummary(venueId)
      return listPackingSessions(boxId)
    },
    refetchInterval: (query) => query.state.data?.some((session) => ['queued', 'processing'].includes(session.status)) ? 3000 : false,
    retry: false,
  })
  const resultSession = sessionsQuery.data?.find((session) => !['capturing', 'uploading', 'canceled'].includes(session.status))
  const itemsQuery = useQuery({
    queryKey: ['packing-detected-items', boxId, resultSession?.id, resultSession?.current_revision],
    queryFn: async () => {
      if (venueId) await getVenueAccessSummary(venueId)
      return listDetectedPackingItems(boxId, resultSession?.id ?? '', resultSession?.current_revision ?? 0)
    },
    enabled: Boolean(resultSession && resultSession.current_revision > 0),
    refetchInterval: 5000,
    retry: false,
  })
  const activeSession = sessionsQuery.data?.find((session) => ['queued', 'processing', 'partial_failed', 'failed'].includes(session.status))
  const items = itemsQuery.data ?? []
  const promotionQueries = useQueries({
    queries: promotionTasks.map((task) => ({
      queryKey: ['packing-item-promotion', task.promotionId],
      queryFn: () => getPackingItemPromotion(task.promotionId),
      refetchInterval: (query: { state: { data?: { status?: string } } }) => ['pending', 'processing'].includes(query.state.data?.status ?? '') ? 1500 : false,
      retry: 3,
    })),
  })
  const hiddenItemIds = new Set(promotionTasks.map((task) => task.item.id))
  const visibleItems = items.filter((item) => !hiddenItemIds.has(item.id))
  const reanalysisMutation = useMutation({
    mutationFn: () => requestPackingReanalysis(activeSession?.id ?? ''),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['packing-sessions', boxId] }) },
    onError: (error) => onVenueAccessDenied(error),
  })

  useEffect(() => {
    for (const error of [sessionsQuery.error, itemsQuery.error, ...promotionQueries.map((query) => query.error)]) {
      if (error) onVenueAccessDenied(error)
    }
  }, [itemsQuery.error, onVenueAccessDenied, promotionQueries, sessionsQuery.error])

  useEffect(() => {
    promotionTasks.forEach((task, index) => {
      const status = promotionQueries[index]?.data?.status
      if (!status || !['completed', 'failed'].includes(status) || handledPromotionsRef.current.has(task.promotionId)) return
      handledPromotionsRef.current.add(task.promotionId)
      if (status === 'failed') {
        setPromotionError({ key: 'packing.promotionFailed', params: { name: task.item.name } })
        setPromotionTasks((current) => current.filter((candidate) => candidate.promotionId !== task.promotionId))
        return
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['items', boxId] }),
        queryClient.invalidateQueries({ queryKey: ['box'] }),
        queryClient.invalidateQueries({ queryKey: ['packing-detected-items', boxId] }),
      ]).then(() => {
        setPromotionTasks((current) => current.filter((candidate) => candidate.promotionId !== task.promotionId))
      })
    })
  }, [boxId, promotionQueries, promotionTasks, queryClient])

  const acceptPromotion = useCallback((item: PackingDetectedItem, promotionId: string) => {
    setPromotionError(null)
    handledPromotionsRef.current.delete(promotionId)
    queryClient.removeQueries({ queryKey: ['packing-item-promotion', promotionId], exact: true })
    setPromotionTasks((current) => current.some((task) => task.promotionId === promotionId)
      ? current
      : [...current, { item, promotionId }])
  }, [queryClient])

  const close = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => launcherRef.current?.focus())
  }, [])

  if (!activeSession && visibleItems.length === 0 && promotionTasks.length === 0) return null
  const isProcessing = Boolean(activeSession && ['queued', 'processing'].includes(activeSession.status))
  const hasFailure = Boolean(activeSession && ['partial_failed', 'failed'].includes(activeSession.status))
  const summary = isProcessing
    ? t('packing.processingSummary', { count: activeSession?.photo_count ?? 0 })
    : hasFailure
      ? t('packing.failureSummary')
      : t('packing.foundSummary', { count: visibleItems.length })

  return (
    <section aria-label={t('packing.entry')}>
      <button
        ref={launcherRef}
        className="grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] border border-brand/15 bg-brand/5 p-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] active:scale-[0.99]"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="grid size-12 place-items-center rounded-[0.9rem] bg-brand text-white shadow-soft"><AppIcon name="scan" size={23} /></span>
        <span className="min-w-0"><span className="block font-extrabold text-ink">{t('packing.titleShort')}</span><span className="mt-0.5 block truncate text-sm font-semibold text-muted">{summary}</span></span>
        <span className="flex items-center gap-2 pl-2"><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${hasFailure ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand'}`}>{visibleItems.length > 0 ? t('packing.itemCount', { count: visibleItems.length }) : promotionTasks.length > 0 ? t('packing.adding') : activeSession ? t(`packing.statuses.${activeSession.status}`) : t('packing.view')}</span><AppIcon className="text-muted" name="chevron-right" size={18} /></span>
      </button>
      <PackingChecklistSheet
        open={open}
        items={visibleItems}
        boxId={boxId}
        activeSession={activeSession}
        promotionCount={promotionTasks.length}
        promotionError={promotionError}
        onPromotionAccepted={acceptPromotion}
        onVenueAccessDenied={onVenueAccessDenied}
        reanalyzing={reanalysisMutation.isPending}
        onReanalyze={() => reanalysisMutation.mutate()}
        onClose={close}
      />
    </section>
  )
}

function PackingChecklistSheet({ open, items, boxId, activeSession, promotionCount, promotionError, reanalyzing, onPromotionAccepted, onVenueAccessDenied, onReanalyze, onClose }: {
  open: boolean
  items: PackingDetectedItem[]
  boxId: string
  activeSession: Awaited<ReturnType<typeof listPackingSessions>>[number] | undefined
  promotionCount: number
  promotionError: PackingTranslationError | null
  reanalyzing: boolean
  onPromotionAccepted: (item: PackingDetectedItem, promotionId: string) => void
  onVenueAccessDenied: (error: unknown) => void
  onReanalyze: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, open])

  if (!open) return null
  const isProcessing = Boolean(activeSession && ['queued', 'processing'].includes(activeSession.status))
  const hasFailure = Boolean(activeSession && ['partial_failed', 'failed'].includes(activeSession.status))

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/30 backdrop-blur-[2px] lg:items-center lg:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="grid h-[94dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[1.75rem] bg-canvas shadow-float lg:h-auto lg:max-h-[calc(100dvh-3rem)] lg:rounded-[1.75rem]" role="dialog" aria-modal="true" aria-labelledby="packing-checklist-title">
        <header className="relative grid min-h-[4.75rem] grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center border-b border-line/60 bg-surface/90 px-4 pt-3 backdrop-blur-xl">
          <span />
          <div className="min-w-0 text-center">
            <div className="absolute top-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line lg:hidden" aria-hidden="true" />
            <h2 className="m-0 truncate text-[1.0625rem] font-extrabold text-ink" id="packing-checklist-title">{t('packing.titleShort')}</h2>
            <p className="mt-0.5 truncate text-xs font-semibold text-muted">{items.length > 0 ? t('packing.itemsPending', { count: items.length }) : activeSession ? t(`packing.statuses.${activeSession.status}`) : t('packing.analysisResult')}</p>
          </div>
          <button ref={closeButtonRef} className="grid size-11 justify-self-end place-items-center rounded-full bg-canvas text-ink active:opacity-50" type="button" aria-label={t('packing.closeChecklist')} onClick={onClose}><AppIcon name="close" size={20} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="mx-auto grid max-w-2xl gap-4">
            <div className="rounded-[1.1rem] bg-surface p-4 shadow-[inset_0_0_0_1px_rgba(79,64,48,0.06)]">
              <p className="font-extrabold text-ink">{t('packing.recognizedItems')}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{t('packing.reviewHint')}</p>
            </div>
            {isProcessing ? <div className="flex items-center gap-3 rounded-[1.1rem] border border-brand/15 bg-brand/5 p-4" role="status"><span className="size-4 animate-pulse rounded-full bg-brand" /><div><p className="font-bold text-ink">{t('packing.processingPhotos', { count: activeSession?.photo_count ?? 0 })}</p><p className="mt-1 text-sm text-muted">{t('packing.processingHint')}</p></div></div> : null}
            {promotionCount > 0 ? <div className="flex items-center gap-3 rounded-[1.1rem] border border-brand/15 bg-brand/5 p-4" role="status"><span className="size-4 animate-pulse rounded-full bg-brand" /><p className="font-bold text-ink">{t('packing.submittedBackground', { count: promotionCount })}</p></div> : null}
            {promotionError ? <p className="rounded-[1.1rem] border border-danger/20 bg-danger/5 p-4 font-bold text-danger" role="alert">{t(promotionError.key, promotionError.params)}</p> : null}
            {hasFailure ? <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-danger/20 bg-danger/5 p-4"><p className="font-bold text-danger">{t('packing.partialResult')}</p><button className="min-h-10 shrink-0 rounded-control bg-danger px-4 font-bold text-white" type="button" disabled={reanalyzing} onClick={onReanalyze}>{reanalyzing ? t('packing.retryingAnalysis') : t('packing.retryAnalysis')}</button></div> : null}
            {items.length > 0 ? <div className="overflow-hidden rounded-[1.25rem] bg-surface shadow-[inset_0_0_0_1px_rgba(79,64,48,0.06)]">{items.map((item) => <ChecklistItem key={item.id} item={item} boxId={boxId} mergeTargets={items.filter((candidate) => candidate.id !== item.id)} onPromotionAccepted={onPromotionAccepted} onVenueAccessDenied={onVenueAccessDenied} />)}</div> : !isProcessing && !hasFailure && promotionCount === 0 ? <p className="grid min-h-48 place-content-center text-center font-semibold text-muted">{t('packing.noReviewResults')}</p> : null}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
