import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useSelectedVenue } from '../venues/selected-venue'
import { listVenues } from '../venues/venues.api'
import { BoxCatalogueCard } from './BoxCatalogueCard'
import { BoxCatalogueToolbar } from './BoxCatalogueToolbar'
import {
  catalogueSpaces,
  catalogueSummary,
  filterBoxes,
} from './box-catalogue'
import { deleteBox, listBoxesForVenue, type BoxSummary } from './boxes.api'
import { CreateBoxModal } from './CreateBoxModal'
import { SpaceFilterChips } from './SpaceFilterChips'

type CatalogueParam = 'q' | 'space'

const EMPTY_BOXES: readonly BoxSummary[] = []

export function BoxesPage() {
  const queryClient = useQueryClient()
  const feedback = useMobileFeedback()
  const createButtonRef = useRef<HTMLButtonElement | null>(null)
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<BoxSummary | null>(null)
  const [openMenuBoxId, setOpenMenuBoxId] = useState<string | null>(null)
  const [createBusy, setCreateBusy] = useState(false)
  const [createCompletionPending, setCreateCompletionPending] = useState(false)
  const [createSucceeded, setCreateSucceeded] = useState(false)
  const createSuccessTimerRef = useRef<number | null>(null)
  const venuesQuery = useQuery({ queryKey: ['venues'], queryFn: listVenues })
  const venues = venuesQuery.data ?? []
  const [selectedVenueId] = useSelectedVenue(venues)
  const boxesQuery = useQuery({
    queryKey: ['boxes', selectedVenueId],
    queryFn: () => listBoxesForVenue(selectedVenueId!),
    enabled: Boolean(selectedVenueId),
  })
  const deleteMutation = useMutation({
    mutationFn: (boxId: string) => deleteBox(boxId),
    onSuccess: (_data, boxId) => {
      queryClient.setQueriesData<BoxSummary[]>({ queryKey: ['boxes'] }, (current) => current?.filter((box) => box.id !== boxId))
      deleteReturnFocusRef.current = createButtonRef.current
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['boxes'] })
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
  const query = searchParams.get('q') ?? ''
  const selectedSpace = searchParams.get('space') ?? ''
  const creating = searchParams.get('create') === '1'
  const wasCreating = useRef(creating)
  const createBlocker = useBlocker(creating && createBusy)
  const spaces = useMemo(() => catalogueSpaces(boxes), [boxes])
  const summary = useMemo(() => catalogueSummary(boxes), [boxes])
  const visibleBoxes = useMemo(() => filterBoxes(boxes, {
    query,
    spaceId: selectedSpace,
  }), [boxes, query, selectedSpace])

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
    next.delete('q')
    next.delete('space')
    next.delete('sort')
    setSearchParams(next, { replace: true })
  }

  const clearCreateSuccessTimer = useCallback(() => {
    if (createSuccessTimerRef.current === null) return
    window.clearTimeout(createSuccessTimerRef.current)
    createSuccessTimerRef.current = null
  }, [])

  const openCreate = () => {
    clearCreateSuccessTimer()
    setCreateSucceeded(false)
    setCreateCompletionPending(false)
    const next = new URLSearchParams(searchParams)
    next.set('create', '1')
    setSearchParams(next)
  }

  const closeCreate = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (createBlocker.state === 'blocked' && !createBusy) createBlocker.reset()
  }, [createBlocker, createBusy])

  useEffect(() => {
    if (createCompletionPending && creating && !createBusy) closeCreate()
  }, [closeCreate, createBusy, createCompletionPending, creating])

  useEffect(() => {
    if (!createCompletionPending || creating) return
    setCreateCompletionPending(false)
    setCreateSucceeded(true)
    feedback.notify('箱子已创建')
    clearCreateSuccessTimer()
    createSuccessTimerRef.current = window.setTimeout(() => {
      createSuccessTimerRef.current = null
      setCreateSucceeded(false)
    }, 4_000)
  }, [clearCreateSuccessTimer, createCompletionPending, creating, feedback])

  useEffect(() => clearCreateSuccessTimer, [clearCreateSuccessTimer])

  useEffect(() => {
    setOpenMenuBoxId(null)
  }, [query, selectedSpace])

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
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">收纳目录</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mb-0 text-page-title font-extrabold" id="boxes-title">全部箱子</h1>
            {selectedVenue ? (
              <p className="mt-1 mb-0 flex min-w-0 items-center gap-1.5 truncate text-sm text-muted">
                <span className="truncate font-medium">{selectedVenue.name}</span>
                {hasCatalogueData ? (
                  <>
                    <span className="shrink-0" aria-hidden="true">·</span>
                    <span className="shrink-0">{summary.boxCount} 个箱子 · {summary.itemCount} 件物品</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <button
            ref={createButtonRef}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-brand bg-brand text-white transition hover:bg-brand-strong"
            type="button"
            aria-label="创建箱子"
            title="创建箱子"
            onClick={openCreate}
          >
            <AppIcon name="plus" />
          </button>
        </div>
      </header>

      {cataloguePending ? (
        <SkeletonGroup className="grid gap-5" label="正在加载箱子目录">
          <Skeleton className="h-12 w-full" />
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
      {catalogueError && !hasCatalogueData ? <PageState state="error" message="箱子加载失败，请重试" onRetry={() => { void boxesQuery.refetch(); void venuesQuery.refetch() }} /> : null}
      {catalogueError && hasCatalogueData ? (
        <ResponsiveOperationError message="箱子刷新失败，正在显示上次结果" busy={boxesQuery.isFetching || venuesQuery.isFetching} onRetry={() => { void boxesQuery.refetch(); void venuesQuery.refetch() }} />
      ) : null}
      {hasCatalogueData && boxes.length > 0 ? (
        <>
          <BoxCatalogueToolbar
            query={query}
            onQueryChange={(nextQuery) => updateCatalogueParam('q', nextQuery)}
          />
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <SpaceFilterChips
                spaces={spaces}
                selectedSpace={selectedSpace}
                totalCount={boxes.length}
                onChange={(spaceId) => updateCatalogueParam('space', spaceId)}
              />
            </div>
            <p className="shrink-0 text-sm font-bold text-muted" role="status" aria-label={`显示 ${visibleBoxes.length} 个箱子`}>
              <span className="sm:hidden" aria-hidden="true">{visibleBoxes.length} 个</span>
              <span className="hidden sm:inline" aria-hidden="true">显示 {visibleBoxes.length} 个</span>
            </p>
          </div>
        </>
      ) : null}

      {createSucceeded ? <p className="m-0 hidden text-sm font-medium text-brand lg:block" role="status" aria-label="箱子已创建">箱子已创建</p> : null}

      {hasCatalogueData && boxes.length === 0 ? (
        <PageState
          state="empty"
          icon="box"
          title="还没有箱子"
          action={(
            <button className="inline-flex min-h-11 items-center rounded-control bg-brand px-4 py-2 font-bold text-white" type="button" onClick={openCreate}>
              创建箱子
            </button>
          )}
        />
      ) : null}

      {hasCatalogueData && boxes.length > 0 && visibleBoxes.length === 0 ? (
        <PageState
          state="empty"
          icon="search"
          title="没有匹配的箱子"
          action={(
            <button className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 py-2 font-bold text-ink" type="button" onClick={clearCatalogueFilters}>
              清除筛选
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
        title={`删除“${deleteTarget?.name ?? ''}”？`}
        description="箱子内的物品也会被删除，此操作无法恢复。"
        busy={deleteMutation.isPending}
        error={deleteMutation.isError ? '删除失败，请稍后重试' : undefined}
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
        onCompleted={() => {
          setCreateCompletionPending(true)
          setCreateBusy(false)
          void queryClient.invalidateQueries({ queryKey: ['boxes'] })
        }}
        onBusyChange={setCreateBusy}
      />
    </section>
  )
}
