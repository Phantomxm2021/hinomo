import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import {
  isVenuesSchemaUnavailable,
  listVenues,
} from '../venues/venues.api'
import { useSelectedVenue } from '../venues/selected-venue'
import { SpaceCard } from './SpaceCard'
import { SpaceMap } from './SpaceMap'
import { spaceSchema, type SpaceFormValues } from './space.schema'
import {
  createSpace,
  deleteSpace,
  isLayoutStorageUnavailable,
  listSpaceLayouts,
  listSpaces,
  saveSpaceLayout,
  type SpaceLayout,
  type SpacePosition,
  type SpaceSummary,
  updateSpace,
} from './spaces.api'

type SpaceView = 'cards' | 'plan'

function getInitialView(): SpaceView {
  try {
    return window.localStorage.getItem('nomo-space-view') === 'plan' ? 'plan' : 'cards'
  } catch {
    return 'cards'
  }
}

function getEditorControls(dialog: HTMLElement | null) {
  if (!dialog) return []
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
    ),
  )
}

export function SpacesPage() {
  const queryClient = useQueryClient()
  const feedback = useMobileFeedback()
  const editorOpenerRef = useRef<HTMLElement | null>(null)
  const headerCreateButtonRef = useRef<HTMLButtonElement | null>(null)
  const deleteReturnFocusRef = useRef<HTMLElement | null>(null)
  const editorDialogRef = useRef<HTMLElement | null>(null)
  const editorCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const editorSubmitButtonRef = useRef<HTMLButtonElement | null>(null)
  const submissionPendingRef = useRef(false)
  const layoutSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SpaceSummary | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SpaceSummary | null>(null)
  const [layoutEditMode, setLayoutEditMode] = useState(false)
  const [view, setView] = useState<SpaceView>(getInitialView)
  const venuesQuery = useQuery({ queryKey: ['venues'], queryFn: listVenues })
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const layoutsQuery = useQuery({ queryKey: ['space-layouts'], queryFn: listSpaceLayouts })
  const venues = venuesQuery.data ?? []
  const [selectedVenueId] = useSelectedVenue(venues)
  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createSpace>[0]) => createSpace(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (spaceId: string) => deleteSpace(spaceId),
    onSuccess: async () => {
      deleteReturnFocusRef.current = headerCreateButtonRef.current
      setDeleteTarget(null)
      feedback.notify('空间已删除')
      await queryClient.invalidateQueries({ queryKey: ['spaces'] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateSpace>[1] }) =>
      updateSpace(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  })
  const layoutMutation = useMutation({
    mutationFn: ({ spaceId, position }: { spaceId: string; position: SpacePosition }) => {
      const nextSave = layoutSaveQueueRef.current
        .catch(() => undefined)
        .then(() => saveSpaceLayout(spaceId, position))
      layoutSaveQueueRef.current = nextSave
      return nextSave
    },
    onSuccess: (_, { spaceId, position }) => {
      queryClient.setQueryData<SpaceLayout[]>(['space-layouts'], (current = []) => [
        ...current.filter((layout) => layout.space_id !== spaceId),
        { space_id: spaceId, ...position },
      ])
    },
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SpaceFormValues>({
    resolver: zodResolver(spaceSchema),
    defaultValues: { venue_id: '', name: '', description: '' },
  })
  const editorPending = createMutation.isPending || updateMutation.isPending
  const layoutStorageUnavailable = isLayoutStorageUnavailable(layoutsQuery.error)
  const resetCreateMutation = createMutation.reset
  const resetUpdateMutation = updateMutation.reset

  const restoreEditorFocus = useCallback(() => {
    const opener = editorOpenerRef.current
    const focusTarget = opener?.isConnected && opener.tabIndex >= 0 && !opener.hasAttribute('disabled')
      ? opener
      : headerCreateButtonRef.current
    focusTarget?.focus()
    editorOpenerRef.current = null
  }, [])

  const closeEditor = useCallback(() => {
    if (editorPending) return
    setEditorOpen(false)
    setEditTarget(null)
    reset({ venue_id: '', name: '', description: '' })
    resetCreateMutation()
    resetUpdateMutation()
  }, [editorPending, reset, resetCreateMutation, resetUpdateMutation])

  useEffect(() => {
    if (!editorOpen && editorOpenerRef.current) restoreEditorFocus()
  }, [editorOpen, restoreEditorFocus])

  const closeEditorOnEscape = useCallback((event: {
    key: string
  }) => {
    if (event.key === 'Escape') closeEditor()
  }, [closeEditor])

  useEffect(() => {
    if (!editorOpen) return

    document.addEventListener('keydown', closeEditorOnEscape)
    return () => document.removeEventListener('keydown', closeEditorOnEscape)
  }, [closeEditorOnEscape, editorOpen])

  useEffect(() => {
    if (!editorOpen) return

    const appShell = document.querySelector<HTMLElement>('[data-app-shell]')
    const previousAriaHidden = appShell?.getAttribute('aria-hidden') ?? null
    const hadInert = appShell?.hasAttribute('inert') ?? false
    const previousBodyOverflow = document.body.style.overflow
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = 'hidden'

    return () => {
      if (appShell) {
        if (!hadInert) appShell.removeAttribute('inert')
        if (previousAriaHidden === null) appShell.removeAttribute('aria-hidden')
        else appShell.setAttribute('aria-hidden', previousAriaHidden)
      }
      document.body.style.overflow = previousBodyOverflow
    }
  }, [editorOpen])

  const submit = handleSubmit(async (values) => {
    if (submissionPendingRef.current) return
    submissionPendingRef.current = true
    const input = {
      venue_id: values.venue_id,
      name: values.name,
      description: values.description || null,
    }

    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ id: editTarget.id, input })
      } else {
        await createMutation.mutateAsync(input)
      }
      feedback.notify(editTarget ? '空间已更新' : '空间已创建')
      setEditorOpen(false)
      setEditTarget(null)
      reset({ venue_id: '', name: '', description: '' })
    } catch {
      // Mutation state renders a stable Chinese error without leaking backend text.
    } finally {
      submissionPendingRef.current = false
    }
  })

  function beginEdit(space: SpaceSummary) {
    editorOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    createMutation.reset()
    updateMutation.reset()
    setEditTarget(space)
    reset({
      venue_id: space.venue_id || selectedVenueId || venuesQuery.data?.[0]?.id || '',
      name: space.name,
      description: space.description ?? '',
    })
    setEditorOpen(true)
  }

  function beginCreate() {
    editorOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    createMutation.reset()
    updateMutation.reset()
    setEditTarget(null)
    reset({
      venue_id: selectedVenueId ?? venuesQuery.data?.[0]?.id ?? '',
      name: '',
      description: '',
    })
    setEditorOpen(true)
  }

  function requestDelete(space: SpaceSummary, trigger: HTMLButtonElement) {
    setBlockedMessage(null)
    if (space.box_count > 0) {
      setBlockedMessage(`请先移动或删除其中的 ${space.box_count} 个箱子`)
      return
    }
    deleteReturnFocusRef.current = trigger
    setDeleteTarget(space)
  }

  function selectView(nextView: SpaceView) {
    setView(nextView)
    if (nextView === 'cards') setLayoutEditMode(false)
    try {
      window.localStorage.setItem('nomo-space-view', nextView)
    } catch {
      // The view still changes when storage is unavailable or restricted.
    }
  }

  const spaces = spacesQuery.data ?? []
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null
  const visibleSpaces = selectedVenueId
    ? spaces.filter((space) => !space.venue_id || space.venue_id === selectedVenueId)
    : []

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-7xl gap-5 lg:gap-6" aria-labelledby="spaces-title">
      <header className="py-3">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">整理你的收纳范围</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mb-0 text-page-title font-extrabold" id="spaces-title">空间</h1>
            {venuesQuery.isPending && venuesQuery.data === undefined ? <Skeleton className="mt-2 h-4 w-20" /> : null}
            {selectedVenue ? <p className="mt-1 mb-0 truncate text-meta font-medium tracking-eyebrow text-muted">{selectedVenue.name}</p> : null}
            {venuesQuery.isSuccess && !selectedVenue ? <p className="mt-1 mb-0 text-sm font-semibold text-muted">暂无场地</p> : null}
          </div>
          <button
            ref={headerCreateButtonRef}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-brand bg-brand text-white transition hover:bg-brand-strong"
            type="button"
            aria-label="创建空间"
            title="创建空间"
            disabled={venues.length === 0}
            onClick={beginCreate}
          >
            <AppIcon name="plus" size={20} />
          </button>
        </div>
      </header>

      {venuesQuery.isError ? (
        <PageState
          state="error"
          message={isVenuesSchemaUnavailable(venuesQuery.error)
            ? '场地功能尚未部署，请先执行 venues 数据库迁移。'
            : '场地加载失败，请重试'}
          onRetry={() => void venuesQuery.refetch()}
        />
      ) : null}

      {editorOpen
        ? createPortal(
          <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] lg:items-center lg:p-3"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor()
          }}
        >
            <section
              ref={editorDialogRef}
              className="max-h-[calc(100dvh-max(0.75rem,var(--safe-area-top)))] w-full max-w-lg overflow-y-auto rounded-t-[1.5rem] border-x-0 border-t border-b-0 border-line bg-surface p-5 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-float lg:max-h-[calc(100dvh-1.5rem)] lg:rounded-shell lg:border lg:p-6"
              role="dialog"
              aria-modal="true"
              aria-busy={editorPending}
              aria-labelledby="space-editor-title"
            >
            <span
              className="pointer-events-none fixed h-px w-px overflow-hidden opacity-0"
              tabIndex={0}
              onFocus={() => getEditorControls(editorDialogRef.current).at(-1)?.focus()}
            />
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="mb-0 text-section-title font-bold" id="space-editor-title">{editTarget ? '编辑空间' : '创建空间'}</h2>
              <button
                ref={editorCloseButtonRef}
                className="grid min-h-11 w-11 flex-none place-items-center rounded-control border border-line bg-canvas p-0 text-ink"
                type="button"
                aria-label={`关闭${editTarget ? '编辑空间' : '创建空间'}编辑器`}
                disabled={editorPending}
                onClick={closeEditor}
                onKeyDown={(event) => {
                  if (event.key === 'Tab' && event.shiftKey) {
                    event.preventDefault()
                    editorSubmitButtonRef.current?.focus()
                  }
                }}
              >
                <AppIcon name="close" />
              </button>
            </div>
            <form className="grid gap-3" onSubmit={submit} noValidate>
              <label className="font-bold text-ink" htmlFor="space-venue">场地</label>
              <select
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-venue"
                {...register('venue_id')}
                disabled={editorPending}
                aria-invalid={errors.venue_id ? 'true' : undefined}
              >
                <option value="">请选择场地</option>
                {venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}
              </select>
              {errors.venue_id ? <p role="alert">{errors.venue_id.message}</p> : null}
              <label className="font-bold text-ink" htmlFor="space-name">空间名称</label>
              <input
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-name"
                {...register('name')}
                autoFocus
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'space-name-error' : undefined}
                readOnly={editorPending}
              />
              {errors.name ? (
                <p id="space-name-error" role="alert">{errors.name.message}</p>
              ) : null}
              <label className="font-bold text-ink" htmlFor="space-description">描述（可选）</label>
              <textarea
                className="min-h-28 w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-description"
                rows={3}
                {...register('description')}
                aria-invalid={errors.description ? 'true' : undefined}
                aria-describedby={errors.description ? 'space-description-error' : undefined}
                readOnly={editorPending}
              />
              {errors.description ? (
                <p id="space-description-error" role="alert">
                  {errors.description.message}
                </p>
              ) : null}
              {createMutation.isError || updateMutation.isError ? (
                <ResponsiveOperationError message="保存失败，请稍后重试" />
              ) : null}
              {editorPending ? (
                <p className="hidden lg:block" role="status" aria-live="polite">正在保存空间…</p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2.5">
                <button className="min-h-11 rounded-control border border-brand/40 bg-brand/10 px-4.5 py-2.5 font-bold text-ink" type="button" disabled={editorPending} onClick={closeEditor}>
                  取消
                </button>
                <button
                  ref={editorSubmitButtonRef}
                  className="min-h-12 rounded-control border border-brand bg-brand px-4.5 py-2.5 font-bold text-white hover:bg-brand-strong"
                  type="submit"
                  disabled={editorPending}
                  onKeyDown={(event) => {
                    if (event.key === 'Tab' && !event.shiftKey) {
                      event.preventDefault()
                      editorCloseButtonRef.current?.focus()
                    }
                  }}
                >
                  {editorPending ? '保存中…' : editTarget ? '保存空间' : '创建空间'}
                </button>
              </div>
            </form>
            <span
              className="pointer-events-none fixed h-px w-px overflow-hidden opacity-0"
              tabIndex={0}
              onFocus={() => getEditorControls(editorDialogRef.current)[0]?.focus()}
            />
            </section>
          </div>,
          document.body,
        )
        : null}

      {blockedMessage ? <ResponsiveOperationError message={blockedMessage} /> : null}
      {deleteMutation.isError ? <ResponsiveOperationError message="删除失败，请稍后重试" /> : null}
      {spacesQuery.isPending && spacesQuery.data === undefined ? (
        <SkeletonGroup className="grid gap-5" label="正在加载空间">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-11 w-56" />
            <Skeleton className="h-11 w-28" />
          </div>
          {view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="grid min-h-44 content-between rounded-card border border-line bg-surface p-5" key={index}>
                  <Skeleton className="size-10 rounded-full" />
                  <div className="grid gap-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-4 w-4/5" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-shell border border-line bg-surface p-5">
              <Skeleton className="h-64 w-full" />
            </div>
          )}
        </SkeletonGroup>
      ) : null}
      {spacesQuery.isError ? <PageState state="error" message="空间加载失败，请重试" onRetry={() => void spacesQuery.refetch()} /> : null}
      {spacesQuery.data && venuesQuery.isSuccess && visibleSpaces.length === 0 ? (
        <PageState state="empty" icon="space" title="还没有空间" />
      ) : null}
      {spacesQuery.data && venuesQuery.isSuccess && visibleSpaces.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-control border border-line bg-surface p-1" role="group" aria-label="空间视图">
              <button className={`inline-flex min-h-11 items-center gap-2 rounded-control px-3.5 py-2 font-bold ${view === 'cards' ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink'}`} type="button" aria-pressed={view === 'cards'} onClick={() => selectView('cards')}>
                <AppIcon name="space" size={18} />卡片视图
              </button>
              <button className={`inline-flex min-h-11 items-center gap-2 rounded-control px-3.5 py-2 font-bold ${view === 'plan' ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink'}`} type="button" aria-pressed={view === 'plan'} onClick={() => selectView('plan')}>
                <AppIcon name="box" size={18} />平面视图
              </button>
            </div>
            {view === 'plan' ? (
              <button className={`min-h-11 rounded-control border px-4 py-2.5 font-bold disabled:cursor-not-allowed disabled:opacity-55 ${layoutEditMode ? 'border-brand bg-brand/10 text-brand-strong' : 'border-line bg-surface text-ink'}`} type="button" aria-label={layoutsQuery.isPending ? '布局加载中' : undefined} title={layoutsQuery.isPending ? '布局加载中' : undefined} aria-pressed={layoutEditMode} disabled={layoutsQuery.isPending} onClick={() => setLayoutEditMode((current) => !current)}>
                {layoutsQuery.isPending ? <Skeleton as="span" className="inline-block h-4 w-16" /> : layoutEditMode ? '完成调整' : '调整布局'}
              </button>
            ) : null}
          </div>
          {view === 'plan' && layoutEditMode ? <p className="text-meta text-muted" role="status">拖动卡片移动位置；拖动右下角调整尺寸。{layoutsQuery.isSuccess ? '布局会自动保存。' : '当前调整仅保留在页面中。'}</p> : null}
          {view === 'plan' && layoutStorageUnavailable ? <ResponsiveOperationError message="布局保存尚未启用，请先执行 space_layouts 数据库迁移。当前仍可浏览自动布局。" /> : null}
          {view === 'plan' && layoutsQuery.isError && !layoutStorageUnavailable ? <ResponsiveOperationError message="布局加载失败；当前显示自动布局。" busy={layoutsQuery.isFetching} retryLabel="重试布局" onRetry={() => void layoutsQuery.refetch()} /> : null}
          {layoutMutation.isError ? (
            <ResponsiveOperationError
              message="布局保存失败；当前调整仍保留在页面中。"
              busy={layoutMutation.isPending}
              retryLabel="重试保存布局"
              onRetry={layoutMutation.variables ? () => layoutMutation.mutate(layoutMutation.variables!) : undefined}
            />
          ) : null}
          {view === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleSpaces.map((space, index) => (
                <SpaceCard key={space.id} space={space} index={index} onEdit={() => beginEdit(space)} onDelete={(trigger) => requestDelete(space, trigger)} />
              ))}
            </div>
          ) : (
            <SpaceMap spaces={visibleSpaces} layouts={layoutsQuery.data ?? []} editMode={layoutEditMode} onLayoutChange={(spaceId, position) => { if (layoutsQuery.isSuccess) layoutMutation.mutate({ spaceId, position }) }} />
          )}
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`删除“${deleteTarget?.name ?? ''}”？`}
        description="删除后无法恢复。"
        busy={deleteMutation.isPending}
        returnFocusRef={deleteReturnFocusRef}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </section>
  )
}
