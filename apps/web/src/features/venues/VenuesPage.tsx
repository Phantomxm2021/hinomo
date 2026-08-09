import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useI18n } from '../../i18n/I18nProvider'
import { VenueEditorDialog } from './VenueEditorDialog'
import {
  createVenue,
  deleteVenue,
  isVenuesSchemaUnavailable,
  listVenues,
  type VenueInput,
  type VenueSummary,
  updateVenue,
} from './venues.api'

export function VenuesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<VenueSummary | null>(null)
  const venuesQuery = useQuery({ queryKey: ['venues'], queryFn: listVenues })
  const createMutation = useMutation({
    mutationFn: (input: VenueInput) => createVenue(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: VenueInput }) => updateVenue(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: (venueId: string) => deleteVenue(venueId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venues'] }),
  })
  const pending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function closeEditor() {
    if (pending) return
    setEditorOpen(false)
    setEditTarget(null)
  }

  function openCreate() {
    setEditTarget(null)
    setEditorOpen(true)
  }

  async function saveVenue(input: VenueInput) {
    if (editTarget) await updateMutation.mutateAsync({ id: editTarget.id, input })
    else await createMutation.mutateAsync(input)
    setEditorOpen(false)
    setEditTarget(null)
  }

  async function removeVenue(venue: VenueSummary) {
    if (venue.space_count > 0 || venue.is_default) return
    await deleteMutation.mutateAsync(venue.id)
    setEditorOpen(false)
    setEditTarget(null)
  }

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-5xl gap-6 lg:gap-8" aria-labelledby="venues-title">
      <nav className="mobile-detail-nav sticky top-0 z-20 -mx-4 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label={t('venues.nav')}>
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('common.back')} onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">{t('venues.title')}</span>
        <div className="flex justify-end">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('venues.create')} onClick={openCreate}>
            <AppIcon name="plus" size={24} />
          </button>
        </div>
      </nav>

      <header className="hidden py-3 lg:block">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">{t('venues.eyebrow')}</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="mb-0 text-page-title font-extrabold" id="venues-title">{t('venues.title')}</h1>
          <button
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-brand bg-brand text-white transition hover:bg-brand-strong"
            type="button"
            aria-label={t('venues.create')}
            title={t('venues.create')}
            onClick={openCreate}
          >
            <AppIcon name="plus" />
          </button>
        </div>
        {venuesQuery.data ? <p className="mt-2 text-sm text-muted">{t('venues.count', { count: venuesQuery.data.length })}</p> : null}
      </header>

      {venuesQuery.isPending && venuesQuery.data === undefined ? (
        <SkeletonGroup className="grid gap-3" label={t('venues.loading')}>
          {Array.from({ length: 3 }, (_, index) => (
            <div className="grid min-h-32 grid-cols-[1fr_auto] items-center gap-4 rounded-card border border-line bg-surface p-5" key={index}>
              <div className="grid gap-3"><Skeleton className="h-7 w-32" /><Skeleton className="h-4 w-48" /></div>
              <Skeleton className="size-8 rounded-full" />
            </div>
          ))}
        </SkeletonGroup>
      ) : null}

      {venuesQuery.isError ? (
        <PageState
          state="error"
          message={isVenuesSchemaUnavailable(venuesQuery.error) ? t('venues.schemaUnavailable') : t('venues.loadError')}
          onRetry={() => void venuesQuery.refetch()}
        />
      ) : null}

      {venuesQuery.isSuccess && venuesQuery.data.length === 0 ? (
        <PageState state="empty" icon="home" title={t('venues.emptyTitle')} action={<button className="min-h-11 rounded-control bg-brand px-5 font-bold text-white" type="button" onClick={openCreate}>{t('venues.createFirst')}</button>} />
      ) : null}

      {venuesQuery.data ? (
        <div className="grid gap-3">
          {venuesQuery.data.map((venue) => {
            const details = <>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <strong className="truncate text-xl tracking-[-0.03em] text-ink sm:text-2xl">{venue.name}</strong>
                  {venue.is_default ? <span className="rounded-full bg-brand/10 px-2 py-1 text-[0.65rem] font-bold text-brand-strong">{t('venues.default')}</span> : null}
                  {venue.role === 'member' ? <span className="rounded-full bg-brand/10 px-2 py-1 text-[0.65rem] font-bold text-brand-strong">{t('venues.sharedBadge')}</span> : null}
                </span>
                <span className="mt-2 block text-sm text-muted">{t('venues.spaces', { count: venue.space_count })}{venue.description ? ` · ${venue.description}` : ` · ${t('venues.descriptionUnset')}`}{venue.role === 'member' ? ` · ${t('venues.sharedWith', { owner: venue.owner_display_name ?? t('venueSharing.ownerFallback') })}` : ''}</span>
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-canvas text-muted transition group-hover:bg-brand/10 group-hover:text-brand"><AppIcon name="chevron-right" size={20} /></span>
            </>
            return venue.role === 'member' ? (
              <div className="grid gap-2" key={venue.id}>
                <Link className="group grid min-h-32 w-full grid-cols-[1fr_auto] items-center gap-4 rounded-[1.35rem] border border-line bg-surface p-5 text-left no-underline shadow-soft transition hover:-translate-y-0.5 hover:border-brand/35 sm:p-6" aria-label={t('venues.membersVenue', { name: venue.name })} to={`/app/venues/${venue.id}/members`}>{details}</Link>
                <Link className="inline-flex min-h-11 items-center gap-2 justify-self-start px-3 font-bold text-brand-strong no-underline" aria-label={t('venues.activityVenue', { name: venue.name })} to={`/app/venues/${venue.id}/activity`}>{t('venueActivity.link')}</Link>
              </div>
            ) : (
              <div className="grid gap-2" key={venue.id}>
                <button className="group grid min-h-32 w-full grid-cols-[1fr_auto] items-center gap-4 rounded-[1.35rem] border border-line bg-surface p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-brand/35 sm:p-6" type="button" aria-label={t('venues.editVenue', { name: venue.name })} onClick={() => { setEditTarget(venue); setEditorOpen(true) }}>{details}</button>
                <div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center gap-2 justify-self-start px-3 font-bold text-brand-strong no-underline" aria-label={t('venues.membersVenue', { name: venue.name })} to={`/app/venues/${venue.id}/members`}><AppIcon name="family" />{t('venues.members')}</Link><Link className="inline-flex min-h-11 items-center gap-2 justify-self-start px-3 font-bold text-brand-strong no-underline" aria-label={t('venues.activityVenue', { name: venue.name })} to={`/app/venues/${venue.id}/activity`}>{t('venueActivity.link')}</Link></div>
              </div>
            )
          })}
        </div>
      ) : null}

      <VenueEditorDialog
        open={editorOpen}
        venue={editTarget}
        pending={pending}
        error={createMutation.isError || updateMutation.isError || deleteMutation.isError}
        onClose={closeEditor}
        onSubmit={saveVenue}
        onDelete={removeVenue}
      />
    </section>
  )
}
