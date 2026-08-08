import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useI18n } from '../../i18n/I18nProvider'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useSelectedVenue } from '../venues/selected-venue'
import { listVenues } from '../venues/venues.api'
import { BoxCatalogueCard } from './BoxCatalogueCard'
import { BoxCreationNextStep } from './BoxCreationNextStep'
import {
  catalogueSpaces,
  catalogueSummary,
  filterBoxes,
} from './box-catalogue'
import { getBoxPlanSummary, startBoxUnlimitedCheckout } from './box-entitlements.api'
import { deleteBox, listBoxesForVenue, type BoxSummary, type CreatedBox } from './boxes.api'
import { BoxLimitPaywall } from './BoxLimitPaywall'
import { CreateBoxModal } from './CreateBoxModal'
import { EditBoxModal } from './EditBoxModal'
import { SpaceFilterChips } from './SpaceFilterChips'

type CatalogueParam = 'space'

const EMPTY_BOXES: readonly BoxSummary[] = []
const PURCHASE_CONFIRMATION_ATTEMPTS = 8
const PURCHASE_CONFIRMATION_INTERVAL_MS = 1_500

type PurchaseConfirmationState = 'idle' | 'confirming' | 'delayed'

function errorCode(error: unknown) {
  if (typeof error === 'string') return error
  if (!error || typeof error !== 'object' || !('message' in error)) return ''
  return String(error.message)
}

export function BoxesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const feedback = useMobileFeedback()
  const navigate = useNavigate()
  const createButtonRef = useRef<HTMLButtonElement | null>(null)
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null)
  const editReturnFocusRef = useRef<HTMLElement | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<BoxSummary | null>(null)
  const [openMenuBoxId, setOpenMenuBoxId] = useState<string | null>(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [editBusy, setEditBusy] = useState(false)
  const [createCompletionPending, setCreateCompletionPending] = useState(false)
  const [editCompletionPending, setEditCompletionPending] = useState(false)
  const [createSucceeded, setCreateSucceeded] = useState(false)
  const [createdBox, setCreatedBox] = useState<CreatedBox | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [purchaseConfirmation, setPurchaseConfirmation] = useState<PurchaseConfirmationState>('idle')
  const createSuccessTimerRef = useRef<number | null>(null)
  const purchaseConfirmationTimerRef = useRef<number | null>(null)
  const purchaseConfirmationRunRef = useRef(0)
  const handledPurchaseResultRef = useRef<string | null>(null)
  const venuesQuery = useQuery({ queryKey: ['venues'], queryFn: listVenues })
  const venues = venuesQuery.data ?? []
  const [selectedVenueId] = useSelectedVenue(venues)
  const boxesQuery = useQuery({
    queryKey: ['boxes', selectedVenueId],
    queryFn: () => listBoxesForVenue(selectedVenueId!),
    enabled: Boolean(selectedVenueId),
  })
  const boxPlanQuery = useQuery({ queryKey: ['box-plan'], queryFn: getBoxPlanSummary })
  const deleteMutation = useMutation({
    mutationFn: (boxId: string) => deleteBox(boxId),
    onSuccess: (_data, boxId) => {
      queryClient.setQueriesData<BoxSummary[]>({ queryKey: ['boxes'] }, (current) => current?.filter((box) => box.id !== boxId))
      deleteReturnFocusRef.current = createButtonRef.current
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['boxes'] })
      void queryClient.invalidateQueries({ queryKey: ['box-plan'] })
    },
  })
  const allBoxes = boxesQuery.data ?? EMPTY_BOXES
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null
  const boxes = useMemo(() => selectedVenueId
    ? allBoxes.filter((box) => !box.venue_id || box.venue_id === selectedVenueId)
    : EMPTY_BOXES, [allBoxes, selectedVenueId])
  const hasCatalogueData = venuesQuery.isSuccess && (!selectedVenueId || boxesQuery.data !== undefined)
  const cataloguePending = (Boolean(selectedVenueId) && boxesQuery.isPending && boxesQuery.data === undefined)
    || (venuesQuery.isPending && venuesQuery.data === undefined)
  const catalogueError = boxesQuery.isError || venuesQuery.isError
  const selectedSpace = searchParams.get('space') ?? ''
  const creating = searchParams.get('create') === '1'
  const purchaseResult = searchParams.get('purchase')
  const purchaseSessionId = searchParams.get('session_id')
  const editingBoxId = searchParams.get('edit')
  const wasCreating = useRef(creating)
  const createBlocker = useBlocker((creating && createBusy) || (Boolean(editingBoxId) && editBusy))
  const spaces = useMemo(() => catalogueSpaces(boxes), [boxes])
  const summary = useMemo(() => catalogueSummary(boxes), [boxes])
  const visibleBoxes = useMemo(() => filterBoxes(boxes, {
    query: '',
    spaceId: selectedSpace,
  }), [boxes, selectedSpace])
  const boxPlanStatus = useMemo(() => {
    const plan = boxPlanQuery.data
    if (!plan) return null
    if (plan.unlimited_boxes) return t('boxes.planUnlimitedActive')
    if (plan.box_count > plan.free_limit) {
      return t('boxes.planOverLimit', { count: plan.box_count, limit: plan.free_limit })
    }
    if (plan.box_count === plan.free_limit) {
      return t('boxes.planFull', { count: plan.box_count, limit: plan.free_limit })
    }
    return t('boxes.planAvailable', { count: plan.box_count, limit: plan.free_limit })
  }, [boxPlanQuery.data, t])

  useEffect(() => {
    if (!searchParams.has('sort')) return
    const next = new URLSearchParams(searchParams)
    next.delete('sort')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const updateCatalogueParam = (key: CatalogueParam, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const clearCatalogueFilters = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('space')
    next.delete('sort')
    setSearchParams(next, { replace: true })
  }

  const clearCreateSuccessTimer = useCallback(() => {
    if (createSuccessTimerRef.current === null) return
    window.clearTimeout(createSuccessTimerRef.current)
    createSuccessTimerRef.current = null
  }, [])

  const clearPurchaseConfirmationTimer = useCallback(() => {
    if (purchaseConfirmationTimerRef.current === null) return
    window.clearTimeout(purchaseConfirmationTimerRef.current)
    purchaseConfirmationTimerRef.current = null
  }, [])

  const continueCreation = useCallback((notice: string) => {
    purchaseConfirmationRunRef.current += 1
    clearPurchaseConfirmationTimer()
    setPurchaseConfirmation('idle')
    setPaywallOpen(false)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('purchase')
      next.delete('session_id')
      next.set('create', '1')
      return next
    }, { replace: true })
    feedback.notify(notice)
    void queryClient.invalidateQueries({ queryKey: ['boxes'] })
    void queryClient.invalidateQueries({ queryKey: ['box-plan'] })
  }, [clearPurchaseConfirmationTimer, feedback, queryClient, setSearchParams])

  const startPurchaseConfirmation = useCallback(() => {
    const run = purchaseConfirmationRunRef.current + 1
    purchaseConfirmationRunRef.current = run
    clearPurchaseConfirmationTimer()
    setPurchaseConfirmation('confirming')
    let attempts = 0

    const check = async () => {
      attempts += 1
      const result = await boxPlanQuery.refetch()
      if (purchaseConfirmationRunRef.current !== run) return
      if (result.data?.unlimited_boxes) {
        continueCreation(t('boxes.purchaseUnlocked'))
        return
      }
      if (attempts >= PURCHASE_CONFIRMATION_ATTEMPTS) {
        purchaseConfirmationTimerRef.current = null
        setPurchaseConfirmation('delayed')
        return
      }
      purchaseConfirmationTimerRef.current = window.setTimeout(() => {
        purchaseConfirmationTimerRef.current = null
        void check()
      }, PURCHASE_CONFIRMATION_INTERVAL_MS)
    }

    void check()
  }, [boxPlanQuery, clearPurchaseConfirmationTimer, continueCreation, t])

  const checkoutMutation = useMutation({
    mutationFn: startBoxUnlimitedCheckout,
    onError: (error) => {
      if (errorCode(error) !== 'entitlement_already_owned') return
      void boxPlanQuery.refetch().finally(() => {
        continueCreation(t('boxes.unlimitedOwned'))
      })
    },
  })

  useEffect(() => {
    if (!purchaseResult) {
      handledPurchaseResultRef.current = null
      return
    }
    const purchaseKey = `${purchaseResult}:${purchaseSessionId ?? ''}`
    if (handledPurchaseResultRef.current === purchaseKey) return
    handledPurchaseResultRef.current = purchaseKey

    if (purchaseResult === 'canceled') {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('purchase')
        next.delete('session_id')
        return next
      }, { replace: true })
      feedback.notify(t('boxes.purchaseCancelled'))
      return
    }
    if (purchaseResult === 'success') startPurchaseConfirmation()
  }, [feedback, purchaseResult, purchaseSessionId, setSearchParams, startPurchaseConfirmation, t])

  useEffect(() => () => {
    purchaseConfirmationRunRef.current += 1
    handledPurchaseResultRef.current = null
    clearPurchaseConfirmationTimer()
  }, [clearPurchaseConfirmationTimer])

  const openCreate = () => {
    if (purchaseConfirmation !== 'idle') return
    if (selectedVenue?.space_count === 0) {
      navigate('/app/spaces?create=1&from=box')
      return
    }
    clearCreateSuccessTimer()
    setCreateSucceeded(false)
    setCreatedBox(null)
    setCreateCompletionPending(false)
    if (boxPlanQuery.data && !boxPlanQuery.data.can_create) {
      setPaywallOpen(true)
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('create', '1')
    setSearchParams(next)
  }

  const closeCreate = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const closePaywall = useCallback(() => {
    checkoutMutation.reset()
    setPaywallOpen(false)
  }, [checkoutMutation])

  const openEdit = (box: BoxSummary, trigger: HTMLButtonElement | null) => {
    editReturnFocusRef.current = trigger
    setOpenMenuBoxId(null)
    setEditCompletionPending(false)
    const next = new URLSearchParams(searchParams)
    next.set('edit', box.id)
    setSearchParams(next)
  }

  const closeEdit = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('edit')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (createBlocker.state === 'blocked' && !createBusy && !editBusy) createBlocker.reset()
  }, [createBlocker, createBusy, editBusy])

  useEffect(() => {
    if (creating && selectedVenue?.space_count === 0) {
      navigate('/app/spaces?create=1&from=box', { replace: true })
    }
  }, [creating, navigate, selectedVenue?.space_count])

  useEffect(() => {
    if (createCompletionPending && creating && !createBusy) closeCreate()
  }, [closeCreate, createBusy, createCompletionPending, creating])

  useEffect(() => {
    if (editCompletionPending && editingBoxId && !editBusy) {
      setEditCompletionPending(false)
      closeEdit()
    }
  }, [closeEdit, editBusy, editCompletionPending, editingBoxId])

  useEffect(() => {
    if (!createCompletionPending || creating) return
    setCreateCompletionPending(false)
    setCreateSucceeded(true)
    feedback.notify(t('boxes.created'))
    clearCreateSuccessTimer()
    createSuccessTimerRef.current = window.setTimeout(() => {
      createSuccessTimerRef.current = null
      setCreateSucceeded(false)
      setCreatedBox(null)
    }, 12_000)
  }, [clearCreateSuccessTimer, createCompletionPending, creating, feedback, t])

  useEffect(() => clearCreateSuccessTimer, [clearCreateSuccessTimer])

  useEffect(() => {
    setOpenMenuBoxId(null)
  }, [selectedSpace])

  useEffect(() => {
    const shouldRestoreFocus = wasCreating.current && !creating
    wasCreating.current = creating
    if (!shouldRestoreFocus) return
    const focusFrame = window.requestAnimationFrame(() => createButtonRef.current?.focus())
    return () => window.cancelAnimationFrame(focusFrame)
  }, [creating])

  return (
    <section className="mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-5 lg:gap-7" aria-labelledby="boxes-title">
      <header className="py-3">
          <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">{t('boxes.eyebrow')}</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mb-0 text-page-title font-extrabold" id="boxes-title">{t('boxes.title')}</h1>
            {selectedVenue ? (
              <p className="mt-1 mb-0 flex min-w-0 items-center gap-1.5 truncate text-sm text-muted">
                <span className="truncate font-medium">{selectedVenue.name}</span>
                {hasCatalogueData ? (
                  <>
                    <span className="shrink-0" aria-hidden="true">·</span>
                    <span className="shrink-0">{t('boxes.summary', { boxes: summary.boxCount, items: summary.itemCount })}</span>
                  </>
                ) : null}
              </p>
            ) : null}
            {boxPlanStatus ? <p className="mt-1 mb-0 text-sm font-semibold text-brand">{boxPlanStatus}</p> : null}
          </div>
          <button
            ref={createButtonRef}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-brand bg-brand text-white transition hover:bg-brand-strong"
            type="button"
            aria-label={t('boxes.createAria')}
            title={t('boxes.createAria')}
            disabled={purchaseConfirmation !== 'idle'}
            onClick={openCreate}
          >
            <AppIcon name="plus" />
          </button>
        </div>
      </header>

      {purchaseConfirmation !== 'idle' ? (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-brand/20 bg-brand/5 px-4 py-3 text-sm"
          role="status"
          aria-label={t(purchaseConfirmation === 'confirming' ? 'boxes.purchaseConfirmed' : 'boxes.purchaseDelayedTitle')}
        >
          <div>
            <p className="m-0 font-bold text-ink">
              {t(purchaseConfirmation === 'confirming' ? 'boxes.purchaseConfirmed' : 'boxes.purchaseDelayedTitle')}
            </p>
            {purchaseConfirmation === 'delayed' ? (
              <>
                <p className="mt-1 mb-0 text-muted">{t('boxes.purchaseDelayed')}</p>
                {purchaseSessionId ? <p className="mt-1 mb-0 text-muted">{t('boxes.purchaseSupport', { sessionId: purchaseSessionId })}</p> : null}
              </>
            ) : null}
          </div>
          {purchaseConfirmation === 'delayed' ? (
            <button className="min-h-11 rounded-control border border-brand bg-surface px-4 py-2 font-bold text-brand-strong" type="button" onClick={startPurchaseConfirmation}>
              {t('boxes.purchaseRecheck')}
            </button>
          ) : null}
        </section>
      ) : null}

      {cataloguePending ? (
        <SkeletonGroup className="grid gap-5" label={t('boxes.loading')}>
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="overflow-hidden rounded-card border border-line bg-surface" key={index}>
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="grid gap-3 p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonGroup>
      ) : null}
      {catalogueError && !hasCatalogueData ? <PageState state="error" message={t('boxes.loadError')} onRetry={() => { void boxesQuery.refetch(); void venuesQuery.refetch() }} /> : null}
      {catalogueError && hasCatalogueData ? (
        <ResponsiveOperationError message={t('boxes.refreshError')} busy={boxesQuery.isFetching || venuesQuery.isFetching} onRetry={() => { void boxesQuery.refetch(); void venuesQuery.refetch() }} />
      ) : null}
      {hasCatalogueData && boxes.length > 0 ? (
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 flex-1">
            <SpaceFilterChips
              spaces={spaces}
              selectedSpace={selectedSpace}
              totalCount={boxes.length}
              onChange={(spaceId) => updateCatalogueParam('space', spaceId)}
            />
          </div>
          <p className="shrink-0 text-sm font-bold text-muted" role="status" aria-label={t('boxes.showCountAria', { count: visibleBoxes.length })}>
            <span className="sm:hidden" aria-hidden="true">{t('boxes.showCountShort', { count: visibleBoxes.length })}</span>
            <span className="hidden sm:inline" aria-hidden="true">{t('boxes.showCount', { count: visibleBoxes.length })}</span>
          </p>
        </div>
      ) : null}

      {createSucceeded && createdBox ? (
        <BoxCreationNextStep box={createdBox} />
      ) : null}

      {hasCatalogueData && boxes.length === 0 ? (
        <PageState
          state="empty"
          icon="box"
          title={t('boxes.emptyTitle')}
          action={(
            <button className="inline-flex min-h-11 items-center rounded-control bg-brand px-4 py-2 font-bold text-white" type="button" onClick={openCreate}>
              {t('boxes.create')}
            </button>
          )}
        />
      ) : null}

      {hasCatalogueData && boxes.length > 0 && visibleBoxes.length === 0 ? (
        <PageState
          state="empty"
          icon="search"
          title={t('boxes.noMatchTitle')}
          action={(
            <button className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 py-2 font-bold text-ink" type="button" onClick={clearCatalogueFilters}>
              {t('boxes.clearFilter')}
            </button>
          )}
        />
      ) : null}

      {visibleBoxes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visibleBoxes.map((box) => (
            <BoxCatalogueCard
              box={box}
              menuOpen={openMenuBoxId === box.id}
              onMenuToggle={() => setOpenMenuBoxId((current) => current === box.id ? null : box.id)}
              onMenuClose={() => setOpenMenuBoxId(null)}
              onEdit={openEdit}
              onDelete={(target, trigger) => {
                deleteMutation.reset()
                deleteReturnFocusRef.current = trigger
                setOpenMenuBoxId(null)
                setDeleteTarget(target)
              }}
              key={box.id}
            />
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('boxes.deleteTitle', { name: deleteTarget?.name ?? '' })}
        description={t('boxes.deleteDescription')}
        busy={deleteMutation.isPending}
        error={deleteMutation.isError ? t('boxes.deleteError') : undefined}
        returnFocusRef={deleteReturnFocusRef}
        onCancel={() => {
          deleteMutation.reset()
          setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
      <CreateBoxModal
        open={creating}
        onClose={closeCreate}
        onCompleted={(box) => {
          setCreatedBox(box)
          setCreateCompletionPending(true)
          setCreateBusy(false)
          void queryClient.invalidateQueries({ queryKey: ['boxes'] })
          void queryClient.invalidateQueries({ queryKey: ['box-plan'] })
        }}
        onBusyChange={setCreateBusy}
        onLimitReached={() => {
          setPaywallOpen(true)
          void queryClient.invalidateQueries({ queryKey: ['box-plan'] })
        }}
      />
      <BoxLimitPaywall
        open={paywallOpen}
        busy={checkoutMutation.isPending}
        onClose={closePaywall}
        onPurchase={() => checkoutMutation.mutate()}
      />
      {checkoutMutation.isError && errorCode(checkoutMutation.error) !== 'entitlement_already_owned' ? (
        <ResponsiveOperationError
          message={t('boxes.billingUnavailable')}
          busy={checkoutMutation.isPending}
          onRetry={() => checkoutMutation.mutate()}
        />
      ) : null}
      <EditBoxModal
        open={Boolean(editingBoxId)}
        boxId={editingBoxId ?? ''}
        returnFocusRef={editReturnFocusRef}
        onClose={closeEdit}
        onBusyChange={setEditBusy}
        onSaved={() => {
          setEditCompletionPending(true)
          void queryClient.invalidateQueries({ queryKey: ['boxes'] })
          feedback.notify(t('boxes.saved'))
        }}
      />
    </section>
  )
}
