import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useI18n } from '../../i18n/I18nProvider'
import { useMobileFeedback } from '../../components/mobile-feedback'
import {
  isVenuesSchemaUnavailable,
  listVenues,
} from '../venues/venues.api'
import { useSelectedVenue } from '../venues/selected-venue'
import { SpaceCard } from './SpaceCard'
import { SpaceMap } from './SpaceMap'
import { createSpaceSchema, type SpaceFormValues } from './space.schema'
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

const spaceNameTemplates = ['livingRoom', 'bedroom', 'kitchen', 'storageRoom', 'study'] as const

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
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const feedback = useMobileFeedback()
  const [searchParams, setSearchParams] = useSearchParams()
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
      feedback.notify(t('spaces.deleted'))
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
    setValue,
    trigger,
    formState: { errors },
  } = useForm<SpaceFormValues>({
    resolver: zodResolver(createSpaceSchema(t)),
    defaultValues: { venue_id: '', name: '', description: '' },
  })
  const previousLocaleRef = useRef(locale)
  useEffect(() => {
    if (previousLocaleRef.current !== locale && Object.keys(errors).length > 0) void trigger()
    previousLocaleRef.current = locale
  }, [errors, locale, trigger])
  const editorPending = createMutation.isPending || updateMutation.isPending
  const layoutStorageUnavailable = isLayoutStorageUnavailable(layoutsQuery.error)
  const resetCreateMutation = createMutation.reset
  const resetUpdateMutation = updateMutation.reset

  const clearCreateRequest = useCallback(() => {
    if (!searchParams.has('create')) return
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    next.delete('from')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

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
    clearCreateRequest()
  }, [clearCreateRequest, editorPending, reset, resetCreateMutation, resetUpdateMutation])

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
      feedback.notify(editTarget ? t('spaces.updated') : t('spaces.created'))
      setEditorOpen(false)
      setEditTarget(null)
      reset({ venue_id: '', name: '', description: '' })
      clearCreateRequest()
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

  const beginCreate = useCallback(() => {
    editorOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    resetCreateMutation()
    resetUpdateMutation()
    setEditTarget(null)
    reset({
      venue_id: selectedVenueId ?? venuesQuery.data?.[0]?.id ?? '',
      name: '',
      description: '',
    })
    setEditorOpen(true)
  }, [reset, resetCreateMutation, resetUpdateMutation, selectedVenueId, venuesQuery.data])

  useEffect(() => {
    if (searchParams.get('create') !== '1' || editorOpen || venuesQuery.isPending) return
    beginCreate()
  }, [beginCreate, editorOpen, searchParams, venuesQuery.isPending])

  function requestDelete(space: SpaceSummary, trigger: HTMLButtonElement) {
    setBlockedMessage(null)
    if (space.box_count > 0) {
      setBlockedMessage(t('spaces.deletingBlocked', { count: space.box_count }))
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
  const existingSpaceNames = new Set(visibleSpaces.map((space) => space.name.trim()))
  const spaceTemplateLabels: Record<typeof spaceNameTemplates[number], string> = {
    livingRoom: t('spaces.templates.livingRoom'),
    bedroom: t('spaces.templates.bedroom'),
    kitchen: t('spaces.templates.kitchen'),
    storageRoom: t('spaces.templates.storageRoom'),
    study: t('spaces.templates.study'),
  }

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-7xl gap-5 lg:gap-6" aria-labelledby="spaces-title">
      <header className="py-3">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">{t('spaces.eyebrow')}</p>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="mb-0 text-page-title font-extrabold" id="spaces-title">{t('spaces.title')}</h1>
            {venuesQuery.isPending && venuesQuery.data === undefined ? <Skeleton className="mt-2 h-4 w-20" /> : null}
            {selectedVenue ? <p className="mt-1 mb-0 truncate text-meta font-medium tracking-eyebrow text-muted">{selectedVenue.name}</p> : null}
            {venuesQuery.isSuccess && !selectedVenue ? <p className="mt-1 mb-0 text-sm font-semibold text-muted">{t('spaces.noVenue')}</p> : null}
          </div>
          <button
            ref={headerCreateButtonRef}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-brand bg-brand text-white transition hover:bg-brand-strong"
            type="button"
            aria-label={t('spaces.createAria')}
            title={t('spaces.createAria')}
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
            ? t('spaces.errorSchema')
            : t('spaces.errorVenue')}
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
              <h2 className="mb-0 text-section-title font-bold" id="space-editor-title">{editTarget ? t('spaces.editorEdit') : t('spaces.editorCreate')}</h2>
              <button
                ref={editorCloseButtonRef}
                className="grid min-h-11 w-11 flex-none place-items-center rounded-control border border-line bg-canvas p-0 text-ink"
                type="button"
                aria-label={t('spaces.closeEditor', { action: editTarget ? t('spaces.editorEdit') : t('spaces.editorCreate') })}
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
            {searchParams.get('from') === 'box' ? (
              <p className="mb-5 rounded-control bg-brand/10 px-4 py-3 text-sm font-medium leading-relaxed text-ink">
                {t('spaces.fromBoxHint')}
              </p>
            ) : null}
            <form className="grid gap-3" onSubmit={submit} noValidate>
              <label className="font-bold text-ink" htmlFor="space-venue">{t('spaces.venue')}</label>
              <select
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-venue"
                {...register('venue_id')}
                disabled={editorPending}
                aria-invalid={errors.venue_id ? 'true' : undefined}
              >
                <option value="">{t('spaces.selectVenue')}</option>
                {venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}
              </select>
              {errors.venue_id ? <p role="alert">{errors.venue_id.message}</p> : null}
              {!editTarget ? (
                <fieldset className="mb-1 grid gap-2 border-0 p-0">
                  <legend className="font-bold text-ink">{t('spaces.commonSpaces')}</legend>
                  <div className="flex flex-wrap gap-2">
                    {spaceNameTemplates.map((templateId) => {
                      const template = spaceTemplateLabels[templateId]
                      return (
                      <button
                        className="min-h-10 rounded-full border border-line bg-canvas px-3.5 py-2 text-sm font-semibold text-ink hover:border-brand/40 hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        key={templateId}
                        disabled={existingSpaceNames.has(template)}
                        aria-label={existingSpaceNames.has(template) ? t('spaces.commonSpaceExists', { name: template }) : template}
                        onClick={() => setValue('name', template, { shouldDirty: true, shouldValidate: true })}
                      >
                        {template}{existingSpaceNames.has(template) ? t('spaces.commonSpaceHas') : ''}
                      </button>
                      )
                    })}
                  </div>
                  <p className="m-0 text-xs leading-relaxed text-muted">{t('spaces.commonSpaceHint')}</p>
                </fieldset>
              ) : null}
              <label className="font-bold text-ink" htmlFor="space-name">{t('spaces.name')}</label>
              <input
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-name"
                {...register('name')}
                autoFocus
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'space-name-error' : undefined}
                readOnly={editorPending}
              />
              {errors.name ? <p id="space-name-error" role="alert">{errors.name.message}</p> : null}
              <label className="font-bold text-ink" htmlFor="space-description">{t('spaces.descriptionOptional')}</label>
              <textarea
                className="min-h-28 w-full resize-y rounded-control border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
                id="space-description"
                rows={3}
                {...register('description')}
                aria-invalid={errors.description ? 'true' : undefined}
                aria-describedby={errors.description ? 'space-description-error' : undefined}
                readOnly={editorPending}
              />
              {errors.description ? <p id="space-description-error" role="alert">{errors.description.message}</p> : null}
              {createMutation.isError || updateMutation.isError ? (
                <ResponsiveOperationError message={t('spaces.saveError')} />
              ) : null}
              {editorPending ? (
                <p className="hidden lg:block" role="status" aria-live="polite">{t('spaces.saving')}</p>
              ) : null}
              <div className="mt-3 flex justify-end gap-2.5">
                <button className="min-h-11 rounded-control border border-brand/40 bg-brand/10 px-4.5 py-2.5 font-bold text-ink" type="button" disabled={editorPending} onClick={closeEditor}>
                  {t('spaces.cancel')}
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
                  {editorPending ? t('spaces.saving') : editTarget ? t('spaces.save') : t('spaces.createButton')}
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
      {deleteMutation.isError ? <ResponsiveOperationError message={t('spaces.deleteError')} /> : null}
      {spacesQuery.isPending && spacesQuery.data === undefined ? (
        <SkeletonGroup className="grid gap-5" label={t('spaces.loading')}>
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
      {spacesQuery.isError ? <PageState state="error" message={t('spaces.loadError')} onRetry={() => void spacesQuery.refetch()} /> : null}
      {spacesQuery.data && venuesQuery.isSuccess && visibleSpaces.length === 0 ? (
        <PageState
          state="empty"
          icon="space"
          title={t('spaces.emptyTitle')}
          description={t('spaces.emptyDescription')}
          action={<button type="button" onClick={beginCreate}>{t('spaces.createFirstSpace')}</button>}
        />
      ) : null}
      {spacesQuery.data && venuesQuery.isSuccess && visibleSpaces.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-control border border-line bg-surface p-1" role="group" aria-label={t('spaces.viewLabel')}>
              <button className={`inline-flex min-h-11 items-center gap-2 rounded-control px-3.5 py-2 font-bold ${view === 'cards' ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink'}`} type="button" aria-pressed={view === 'cards'} onClick={() => selectView('cards')}>
                <AppIcon name="space" size={18} />{t('spaces.cardsView')}
              </button>
              <button className={`inline-flex min-h-11 items-center gap-2 rounded-control px-3.5 py-2 font-bold ${view === 'plan' ? 'bg-brand text-white' : 'text-muted hover:bg-canvas hover:text-ink'}`} type="button" aria-pressed={view === 'plan'} onClick={() => selectView('plan')}>
                <AppIcon name="box" size={18} />{t('spaces.planView')}
              </button>
            </div>
            {view === 'plan' ? (
              <button className={`min-h-11 rounded-control border px-4 py-2.5 font-bold disabled:cursor-not-allowed disabled:opacity-55 ${layoutEditMode ? 'border-brand bg-brand/10 text-brand-strong' : 'border-line bg-surface text-ink'}`} type="button" aria-label={layoutsQuery.isPending ? t('spaces.layoutLoading') : undefined} title={layoutsQuery.isPending ? t('spaces.layoutLoading') : undefined} aria-pressed={layoutEditMode} disabled={layoutsQuery.isPending} onClick={() => setLayoutEditMode((current) => !current)}>
                {layoutsQuery.isPending ? <Skeleton as="span" className="inline-block h-4 w-16" /> : layoutEditMode ? t('spaces.layoutDone') : t('spaces.layoutAdjust')}
              </button>
            ) : null}
          </div>
          {view === 'plan' && layoutEditMode ? <p className="text-meta text-muted" role="status">{t('spaces.layoutInstructions')}{layoutsQuery.isSuccess ? t('spaces.layoutAutoSaved') : t('spaces.layoutLocalOnly')}</p> : null}
          {view === 'plan' && layoutStorageUnavailable ? <ResponsiveOperationError message={t('spaces.layoutMigration')} /> : null}
          {view === 'plan' && layoutsQuery.isError && !layoutStorageUnavailable ? <ResponsiveOperationError message={t('spaces.layoutLoadError')} busy={layoutsQuery.isFetching} retryLabel={t('spaces.retryLayout')} onRetry={() => void layoutsQuery.refetch()} /> : null}
          {layoutMutation.isError ? (
            <ResponsiveOperationError
              message={t('spaces.layoutSaveError')}
              busy={layoutMutation.isPending}
              retryLabel={t('spaces.retryLayoutSave')}
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
        title={t('spaces.deleteTitle', { name: deleteTarget?.name ?? '' })}
        description={t('spaces.deleteDescription')}
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
