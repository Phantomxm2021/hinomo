import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import type { SpaceSummary } from './spaces.api'
import { spaceEmoji, spaceTone } from './space-visuals'

export function SpaceCard({
  space,
  index,
  onEdit,
  onDelete,
}: {
  space: SpaceSummary
  index: number
  onEdit: () => void
  onDelete: (trigger: HTMLButtonElement) => void
}) {
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
      <Link className="min-w-0 flex-1 text-muted no-underline" to={`/app/boxes?space=${encodeURIComponent(space.id)}`}>
        <span className={`flex min-h-28 items-start justify-between p-5 ${spaceTone(index)}`}>
          <span className="text-4xl leading-none" role="img" aria-label={`${space.name}图标`}>{spaceEmoji(space.name)}</span>
          <span className="rounded-full bg-surface/75 px-3 py-1 text-meta font-bold text-ink">{space.box_count} 个箱子</span>
        </span>
        <span className="block p-5">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-brand">{space.venue_name}</span>
          <h2 className="mb-1 text-card-title font-bold">{space.name}</h2>
          <p className="min-h-6 truncate text-meta text-muted">{space.description || '未填写空间说明'}</p>
          <strong className="mt-4 block text-body font-bold text-ink">{space.item_count} 件物品</strong>
        </span>
      </Link>
      <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2.5">
        <button className="grid size-11 place-items-center rounded-control text-muted hover:bg-canvas hover:text-ink" type="button" aria-label={`编辑${space.name}`} onClick={onEdit}><AppIcon name="edit" size={19} /></button>
        <button className="grid size-11 place-items-center rounded-control text-muted hover:bg-danger/5 hover:text-danger" type="button" aria-label={`删除${space.name}`} onClick={(event) => onDelete(event.currentTarget)}><AppIcon name="trash" size={19} /></button>
      </div>
    </article>
  )
}
