import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { classifyFeedbackError } from '../../lib/feedback-errors'
import { isVenueAccessDenied } from './venue-sharing.api'
import { VenueInviteDialog } from './VenueInviteDialog'
import { createVenueInvite, type VenueInvite } from './venue-sharing.api'
import { useQueryClient } from '@tanstack/react-query'
import type { VenueSummary } from './venues.api'

type VenueCardMenuProps = {
  venue: VenueSummary
  invitesEnabled: boolean
  onEdit: (venue: VenueSummary) => void
  onVenueAccessDenied: (error: unknown) => void
}

export function VenueCardMenu({ venue, invitesEnabled, onEdit, onVenueAccessDenied }: VenueCardMenuProps) {
  const { t } = useI18n()
  const feedback = useMobileFeedback()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [invite, setInvite] = useState<VenueInvite | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const invitePendingRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  function closeMenu(restoreFocus: boolean) {
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  async function openInvite() {
    if (!invitesEnabled || invitePendingRef.current) return
    invitePendingRef.current = true
    setInvitePending(true)
    try {
      setInvite(await createVenueInvite(venue.id))
      await queryClient.invalidateQueries({ queryKey: ['venue-invites', venue.id] })
      closeMenu(false)
    } catch (error) {
      if (isVenueAccessDenied(error)) {
        onVenueAccessDenied(error)
        return
      }
      const classification = classifyFeedbackError(error)
      feedback.error({
        key: `venue.invite.create:${venue.id}`,
        title: t(classification.titleKey),
        message: t(classification.messageKey),
        retry: classification.retryable ? () => openInvite() : undefined,
      })
    } finally {
      invitePendingRef.current = false
      setInvitePending(false)
    }
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
    <div className="relative shrink-0 self-center" data-testid="venue-card-menu">
      <button
        ref={triggerRef}
        className="grid size-11 place-items-center rounded-full bg-transparent p-0 text-muted transition hover:text-ink"
        type="button"
        aria-label={t('venues.manageVenue', { name: venue.name })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <AppIcon name="more" size={20} />
      </button>
      {open ? (
        <div ref={menuRef} className="absolute top-[calc(100%+0.5rem)] right-0 z-40 grid min-w-52 gap-0.5 rounded-[1.05rem] border border-line/60 bg-surface/95 p-1.5 shadow-[0_18px_50px_rgb(64_45_32_/_18%)] backdrop-blur-xl" role="menu" aria-label={t('venues.cardMenu', { name: venue.name })}>
          {venue.role === 'owner' ? (
            <>
              <button
                className="inline-flex min-h-12 w-full items-center gap-3 rounded-[0.75rem] px-3 text-left text-[0.9375rem] font-medium text-ink hover:bg-canvas"
                type="button"
                role="menuitem"
                onClick={() => { onEdit(venue); closeMenu(false) }}
              >
                <AppIcon name="edit" size={17} />
                {t('venues.edit')}
              </button>
              <button
                className="inline-flex min-h-12 w-full items-center gap-3 rounded-[0.75rem] px-3 text-left text-[0.9375rem] font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                role="menuitem"
                disabled={!invitesEnabled || invitePending}
                title={!invitesEnabled ? t('venues.inviteDisabled') : undefined}
                onClick={() => void openInvite()}
              >
                <AppIcon name="share" size={17} />
                {invitePending ? t('venueSharing.creatingInvite') : t('venues.inviteFamily')}
              </button>
              {!invitesEnabled ? <span className="px-3 pb-1 text-xs text-muted">{t('venues.inviteDisabled')}</span> : null}
              <div className="my-1 border-t border-line/60" aria-hidden="true" />
            </>
          ) : null}
          <Link className="inline-flex min-h-12 items-center gap-3 rounded-[0.75rem] px-3 text-left text-[0.9375rem] font-medium text-ink no-underline hover:bg-canvas" role="menuitem" to={`/app/venues/${venue.id}/members`} onClick={() => closeMenu(false)}>
            <AppIcon name="family" size={17} />
            {t('venues.members')}
          </Link>
          <Link className="inline-flex min-h-12 items-center gap-3 rounded-[0.75rem] px-3 text-left text-[0.9375rem] font-medium text-ink no-underline hover:bg-canvas" role="menuitem" to={`/app/venues/${venue.id}/activity`} onClick={() => closeMenu(false)}>
            <AppIcon name="history" size={17} />
            {t('venueActivity.link')}
          </Link>
        </div>
      ) : null}
      <VenueInviteDialog open={Boolean(invite)} invite={invite} onClose={() => setInvite(null)} />
    </div>
  )
}
