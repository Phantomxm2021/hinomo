import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'
import type { VenueSummary } from './venues.api'

export function VenueFilterBar({ venues, selectedId, onSelect, onCreate, onEdit }: {
  venues: VenueSummary[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onEdit: (venue: VenueSummary) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label={t('venues.filter')}>
      <div className="venue-filter-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain" role="group" aria-label={t('venues.select')}>
        <button className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${selectedId === null ? 'bg-ink text-white' : 'bg-surface text-muted shadow-[inset_0_0_0_1px_var(--color-line)]'}`} type="button" aria-pressed={selectedId === null} onClick={() => onSelect(null)}>
          {t('venues.all')}
        </button>
        {venues.map((venue) => (
          <span className={`inline-flex shrink-0 items-center rounded-full ${selectedId === venue.id ? 'bg-brand text-white' : 'bg-surface text-muted shadow-[inset_0_0_0_1px_var(--color-line)]'}`} key={venue.id}>
            <button className="min-h-11 rounded-l-full px-4 text-sm font-semibold text-inherit" type="button" aria-label={t('venues.spaceCount', { name: venue.name, count: venue.space_count })} aria-pressed={selectedId === venue.id} onClick={() => onSelect(venue.id)}>
              {venue.name}<span className="ml-1 opacity-70">{venue.space_count}</span>
            </button>
            <button className="grid size-11 place-items-center rounded-r-full text-inherit opacity-75 hover:bg-black/5 hover:opacity-100" type="button" aria-label={t('venues.rename', { name: venue.name })} title={t('venues.renameTitle', { name: venue.name })} onClick={() => onEdit(venue)}>
              <AppIcon name="edit" size={16} />
            </button>
          </span>
        ))}
      </div>
      <button className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/12 text-brand hover:bg-brand/20" type="button" aria-label={t('venues.create')} title={t('venues.create')} onClick={onCreate}>
        <AppIcon name="plus" size={19} />
      </button>
    </div>
  )
}
