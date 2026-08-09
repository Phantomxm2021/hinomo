import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'
import { VenueInviteQuickAction } from './VenueInviteQuickAction'
import type { VenueSummary } from './venues.api'

type VenueCardMenuProps = {
  venue: VenueSummary
  invitesEnabled: boolean
  onEdit: (venue: VenueSummary) => void
}

export function VenueCardMenu({ venue, invitesEnabled, onEdit }: VenueCardMenuProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  function closeMenu(restoreFocus: boolean) {
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true)
    }
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      closeMenu(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        className="absolute top-4 right-4 grid size-11 place-items-center rounded-control border border-line bg-canvas text-muted shadow-soft transition hover:bg-brand/10 hover:text-brand"
        type="button"
        aria-label={t('venues.manageVenue', { name: venue.name })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <AppIcon name="more" size={20} />
      </button>
      {open ? (
        <div ref={menuRef} className="absolute top-16 right-4 z-30 grid min-w-48 gap-1 rounded-control border border-line bg-surface p-1.5 shadow-float" role="menu" aria-label={t('venues.cardMenu', { name: venue.name })}>
          {venue.role === 'owner' ? (
            <>
              <button
                className="inline-flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-sm font-bold text-ink hover:bg-canvas"
                type="button"
                role="menuitem"
                onClick={() => { onEdit(venue); closeMenu(false) }}
              >
                <AppIcon name="edit" size={17} />
                {t('venues.edit')}
              </button>
              <VenueInviteQuickAction venueId={venue.id} enabled={invitesEnabled} menuItem />
            </>
          ) : null}
          <Link className="inline-flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-sm font-bold text-ink no-underline hover:bg-canvas" role="menuitem" to={`/app/venues/${venue.id}/members`} onClick={() => closeMenu(false)}>
            <AppIcon name="family" size={17} />
            {t('venues.members')}
          </Link>
          <Link className="inline-flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-sm font-bold text-ink no-underline hover:bg-canvas" role="menuitem" to={`/app/venues/${venue.id}/activity`} onClick={() => closeMenu(false)}>
            <AppIcon name="history" size={17} />
            {t('venueActivity.link')}
          </Link>
        </div>
      ) : null}
    </>
  )
}
