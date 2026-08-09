import { useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'
import { createVenueInvite } from './venue-sharing.api'
import { VenueInviteDialog } from './VenueInviteDialog'

type VenueInviteQuickActionProps = {
  venueId: string
  enabled: boolean
  menuItem?: boolean
}

export function VenueInviteQuickAction({ venueId, enabled, menuItem = false }: VenueInviteQuickActionProps) {
  const { t } = useI18n()
  const [invite, setInvite] = useState<{ invite_id: string; token: string; expires_at: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  async function openInvite() {
    if (!enabled || pending) return
    setPending(true)
    setError(false)
    try {
      setInvite(await createVenueInvite(venueId))
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-1">
      <button
        className="inline-flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-sm font-bold text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        role={menuItem ? 'menuitem' : undefined}
        disabled={!enabled || pending}
        title={!enabled ? t('venues.inviteDisabled') : undefined}
        onClick={() => void openInvite()}
      >
        <AppIcon name="share" size={17} />
        {pending ? t('venueSharing.creatingInvite') : t('venues.inviteFamily')}
      </button>
      {!enabled ? <span className="px-1 text-xs text-muted">{t('venues.inviteDisabled')}</span> : null}
      {error ? <p className="m-0 px-1 text-xs text-danger" role="alert">{t('venueSharing.actionError')}</p> : null}
      <VenueInviteDialog open={Boolean(invite)} invite={invite} onClose={() => setInvite(null)} />
    </div>
  )
}
