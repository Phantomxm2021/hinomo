import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { MobileActionSheet } from '../../components/MobileActionSheet'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { publicAppOrigin } from '../../lib/env'
import { formatStoragePath } from '../../lib/format-storage-path'
import { useAuth } from '../auth/auth-context'
import { ItemMovementSheet, type ItemMovementCommand } from '../item-movements/ItemMovementSheet'
import { deriveItemAvailability, formatItemAvailability } from '../item-movements/item-movement-status'
import { listItemMovements, moveItem, returnItem, takeOutItem } from '../item-movements/item-movements.api'
import { ItemEditorDialog } from '../items/ItemEditorDialog'
import { deleteItem, type ItemRecord } from '../items/items.api'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { buildLabels, describePdfGenerationFailure, renderLabelsPdf, type PdfGenerationFailure } from '../qr-print/pdf'
import { PackingChecklistSection } from '../packing/PackingChecklistSection'
import { PackingCaptureSheet } from '../packing/PackingCapturePage'
import { CreditGateSheet } from '../credits/CreditGateSheet'
import { getCreditSummary } from '../credits/credits.api'
import { getBoxByPublicId, listBoxes } from './boxes.api'
import { EditBoxModal } from './EditBoxModal'

export function PublicBoxPage() {
  const { publicId = '' } = useParams<{ publicId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session } = useAuth()
  const { locale, t } = useI18n()
  const feedback = useMobileFeedback()
  const queryClient = useQueryClient()
  const desktopAddItemButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileActionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const desktopBoxEditButtonRef = useRef<HTMLButtonElement | null>(null)
  const boxEditorReturnFocusRef = useRef<HTMLElement | null>(null)
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null)
  const itemInteractionTriggerRef = useRef<HTMLButtonElement | null>(null)
  const itemEditorReturnFocusRef = useRef<HTMLElement | null>(null)
  const [showItemForm, setShowItemForm] = useState(false)
  const [showPackingCapture, setShowPackingCapture] = useState(false)
  const [creditGate, setCreditGate] = useState<{
    requiredCredits?: number
  } | null>(null)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [showBoxEditor, setShowBoxEditor] = useState(false)
  const [editorBusy, setEditorBusy] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemRecord | null>(null)
  const [movementItem, setMovementItem] = useState<ItemRecord | null>(null)
  const [printError, setPrintError] = useState<PdfGenerationFailure | null>(null)
  const [printing, setPrinting] = useState(false)
  const editorBlocker = useBlocker(editorBusy)
  const boxQuery = useQuery({
    queryKey: ['box', publicId],
    queryFn: () => getBoxByPublicId(publicId),
    retry: false,
  })
  const creditQuery = useQuery({
    queryKey: ['credit-summary'],
    queryFn: getCreditSummary,
    enabled: Boolean(session),
  })
  useEffect(() => {
    if (searchParams.get('capture') !== '1' || !boxQuery.data || session?.user.id !== boxQuery.data.owner_id || !creditQuery.data) return
    if (creditQuery.data.credits_available > 0) setShowPackingCapture(true)
    else setCreditGate({})
    const next = new URLSearchParams(searchParams)
    next.delete('capture')
    setSearchParams(next, { replace: true })
  }, [boxQuery.data, creditQuery.data, searchParams, session?.user.id, setSearchParams])
  useEffect(() => {
    if (editorBlocker.state === 'blocked' && !editorBusy) editorBlocker.reset()
  }, [editorBlocker, editorBusy])
  const targetBoxesQuery = useQuery({
    queryKey: ['boxes'],
    queryFn: listBoxes,
    enabled: Boolean(movementItem),
  })
  const movementHistoryQuery = useQuery({
    queryKey: ['item-movements', movementItem?.id],
    queryFn: () => listItemMovements(movementItem?.id ?? ''),
    enabled: Boolean(movementItem),
  })
  const movementMutation = useMutation({
    mutationFn: (command: ItemMovementCommand) => {
      if (!movementItem) throw new Error('item is required')
      if (command.action === 'take_out') {
        return takeOutItem({
          itemId: movementItem.id,
          quantity: command.quantity,
          handlerLabel: command.handlerLabel,
          note: command.note,
        })
      }
      if (command.action === 'return') {
        return returnItem({ itemId: movementItem.id, quantity: command.quantity, note: command.note })
      }
      return moveItem({ itemId: movementItem.id, targetBoxId: command.targetBoxId, note: command.note })
    },
    onSuccess: async (_, command) => {
      setMovementItem(null)
      feedback.notify(command.action === 'take_out' ? t('boxes.movementTaken') : command.action === 'return' ? t('boxes.movementReturned') : t('boxes.movementMoved'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['box'] }),
        queryClient.invalidateQueries({ queryKey: ['boxes'] }),
        queryClient.invalidateQueries({ queryKey: ['items'] }),
        queryClient.invalidateQueries({ queryKey: ['search-items'] }),
        queryClient.invalidateQueries({ queryKey: ['item-movements'] }),
      ])
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: async () => {
      deleteReturnFocusRef.current = window.matchMedia('(min-width: 48rem)').matches
        ? desktopAddItemButtonRef.current
        : mobileActionsButtonRef.current
      setDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['box', publicId] }),
        queryClient.invalidateQueries({ queryKey: ['items', boxQuery.data?.id] }),
      ])
    },
  })
  const frameClassName = 'mx-auto grid min-w-0 w-full max-w-6xl gap-6 px-4 pb-[calc(6rem+var(--safe-area-bottom))] pt-3 min-[360px]:px-5 lg:gap-6 lg:px-8 lg:pb-10 lg:pt-5'

  if (boxQuery.isPending && boxQuery.data === undefined) {
    return (
      <main className={frameClassName}>
        <SkeletonGroup className="grid gap-5 lg:gap-6" label={t('boxes.publicLoading')}>
          <div data-testid="box-summary-skeleton" className="grid gap-4 border-0 bg-transparent p-0 lg:grid-cols-[minmax(16rem,0.8fr)_1.2fr] lg:gap-6 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-5">
            <Skeleton className="aspect-[4/3] min-h-0 rounded-[1.5rem] lg:min-h-56 lg:rounded-control" />
            <div className="grid content-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-full" />
            </div>
          </div>
          <div className="grid gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </SkeletonGroup>
      </main>
    )
  }
  if (boxQuery.isError && boxQuery.data === undefined) {
    return <main className={frameClassName}><PageState state="error" message={t('boxes.detailLoadError')} onRetry={() => void boxQuery.refetch()} /></main>
  }
  if (!boxQuery.data) {
    return <main className={frameClassName}><PageState state="error" message={t('boxes.publicUnavailable')} retryLabel={t('boxes.publicScan')} onRetry={() => navigate('/app/scan')} /></main>
  }

  const box = boxQuery.data
  const isOwner = session?.user.id === box.owner_id
  const totalQuantity = box.items.reduce((sum, item) => sum + item.quantity, 0)
  const updatedAt = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(box.updated_at))
  const openNewItem = (trigger?: HTMLElement | null) => {
    itemEditorReturnFocusRef.current = trigger ?? mobileActionsButtonRef.current
    setEditingItem(null)
    setShowItemForm(true)
  }
  const openBoxEditor = (trigger?: HTMLElement | null) => {
    boxEditorReturnFocusRef.current = trigger ?? mobileActionsButtonRef.current
    setShowBoxEditor(true)
  }
  const refreshBox = async () => {
    setShowBoxEditor(false)
    feedback.notify(t('boxes.saved'))
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['box', publicId] }),
      queryClient.invalidateQueries({ queryKey: ['boxes'] }),
    ])
  }
  const openPackingCapture = () => {
    const credit = creditQuery.data
    if (!credit) {
      void creditQuery.refetch().then((result) => {
        if (result.data && result.data.credits_available > 0) setShowPackingCapture(true)
        else setCreditGate({})
      })
      return
    }
    if (credit.credits_available < 1) setCreditGate({})
    else setShowPackingCapture(true)
  }
  const openEditItem = (item: ItemRecord) => {
    itemEditorReturnFocusRef.current = itemInteractionTriggerRef.current
    setEditingItem(item)
    setShowItemForm(true)
  }
  const openMovementItem = (item: ItemRecord, trigger?: HTMLButtonElement) => {
    if (trigger) itemInteractionTriggerRef.current = trigger
    movementMutation.reset()
    setMovementItem(item)
  }
  const refreshItems = async () => {
    setShowItemForm(false)
    setEditingItem(null)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['box', publicId] }),
      queryClient.invalidateQueries({ queryKey: ['items', box.id] }),
    ])
  }
  const printLabel = async () => {
    setPrinting(true)
    setPrintError(null)
    try {
      await renderLabelsPdf(buildLabels([box], publicAppOrigin()))
    } catch (error) {
      console.error('pdf_label_generation_failed', error)
      setPrintError(describePdfGenerationFailure(error))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <main className={frameClassName}>
      <nav className="sticky top-0 z-20 -mx-4 -mt-3 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label={t('boxes.nav')}>
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('boxes.back')} onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">{t('boxes.detailTitle', { name: box.name })}</span>
        <div className="flex justify-end gap-1" aria-label={isOwner ? t('boxes.boxTools') : undefined} aria-hidden={isOwner ? undefined : true}>
          {isOwner ? (
            <button ref={mobileActionsButtonRef} className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('boxes.openActions')} onClick={() => setShowMobileActions(true)}>
              <AppIcon name="plus" size={24} />
            </button>
          ) : null}
        </div>
      </nav>
      {boxQuery.isError ? (
        <ResponsiveOperationError message={t('boxes.detailRefreshError')} busy={boxQuery.isFetching} onRetry={() => void boxQuery.refetch()} />
      ) : null}
      <section data-testid="box-summary" className="hidden gap-4 border-0 bg-transparent p-0 lg:grid lg:grid-cols-[minmax(16rem,0.8fr)_1.2fr] lg:gap-6 lg:rounded-shell lg:border lg:border-line lg:bg-surface lg:p-5">
        <div data-testid="box-cover" className="hidden aspect-[4/3] min-h-0 overflow-hidden rounded-[1.5rem] bg-placeholder lg:block lg:min-h-56 lg:rounded-card">
          {box.cover_object_key ? (
            <AuthorizedImage objectKey={box.cover_object_key} alt={t('boxes.coverAlt', { name: box.name })} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-content-center justify-items-center gap-2 text-muted">
              <AppIcon name="box" size={40} />
              <span className="font-bold">{t('boxes.noCover')}</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-5 lg:gap-6">
          <div className="grid gap-2.5 lg:gap-3">
            <p className="font-mono text-xs font-extrabold tracking-[0.08em] text-brand lg:text-sm lg:tracking-wide">{box.box_code}</p>
            <h1 className="m-0 text-[1.75rem] leading-tight text-ink lg:text-page-title font-extrabold">{box.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold lg:gap-2 lg:font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-placeholder/70 px-2.5 py-1 text-ink lg:px-3 lg:py-1.5">
                <AppIcon name={box.visibility === 'public' ? 'globe' : 'lock'} size={16} />
                {box.visibility === 'public' ? t('boxes.publicVisibility') : t('boxes.privateVisibility')}
              </span>
              <span className="rounded-full border-0 bg-transparent px-0 py-1 text-muted lg:border lg:border-line lg:px-3 lg:py-1.5">{t('boxes.updatedAt', { date: updatedAt })}</span>
            </div>
            <div data-testid="box-detail-facts" className="hidden lg:contents">
              <p className="text-sm leading-6 text-muted lg:text-base">{formatStoragePath([box.venue_name, box.space_name, box.location || t('boxes.locationUnset')])}</p>
              <p className="text-sm leading-6 text-muted lg:text-base lg:leading-7">{box.description || t('boxes.noDescription')}</p>
              <p className="font-extrabold text-ink">{t('boxes.detailSummary', { quantity: totalQuantity, types: box.items.length })}</p>
            </div>
          </div>
          {isOwner ? (
            <div data-testid="desktop-box-actions" className="hidden lg:flex lg:flex-wrap lg:gap-2">
              <button ref={desktopBoxEditButtonRef} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] border-0 bg-surface px-4 font-bold text-ink no-underline shadow-[inset_0_0_0_1px_rgba(79,64,48,0.08)] active:opacity-70 lg:min-h-11 lg:justify-start lg:rounded-control lg:border lg:border-line lg:bg-canvas lg:shadow-none" type="button" onClick={(event) => openBoxEditor(event.currentTarget)}>
                <AppIcon name="edit" />{t('boxes.editAction')}
              </button>
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] border-0 bg-surface px-4 font-bold text-ink shadow-[inset_0_0_0_1px_rgba(79,64,48,0.08)] active:opacity-70 lg:min-h-11 lg:justify-start lg:rounded-control lg:border lg:border-line lg:bg-canvas lg:shadow-none" type="button" disabled={printing} onClick={() => void printLabel()}>
                <AppIcon name="print" />{printing ? t('boxes.generatingLabel') : t('boxes.printLabel')}
              </button>
              <button ref={desktopAddItemButtonRef} className="hidden min-h-11 items-center gap-2 rounded-control border border-brand bg-brand px-4 font-bold text-white lg:inline-flex" type="button" onClick={(event) => openNewItem(event.currentTarget)}>
                <AppIcon name="plus" />{t('boxes.addItem')}
              </button>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-control border border-brand bg-brand px-4 font-bold text-white" type="button" onClick={openPackingCapture}>
                <AppIcon name="scan" />{t('boxes.aiPacking')}
              </button>
            </div>
          ) : null}
        </div>
      </section>
      {printError ? (
        <ResponsiveOperationError
          message={t(printError.key)}
          retryLabel={printError.requiresReload ? t('boxes.printRefresh') : t('boxes.printRetry')}
          onRetry={printError.requiresReload ? () => window.location.reload() : () => void printLabel()}
        />
      ) : null}
      {movementMutation.isError ? <ResponsiveOperationError message={t('boxes.movementError')} /> : null}
      {targetBoxesQuery.isError ? <ResponsiveOperationError message={t('boxes.targetBoxesError')} busy={targetBoxesQuery.isFetching} onRetry={() => void targetBoxesQuery.refetch()} /> : null}
      {movementHistoryQuery.isError ? <ResponsiveOperationError message={t('boxes.historyError')} busy={movementHistoryQuery.isFetching} onRetry={() => void movementHistoryQuery.refetch()} /> : null}

      <MobileActionSheet
        open={isOwner && showMobileActions}
        title={t('boxes.boxActions')}
        onClose={() => setShowMobileActions(false)}
        actions={[
          { label: t('boxes.aiPacking'), onSelect: openPackingCapture },
          { label: t('boxes.addItem'), onSelect: openNewItem },
          { label: t('boxes.editAction'), onSelect: openBoxEditor },
          { label: printing ? t('boxes.packingGenerating') : t('boxes.printLabel'), disabled: printing, onSelect: () => void printLabel() },
        ]}
      />

      <ItemMovementSheet
        open={isOwner && Boolean(movementItem)}
        item={movementItem}
        currentBoxId={box.id}
        boxes={targetBoxesQuery.data ?? []}
        movements={movementHistoryQuery.data ?? []}
        historyLoading={movementHistoryQuery.isPending}
        pending={movementMutation.isPending}
        onClose={() => { if (!movementMutation.isPending) { setMovementItem(null); movementMutation.reset() } }}
        onEdit={(item) => { setMovementItem(null); openEditItem(item) }}
        onSubmit={async (command) => { await movementMutation.mutateAsync(command) }}
      />

      {isOwner ? (
        <EditBoxModal
          open={showBoxEditor}
          boxId={box.id}
          returnFocusRef={boxEditorReturnFocusRef}
          onBusyChange={setEditorBusy}
          onClose={() => setShowBoxEditor(false)}
          onSaved={() => void refreshBox()}
        />
      ) : null}

      {isOwner ? (
        <ItemEditorDialog
          open={showItemForm || Boolean(editingItem)}
          boxId={box.id}
          item={editingItem}
          returnFocusRef={itemEditorReturnFocusRef}
          onBusyChange={setEditorBusy}
          onSaved={() => void refreshItems()}
          onClose={() => { setShowItemForm(false); setEditingItem(null) }}
          onDelete={editingItem ? () => {
            deleteReturnFocusRef.current = itemInteractionTriggerRef.current ?? mobileActionsButtonRef.current
            setShowItemForm(false)
            setEditingItem(null)
            setDeleteTarget(editingItem)
          } : undefined}
        />
      ) : null}

      {isOwner && showPackingCapture ? (
        <PackingCaptureSheet
          boxId={box.id}
          onClose={() => setShowPackingCapture(false)}
          onBillingBlocked={(_reason, requiredCredits) => {
            setShowPackingCapture(false)
            setCreditGate({ requiredCredits })
            void creditQuery.refetch()
          }}
          onCompleted={() => {
            setShowPackingCapture(false)
            feedback.notify(t('boxes.packingSubmitted'))
            void creditQuery.refetch()
          }}
        />
      ) : null}

      {isOwner ? <PackingChecklistSection boxId={box.id} /> : null}

      <section className="grid gap-3" aria-labelledby="box-items-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-extrabold text-brand">{t('boxes.itemsEyebrow')}</p>
            <h2 className="m-0 text-section-title font-bold text-ink" id="box-items-heading">{t('boxes.itemTitle')}</h2>
          </div>
          <span className="text-sm font-bold text-muted">{t('boxes.itemKinds', { count: box.items.length })}</span>
        </div>
        {box.items.length > 0 ? (
          <div data-testid="box-item-list" className="overflow-hidden rounded-[1.25rem] bg-surface shadow-[inset_0_0_0_1px_rgba(79,64,48,0.06)] lg:contents lg:rounded-none lg:bg-transparent lg:shadow-none">
            {box.items.map((item) => (
              <article className="border-b border-line/60 last:border-b-0 lg:overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface" key={item.id}>
                {isOwner ? (
                  <button className="grid w-full min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition-colors hover:bg-canvas/70 active:bg-placeholder/50 lg:grid-cols-[7rem_minmax(0,1fr)_auto] lg:gap-4 lg:p-4" type="button" aria-label={t('boxes.itemActionAria', { name: item.name })} onClick={(event) => openMovementItem(item, event.currentTarget)}>
                    <div className="grid size-14 place-content-center overflow-hidden rounded-[0.9rem] bg-placeholder text-muted lg:aspect-[4/3] lg:size-auto lg:w-28 lg:rounded-control">
                      {item.image_object_key ? <AuthorizedImage objectKey={item.image_object_key} alt="" className="h-full w-full object-cover" /> : <><AppIcon name="box" /><span className="mt-1 hidden text-xs font-bold lg:inline">{t('boxes.noImage')}</span></>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="m-0 min-w-0 flex-1 truncate text-[1rem] font-bold text-ink lg:flex-none lg:text-lg lg:font-extrabold">{item.name}</h3>
                        <span className="hidden shrink-0 rounded-full bg-placeholder/70 px-2.5 py-1 text-xs font-bold text-ink lg:inline-flex">{item.category || t('boxes.uncategorized')}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted lg:mt-1 lg:leading-6">{item.description || item.category || t('boxes.noDescription')}</p>
                      <p className="mt-1 flex min-w-0 items-center gap-2 text-xs font-bold lg:mt-2 lg:text-sm"><span className="shrink-0 text-muted">{t('boxes.quantity', { count: item.quantity })}</span><span className="truncate text-brand">{(() => { const copy = formatItemAvailability(deriveItemAvailability(item.quantity, item.stored_quantity)); return t(copy.key, copy.params) })()}</span></p>
                    </div>
                    <AppIcon className="text-muted" name="chevron-right" />
                  </button>
                ) : (
                  <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 p-3 lg:grid-cols-[7rem_minmax(0,1fr)] lg:gap-4 lg:p-4">
                    <div className="grid size-14 place-content-center overflow-hidden rounded-[0.9rem] bg-placeholder text-muted lg:aspect-[4/3] lg:size-auto lg:w-28 lg:rounded-control">
                      {item.image_object_key ? <AuthorizedImage objectKey={item.image_object_key} alt={t('boxes.itemImageAlt', { name: item.name })} className="h-full w-full object-cover" /> : <><AppIcon name="box" /><span className="mt-1 hidden text-xs font-bold lg:inline">{t('boxes.noImage')}</span></>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="m-0 min-w-0 flex-1 truncate text-[1rem] font-bold text-ink lg:flex-none lg:text-lg lg:font-extrabold">{item.name}</h3>
                        <span className="hidden shrink-0 rounded-full bg-placeholder/70 px-2.5 py-1 text-xs font-bold text-ink lg:inline-flex">{item.category || t('boxes.uncategorized')}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted lg:mt-1 lg:leading-6">{item.description || item.category || t('boxes.noDescription')}</p>
                      <p className="mt-1 truncate text-xs font-bold text-brand lg:mt-2 lg:text-sm"><span className="mr-2 text-muted">{t('boxes.quantity', { count: item.quantity })}</span>{(() => { const copy = formatItemAvailability(deriveItemAvailability(item.quantity, item.stored_quantity)); return t(copy.key, copy.params) })()}</p>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : null}
        {box.items.length === 0 ? (
          <PageState
            state="empty"
            icon="box"
            title={t('boxes.noItemsTitle')}
            description={isOwner ? t('boxes.noItemsDescription') : undefined}
            action={isOwner ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="border-brand! bg-brand! text-white!" type="button" onClick={openPackingCapture}>{t('boxes.captureItems')}</button>
                <button type="button" onClick={(event) => openNewItem(event.currentTarget)}>{t('boxes.manualItem')}</button>
              </div>
            ) : undefined}
          />
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('boxes.deleteItemTitle', { name: deleteTarget?.name ?? '' })}
        description={t('boxes.deleteItemDescription')}
        busy={deleteMutation.isPending}
        returnFocusRef={deleteReturnFocusRef}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
      />
      <CreditGateSheet
        open={Boolean(creditGate)}
        availableCredits={creditQuery.data?.credits_available ?? 0}
        requiredCredits={creditGate?.requiredCredits}
        onClose={() => setCreditGate(null)}
      />
    </main>
  )
}
