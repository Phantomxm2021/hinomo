import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { isUploadPending, uploadStageLabel } from '../media/media-ui'
import { useMediaUpload } from '../media/useMediaUpload'
import { listSpaces } from '../spaces/spaces.api'
import { createBoxSchema, type BoxFormValues } from './box.schema'
import { isBoxLimitReached } from './box-entitlements.api'
import { createBox, getBox, type CreatedBox, updateBox } from './boxes.api'

export type BoxFormProps = {
  boxId?: string
  initialSpaceId?: string
  presentation: 'page' | 'modal'
  onBusyChange?: (busy: boolean) => void
  onCompleted?: (box: CreatedBox) => void
  onLimitReached?: () => void
  onSaved?: () => void
  canChangeVisibility?: boolean
  onVenueAccessDenied?: (error: unknown) => void
}

export function BoxForm({ boxId, initialSpaceId, presentation, onBusyChange, onCompleted, onLimitReached, onSaved, canChangeVisibility = true, onVenueAccessDenied }: BoxFormProps) {
  const { locale, t } = useI18n()
  const editing = Boolean(boxId)
  const feedback = useMobileFeedback()
  const initializedBoxId = useRef<string | undefined>(undefined)
  const initializedCreateSpace = useRef(false)
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const boxQuery = useQuery({
    queryKey: ['box-edit', boxId],
    queryFn: () => getBox(boxId!),
    enabled: editing,
  })
  const [saved, setSaved] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [pendingBox, setPendingBox] = useState<CreatedBox | null>(null)
  const [mediaError, setMediaError] = useState(false)
  const mediaUpload = useMediaUpload()
  const mediaStatus = uploadStageLabel(mediaUpload.stage)
  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createBox>[0]) => createBox(input),
  })
  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof updateBox>[1]) => updateBox(boxId!, input),
  })
  const resetMediaUpload = mediaUpload.reset
  const resetCreateMutation = createMutation.reset
  const resetUpdateMutation = updateMutation.reset
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<BoxFormValues>({
    resolver: zodResolver(createBoxSchema(t)),
    defaultValues: {
      space_id: '',
      name: '',
      category: '',
      location: '',
      description: '',
      visibility: 'private',
    },
  })
  const previousLocaleRef = useRef(locale)
  useEffect(() => {
    if (previousLocaleRef.current !== locale && Object.keys(errors).length > 0) void trigger()
    previousLocaleRef.current = locale
  }, [errors, locale, trigger])
  const busy = createMutation.isPending || updateMutation.isPending || isUploadPending(mediaUpload.stage)
  const dismissalBlocked = busy || (!editing && Boolean(pendingBox))
  const advancedVisible = editing || showAdvanced

  useEffect(() => {
    onBusyChange?.(dismissalBlocked)
  }, [dismissalBlocked, onBusyChange])

  useEffect(() => {
    initializedBoxId.current = undefined
    initializedCreateSpace.current = false
    setCoverFile(null)
    setSaved(false)
    setShowAdvanced(false)
    setMediaError(false)
    setPendingBox(null)
    resetMediaUpload()
    resetCreateMutation()
    resetUpdateMutation()
  }, [boxId, resetCreateMutation, resetMediaUpload, resetUpdateMutation])

  useEffect(() => {
    if (editing || initializedCreateSpace.current || spacesQuery.data === undefined) return
    initializedCreateSpace.current = true
    if (initialSpaceId) setValue('space_id', initialSpaceId)
  }, [editing, initialSpaceId, setValue, spacesQuery.data])

  useEffect(() => {
    if (!boxId || !boxQuery.data || initializedBoxId.current === boxId) return
    reset({
      space_id: boxQuery.data.space_id,
      name: boxQuery.data.name,
      category: boxQuery.data.category ?? '',
      location: boxQuery.data.location ?? '',
      description: boxQuery.data.description ?? '',
      visibility: boxQuery.data.visibility,
    })
    initializedBoxId.current = boxId
  }, [boxId, boxQuery.data, reset])

  async function uploadCover(target: CreatedBox) {
    if (!coverFile) return
    await mediaUpload.upload({
      file: coverFile,
      boxId: target.id,
      itemId: null,
      kind: 'cover',
    })
  }

  async function retryCoverUpload() {
    if (!coverFile) return
    setMediaError(false)
    try {
      if (editing && boxId) {
        await mediaUpload.upload({ file: coverFile, boxId, itemId: null, kind: 'cover' })
        setSaved(true)
        onSaved?.()
        return
      }
      if (pendingBox) {
        await uploadCover(pendingBox)
        onCompleted?.(pendingBox)
      }
    } catch {
      setMediaError(true)
    }
  }

  function finishWithoutCover() {
    if (pendingBox) onCompleted?.(pendingBox)
  }

  useEffect(() => {
    if (!saved || onSaved) return
    feedback.notify(t('boxes.saved'))
  }, [feedback, onSaved, saved, t])

  const submit = handleSubmit(async (values) => {
    if (!editing && pendingBox) return
    let recordSaved = false
    const input = {
      space_id: values.space_id,
      name: values.name,
      category: values.category || null,
      location: values.location || null,
      description: values.description || null,
      visibility: canChangeVisibility ? values.visibility : editing ? boxQuery.data!.visibility : 'private' as const,
    }
    setMediaError(false)
    setSaved(false)
    try {
      if (editing) {
        await updateMutation.mutateAsync(input)
        recordSaved = true
        if (coverFile && boxId) {
          await mediaUpload.upload({ file: coverFile, boxId, itemId: null, kind: 'cover' })
        }
        setSaved(true)
        onSaved?.()
        return
      }
      const box = await createMutation.mutateAsync(input)
      recordSaved = true
      setPendingBox(box)
      await uploadCover(box)
      onCompleted?.(box)
    } catch (error) {
      onVenueAccessDenied?.(error)
      if (!editing && isBoxLimitReached(error)) {
        onLimitReached?.()
        return
      }
      if (recordSaved) setMediaError(true)
    }
  })

  if ((spacesQuery.isPending && spacesQuery.data === undefined)
    || (editing && boxQuery.isPending && boxQuery.data === undefined)) {
    return (
      <SkeletonGroup
        className={presentation === 'page' ? 'mx-auto grid min-w-0 w-full max-w-4xl gap-4' : 'grid min-w-0 w-full gap-4'}
        label={t('boxes.formLoading')}
      >
        {presentation === 'page' ? <Skeleton className="h-10 w-44" /> : null}
        <div className={`grid gap-4 ${presentation === 'page' ? 'rounded-shell border border-line bg-surface p-5 md:p-6' : ''}`}>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </SkeletonGroup>
    )
  }

  if (spacesQuery.isError && spacesQuery.data === undefined) {
    return <PageState state="error" message={t('spaces.loadError')} onRetry={() => void spacesQuery.refetch()} />
  }

  if (editing && ((boxQuery.isError && boxQuery.data === undefined) || !boxQuery.data)) {
    return <PageState state="error" message={t('boxes.loadError')} onRetry={() => void boxQuery.refetch()} />
  }

  return (
    <section className={presentation === 'page' ? 'mx-auto grid min-w-0 w-full max-w-4xl gap-5 lg:gap-6' : 'grid min-w-0 w-full gap-4'} data-presentation={presentation} aria-labelledby={presentation === 'page' ? 'box-form-title' : undefined}>
      {presentation === 'page' ? (
        <header className="py-3">
          <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">{t('boxes.formEyebrow')}</p>
          <h1 className="m-0 text-page-title font-extrabold text-ink" id="box-form-title">{editing ? t('boxes.edit') : t('boxes.create')}</h1>
        </header>
      ) : null}
      {spacesQuery.isError ? (
        <ResponsiveOperationError message={t('boxes.spaceRefreshError')} error={spacesQuery.error} busy={spacesQuery.isFetching} onRetry={() => void spacesQuery.refetch()} />
      ) : null}
      {editing && boxQuery.isError ? (
        <ResponsiveOperationError message={t('boxes.refreshContentError')} error={boxQuery.error} busy={boxQuery.isFetching} onRetry={() => void boxQuery.refetch()} />
      ) : null}
      <form className={`grid gap-3 [&_label]:font-bold [&_label]:text-ink ${presentation === 'page' ? 'rounded-shell border border-line bg-surface p-5 md:p-6' : ''}`} onSubmit={submit} noValidate>
        <label htmlFor="box-space">{t('spaces.title')}</label>
        <select className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="box-space" aria-invalid={Boolean(errors.space_id)} aria-describedby={errors.space_id ? 'box-space-error' : undefined} {...register('space_id')}>
          <option value="">{t('boxes.selectSpace')}</option>
          {spacesQuery.data?.map((space) => (
            <option value={space.id} key={space.id}>{space.name}</option>
          ))}
        </select>
        {errors.space_id ? <p id="box-space-error" role="alert">{errors.space_id.message}</p> : null}

        <label htmlFor="box-name">{t('boxes.name')}</label>
        <input className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="box-name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'box-name-error' : undefined} {...register('name')} />
        {errors.name ? <p id="box-name-error" role="alert">{errors.name.message}</p> : null}

        <label htmlFor="box-location">{t('boxes.location')}</label>
        <input className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="box-location" {...register('location')} />
        {!editing ? (
          <div className="grid gap-2 sm:hidden">
            <p className="m-0 text-xs leading-relaxed text-muted">{t('boxes.basicInfoHint')}</p>
            <button
              className="min-h-11 w-fit rounded-control border border-line bg-surface px-4 py-2 text-sm font-bold text-ink"
              type="button"
              aria-expanded={showAdvanced}
              aria-controls="box-advanced-fields"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              {showAdvanced ? t('boxes.hideAdvanced') : t('boxes.moreSettings')}
            </button>
          </div>
        ) : null}

        <div className={`${advancedVisible ? 'contents' : 'hidden'} sm:contents`} id="box-advanced-fields">
          <label htmlFor="box-category">{t('boxes.categoryOptional')}</label>
          <input className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="box-category" {...register('category')} />
          <label htmlFor="box-description">{t('boxes.noteOptional')}</label>
          <textarea className="min-h-28 w-full resize-y rounded-control border border-line bg-canvas px-3 py-3 text-ink focus:border-brand" id="box-description" rows={4} {...register('description')} />

          <label htmlFor="box-cover">{t('boxes.coverOptional')}</label>
          <input
            key={boxId ?? 'create'}
            className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 py-2 text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-placeholder file:px-3 file:py-2 file:font-bold file:text-ink"
            id="box-cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setCoverFile(event.target.files?.[0] ?? null)
              setMediaError(false)
              mediaUpload.reset()
            }}
          />

          {canChangeVisibility ? <>
            <label htmlFor="box-visibility">{t('boxes.visibility')}</label>
            <select className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand" id="box-visibility" {...register('visibility')}>
              <option value="private">{t('boxes.visibilityPrivate')}</option>
              <option value="public">{t('boxes.visibilityPublic')}</option>
            </select>
          </> : null}
        </div>

        {(createMutation.isError && !isBoxLimitReached(createMutation.error)) || updateMutation.isError ? (
          <ResponsiveOperationError message={t('boxes.saveError')} error={createMutation.error ?? updateMutation.error} />
        ) : null}
        {saved ? <p className="hidden lg:block" role="status">{t('boxes.saved')}</p> : null}
        {mediaStatus ? <p className="hidden lg:block" role="status">{t('boxes.mediaProcessing', { status: t(mediaStatus) })}</p> : null}
        {!editing && pendingBox ? (
          <div className="hidden gap-3 rounded-control border border-danger/30 bg-danger/5 p-4 lg:grid" role="status">
            <p>{t('boxes.coverIncomplete')}</p>
            <div className="flex flex-wrap gap-2">
              {coverFile ? (
                <button className="min-h-11 w-fit rounded-control border border-danger/30 bg-surface px-4 py-2 font-bold text-danger" type="button" disabled={busy} onClick={() => void retryCoverUpload()}>
                  {mediaError ? t('boxes.retryUpload') : t('boxes.uploadCover')}
                </button>
              ) : null}
              <button className="min-h-11 w-fit rounded-control border border-line bg-surface px-4 py-2 font-bold text-ink" type="button" disabled={busy} onClick={finishWithoutCover}>{t('boxes.skipCover')}</button>
            </div>
          </div>
        ) : mediaError ? (
          <div className="hidden gap-3 rounded-control border border-danger/30 bg-danger/5 p-4 lg:grid" role="status">
            <p>{t('boxes.coverUploadError')}</p>
            <button className="min-h-11 w-fit rounded-control border border-danger/30 bg-surface px-4 py-2 font-bold text-danger" type="button" onClick={() => void retryCoverUpload()}>{t('boxes.retryUpload')}</button>
          </div>
        ) : null}
        {mediaError ? <ResponsiveOperationError message={t('boxes.coverUploadError')} onRetry={() => void retryCoverUpload()} onCancel={pendingBox ? finishWithoutCover : undefined} cancelLabel={pendingBox ? t('boxes.skipCover') : undefined} /> : null}
        {!editing && pendingBox ? null : (
          <button
            className="mt-2 min-h-12 w-full rounded-control border border-brand bg-brand px-5 py-2 font-bold text-white hover:bg-brand-strong sm:min-h-11 sm:w-auto"
            type="submit"
            disabled={busy}
          >
            {createMutation.isPending || updateMutation.isPending
              ? t('common.processing')
              : editing
                ? t('boxes.saveChanges')
                : t('boxes.create')}
          </button>
        )}
      </form>
    </section>
  )
}
