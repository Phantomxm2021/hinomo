import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { BoxCatalogueCard } from './BoxCatalogueCard'
import { BoxCatalogueToolbar } from './BoxCatalogueToolbar'
import {
  catalogueSpaces,
  catalogueSummary,
  filterAndSortBoxes,
  parseCatalogueSort,
  type BoxCatalogueSort,
} from './box-catalogue'
import { deleteBox, listBoxes, type BoxSummary } from './boxes.api'
import { CreateBoxModal } from './CreateBoxModal'
import { SpaceFilterChips } from './SpaceFilterChips'

type CatalogueParam = 'q' | 'space' | 'sort'

const EMPTY_BOXES: readonly BoxSummary[] = []

export function BoxesPage() {
  const queryClient = useQueryClient()
  const createButtonRef = useRef<HTMLButtonElement | null>(null)
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<BoxSummary | null>(null)
  const [openMenuBoxId, setOpenMenuBoxId] = useState<string | null>(null)
  const [createBusy, setCreateBusy] = useState(false)
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const deleteMutation = useMutation({
    mutationFn: (boxId: string) => deleteBox(boxId),
    onSuccess: (_data, boxId) => {
      queryClient.setQueryData<BoxSummary[]>(['boxes'], (current) => current?.filter((box) => box.id !== boxId))
      deleteReturnFocusRef.current = createButtonRef.current
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['boxes'] })
    },
  })
  const boxes = boxesQuery.data ?? EMPTY_BOXES
  const hasCatalogueData = boxesQuery.data !== undefined
  const query = searchParams.get('q') ?? ''
  const selectedSpace = searchParams.get('space') ?? ''
  const rawSort = searchParams.get('sort')
  const sort = parseCatalogueSort(rawSort)
  const creating = searchParams.get('create') === '1'
  const wasCreating = useRef(creating)
  const createBlocker = useBlocker(creating && createBusy)
  const spaces = useMemo(() => catalogueSpaces(boxes), [boxes])
  const summary = useMemo(() => catalogueSummary(boxes), [boxes])
  const visibleBoxes = useMemo(() => filterAndSortBoxes(boxes, {
    query,
    spaceId: selectedSpace,
    sort,
  }), [boxes, query, selectedSpace, sort])

  useEffect(() => {
    if (rawSort === null || rawSort === 'name' || rawSort === 'items') return
    const next = new URLSearchParams(searchParams)
    next.delete('sort')
    setSearchParams(next, { replace: true })
  }, [rawSort, searchParams, setSearchParams])

  const updateCatalogueParam = (key: CatalogueParam, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value || (key === 'sort' && value === 'recent')) next.delete(key)
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

  const openCreate = () => {
    const next = new URLSearchParams(searchParams)
    next.set('create', '1')
    setSearchParams(next)
  }

  const closeCreate = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (createBlocker.state === 'blocked' && !createBusy) createBlocker.reset()
  }, [createBlocker, createBusy])

  useEffect(() => {
    setOpenMenuBoxId(null)
  }, [query, selectedSpace, sort])

  useEffect(() => {
    const shouldRestoreFocus = wasCreating.current && !creating
    wasCreating.current = creating
    if (!shouldRestoreFocus) return
    const focusFrame = window.requestAnimationFrame(() => createButtonRef.current?.focus())
    return () => window.cancelAnimationFrame(focusFrame)
  }, [creating])

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-7" aria-labelledby="boxes-title">
      <header className="flex flex-col gap-5 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">收纳目录</p>
          <h1 className="mb-0 text-page-title font-extrabold" id="boxes-title">全部箱子</h1>
          {hasCatalogueData ? (
            <p className="mt-2 text-sm text-muted">{summary.boxCount} 个箱子 · {summary.itemCount} 件物品</p>
          ) : null}
        </div>
        <button
          ref={createButtonRef}
          className="inline-flex min-h-11 items-center justify-center self-start rounded-control border border-brand bg-brand px-4 py-2 font-bold text-white transition hover:bg-brand-strong sm:self-auto"
          type="button"
          aria-label="创建箱子"
          onClick={openCreate}
        >
          <AppIcon name="plus" className="mr-2" />
          <span className="sm:hidden">新建</span>
          <span className="hidden sm:inline">创建箱子</span>
        </button>
      </header>

      {boxesQuery.isPending && boxesQuery.data === undefined ? (
        <SkeletonGroup className="grid gap-5" label="正在加载箱子目录">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
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
      {boxesQuery.isError && !hasCatalogueData ? <PageState state="error" message="箱子加载失败，请重试" onRetry={() => void boxesQuery.refetch()} /> : null}
      {boxesQuery.isError && hasCatalogueData ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          <p className="m-0 font-medium">箱子刷新失败，正在显示上次结果</p>
          <button className="min-h-11 rounded-control border border-danger/30 bg-surface px-4 py-2 font-bold" type="button" onClick={() => void boxesQuery.refetch()}>重试</button>
        </div>
      ) : null}
      {hasCatalogueData && boxes.length > 0 ? (
        <>
          <BoxCatalogueToolbar
            query={query}
            sort={sort}
            onQueryChange={(nextQuery) => updateCatalogueParam('q', nextQuery)}
            onSortChange={(nextSort: BoxCatalogueSort) => updateCatalogueParam('sort', nextSort)}
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

      {hasCatalogueData && boxes.length === 0 ? (
        <PageState
          state="empty"
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
        onCreated={() => { void queryClient.invalidateQueries({ queryKey: ['boxes'] }) }}
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: ['boxes'] })
          closeCreate()
        }}
        onBusyChange={setCreateBusy}
      />
    </section>
  )
}
