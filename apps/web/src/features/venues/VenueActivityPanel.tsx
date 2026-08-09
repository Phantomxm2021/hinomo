import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageState } from '../../components/PageState'
import { useI18n } from '../../i18n/I18nProvider'
import { isVenueAccessDenied, listVenueMembers, revokedVenueQueryKeys } from './venue-sharing.api'
import {
  activityMessage,
  listVenueActivity,
  type VenueActivityCursor,
  type VenueActivityEntry,
  type VenueActivityEvent,
} from './venue-activity.api'

const eventCodes: VenueActivityEvent[] = ['item_created', 'item_moved', 'item_quantity_changed', 'item_deleted', 'box_moved']

function displayDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function cursorFor(entries: VenueActivityEntry[]): VenueActivityCursor | undefined {
  const last = entries.at(-1)
  return last ? { createdAt: last.created_at, id: last.id } : undefined
}

type VenueActivityPanelProps = {
  venueId: string
  onBusyChange?: (busy: boolean) => void
}

export function VenueActivityPanel({ venueId, onBusyChange }: VenueActivityPanelProps) {
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actorId, setActorId] = useState<string | null>(null)
  const [eventCode, setEventCode] = useState<VenueActivityEvent | null>(null)
  const accessDeniedHandled = useRef(false)
  const membersQuery = useQuery({ queryKey: ['venue-members', venueId], queryFn: () => listVenueMembers(venueId), enabled: Boolean(venueId), retry: false })
  const activityQuery = useInfiniteQuery({
    queryKey: ['venue-activity', venueId, actorId, eventCode],
    queryFn: ({ pageParam }) => listVenueActivity({ venueId, actorId, eventCode, cursor: pageParam }),
    initialPageParam: null as VenueActivityCursor | null,
    getNextPageParam: (lastPage) => lastPage.length === 50 ? cursorFor(lastPage) : undefined,
    enabled: Boolean(venueId),
    retry: false,
  })

  const busy = activityQuery.isPending || activityQuery.isFetching || membersQuery.isPending || membersQuery.isFetching
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

  const accessDenied = isVenueAccessDenied(activityQuery.error) || isVenueAccessDenied(membersQuery.error)
  useEffect(() => {
    if (!accessDenied || accessDeniedHandled.current) return
    accessDeniedHandled.current = true
    for (const queryKey of revokedVenueQueryKeys) queryClient.removeQueries({ queryKey })
    queryClient.removeQueries({ queryKey: ['venue-members', venueId] })
    queryClient.removeQueries({ queryKey: ['venue-activity', venueId] })
    navigate('/app', { replace: true })
  }, [accessDenied, navigate, queryClient, venueId])

  const entries = useMemo(() => {
    const unique = new Map<string, VenueActivityEntry>()
    for (const page of activityQuery.data?.pages ?? []) {
      for (const entry of page) if (!unique.has(entry.id)) unique.set(entry.id, entry)
    }
    return [...unique.values()]
  }, [activityQuery.data])

  if (activityQuery.isPending && !activityQuery.data) return <PageState state="loading" label={t('venueActivity.loading')} />
  if (activityQuery.isError) return <PageState state="error" message={t('venueActivity.loadError')} onRetry={() => void activityQuery.refetch()} />
  if (membersQuery.isError) return <PageState state="error" message={t('venueActivity.membersLoadError')} onRetry={() => void membersQuery.refetch()} />

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6" aria-labelledby="venue-activity-title">
      <header className="grid gap-4 sm:flex sm:items-end sm:justify-between">
        <div><p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">{t('venues.sharedBadge')}</p><h1 className="m-0 text-page-title font-extrabold" id="venue-activity-title">{t('venueActivity.title')}</h1></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium" htmlFor="activity-member-filter">{t('venueActivity.memberFilter')}<select className="min-h-11 rounded-control border border-line bg-surface px-3" id="activity-member-filter" value={actorId ?? ''} onChange={(event) => setActorId(event.target.value || null)} disabled={membersQuery.isPending}><option value="">{t('venueActivity.allMembers')}</option>{membersQuery.data?.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || t('venueActivity.unknownActor')}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium" htmlFor="activity-event-filter">{t('venueActivity.eventFilter')}<select className="min-h-11 rounded-control border border-line bg-surface px-3" id="activity-event-filter" value={eventCode ?? ''} onChange={(event) => setEventCode(event.target.value ? event.target.value as VenueActivityEvent : null)}><option value="">{t('venueActivity.allEvents')}</option>{eventCodes.map((event) => <option key={event} value={event}>{t(`venueActivity.eventLabels.${event}`)}</option>)}</select></label>
        </div>
      </header>

      {entries.length === 0 ? <PageState state="empty" title={t('venueActivity.empty')} /> : <div className="grid gap-3">
        {entries.map((entry) => <article className="grid gap-2 rounded-card border border-line bg-surface p-4 shadow-soft" key={entry.id}>
          <div className="flex flex-wrap items-center gap-2"><strong>{entry.actor_display_name?.trim() || t('venueActivity.unknownActor')}</strong>{!entry.actor_is_current ? <span className="rounded-full bg-placeholder px-2 py-1 text-xs font-bold text-muted">{t('venueActivity.departed')}</span> : null}<time className="ml-auto text-sm text-muted" dateTime={entry.created_at}>{displayDate(entry.created_at, locale)}</time></div>
          <p className="m-0 text-sm text-muted">{activityMessage(entry, t)}</p>
        </article>)}
      </div>}

      {activityQuery.hasNextPage ? <button className="justify-self-center min-h-11 rounded-control border border-line bg-surface px-4 font-bold disabled:opacity-50" type="button" disabled={activityQuery.isFetchingNextPage} onClick={() => void activityQuery.fetchNextPage()}>{activityQuery.isFetchingNextPage ? t('venueActivity.loadingMore') : t('venueActivity.loadMore')}</button> : null}
      {activityQuery.isFetching && !activityQuery.isFetchingNextPage && entries.length > 0 ? <p className="m-0 text-center text-sm text-muted">{t('venueActivity.refreshing')}</p> : null}
    </section>
  )
}
