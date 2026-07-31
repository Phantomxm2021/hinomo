import { AppIcon } from '../../components/AppIcon'
import type { VenueSummary } from './venues.api'

export function VenueFilterBar({ venues, selectedId, onSelect, onCreate, onEdit }: {
  venues: VenueSummary[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCreate: () => void
  onEdit: (venue: VenueSummary) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="场地筛选">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" role="group" aria-label="选择场地">
        <button className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${selectedId === null ? 'bg-ink text-white' : 'border border-line bg-surface text-muted'}`} type="button" aria-pressed={selectedId === null} onClick={() => onSelect(null)}>
          全部
        </button>
        {venues.map((venue) => (
          <span className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface" key={venue.id}>
            <button className={`min-h-11 px-4 text-sm font-bold ${venue.is_default ? 'rounded-full' : 'rounded-l-full'} ${selectedId === venue.id ? 'bg-brand text-white' : 'text-muted'}`} type="button" aria-label={`${venue.name}，${venue.space_count} 个空间`} aria-pressed={selectedId === venue.id} onClick={() => onSelect(venue.id)}>
              {venue.name}<span className="ml-1 opacity-70">{venue.space_count}</span>
            </button>
            {!venue.is_default ? (
              <button className="grid size-11 place-items-center rounded-r-full text-muted hover:bg-canvas hover:text-ink" type="button" aria-label={`编辑场地${venue.name}`} onClick={() => onEdit(venue)}>
                <AppIcon name="edit" size={16} />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      <button className="grid size-11 shrink-0 place-items-center rounded-control border border-line bg-surface text-brand hover:bg-brand/10" type="button" aria-label="创建场地" title="创建场地" onClick={onCreate}>
        <AppIcon name="plus" size={19} />
      </button>
    </div>
  )
}
