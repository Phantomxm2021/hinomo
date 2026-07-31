import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { AuthorizedImage } from '../media/AuthorizedImage'
import type { BoxSummary } from './boxes.api'
import { BoxCardMenu } from './BoxCardMenu'

type BoxCatalogueCardProps = {
  box: BoxSummary
  menuOpen: boolean
  onMenuToggle: () => void
  onMenuClose: () => void
  onDelete: (box: BoxSummary) => void
}

export function BoxCatalogueCard({ box, menuOpen, onMenuToggle, onMenuClose, onDelete }: BoxCatalogueCardProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const visibilityLabel = box.visibility === 'public' ? '公开' : '私有'
  const closeMenu = (restoreFocus: boolean) => {
    onMenuClose()
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-soft" aria-label={box.name}>
      <div className="relative aspect-[16/10] overflow-hidden bg-placeholder">
        {box.cover_object_key ? (
          <AuthorizedImage objectKey={box.cover_object_key} alt={`${box.name}封面`} className="block h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-content-center text-brand" role="img" aria-label="箱子封面占位图">
            <span className="grid size-14 place-items-center rounded-card border border-brand/25 bg-surface/70">
              <AppIcon name="box" size={30} />
            </span>
          </div>
        )}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-surface/85 px-2.5 py-1 text-xs font-bold text-ink shadow-soft">
          <AppIcon name={box.visibility === 'public' ? 'globe' : 'lock'} size={14} />
          {visibilityLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="truncate text-card-title font-bold text-ink">{box.name}</h2>
        <p className="truncate text-sm text-muted">{box.space_name} · {box.location || '未填写位置'}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm">
          <span className="font-bold text-ink">{box.item_count} 件物品</span>
          <span className="font-mono text-xs font-extrabold text-brand">{box.box_code}</span>
        </div>
      </div>

      <Link className="absolute inset-0 z-10 focus-visible:outline-offset-[-3px]" to={`/b/${box.public_id}`} aria-label={`打开${box.name}`} />
      <button
        ref={triggerRef}
        className="absolute top-3 right-3 z-20 grid size-11 place-items-center rounded-control border border-line bg-surface/90 text-ink shadow-soft hover:bg-surface"
        type="button"
        aria-label={`管理${box.name}`}
        aria-expanded={menuOpen}
        onClick={onMenuToggle}
      >
        <AppIcon name="more" size={20} />
      </button>
      <BoxCardMenu box={box} open={menuOpen} triggerRef={triggerRef} onClose={closeMenu} onDelete={onDelete} />
    </article>
  )
}
