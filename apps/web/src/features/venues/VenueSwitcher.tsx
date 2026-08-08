import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'
import type { VenueSummary } from './venues.api'

export function VenueSwitcher({ venues, selectedId, onSelect }: {
  venues: VenueSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const selectedVenue = venues.find((venue) => venue.id === selectedId) ?? venues[0] ?? null

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span className="relative flex w-fit justify-self-end" ref={rootRef}>
      <button
        ref={triggerRef}
        className="inline-flex h-11 max-w-48 items-center justify-end gap-2 rounded-control border border-transparent bg-transparent pr-0 pl-3 text-right text-meta font-semibold tracking-eyebrow text-muted transition hover:border-line hover:bg-surface focus-visible:border-brand lg:min-w-36"
        type="button"
        aria-label={t('venues.selectNamed', { name: selectedVenue?.name ?? t('venues.noVenue') })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selectedVenue?.name ?? t('venues.noVenue')}</span>
        <span className={`grid size-5 shrink-0 place-items-center transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} aria-hidden="true">
          <AppIcon name="chevron-right" size={18} />
        </span>
      </button>

      {open ? (
        <span className="absolute top-[calc(100%+0.5rem)] right-0 z-40 block w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[1.25rem] border border-line/75 bg-ink/94 p-2 text-white shadow-[0_22px_60px_rgb(48_39_30_/_30%)] backdrop-blur-xl" role="menu" aria-label={t('venues.select')}>
          <span className="venue-switcher-options block max-h-[min(18rem,calc(100dvh-11rem))] overflow-y-auto overscroll-contain py-1">
            {venues.map((venue) => {
              const selected = venue.id === selectedVenue?.id
              return (
                <button
                  className={`flex min-h-12 w-full items-center gap-3 rounded-[0.9rem] px-3 text-left font-semibold transition ${selected ? 'bg-brand text-white' : 'text-white/82 hover:bg-white/9 hover:text-white'}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-label={t('venues.spaceCount', { name: venue.name, count: venue.space_count })}
                  key={venue.id}
                  onClick={() => {
                    onSelect(venue.id)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                >
                  <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">{selected ? '✓' : ''}</span>
                  <span className="min-w-0 flex-1 truncate">{venue.name}</span>
                  <span className="text-xs font-medium text-white/45">{venue.space_count}</span>
                </button>
              )
            })}
          </span>
          <span className="my-2 block h-px bg-white/12" aria-hidden="true" />
          <Link
            className="flex min-h-13 items-center gap-3 rounded-[0.9rem] px-3 font-bold text-white no-underline transition hover:bg-white/9"
            role="menuitem"
            to="/app/venues"
            onClick={() => setOpen(false)}
          >
            <span className="grid size-8 place-items-center rounded-full bg-white/10 text-white/80"><AppIcon name="settings" size={18} /></span>
            <span className="flex-1">{t('venues.manage')}</span>
            <AppIcon name="chevron-right" size={17} className="text-white/45" />
          </Link>
        </span>
      ) : null}
    </span>
  )
}
