import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider'
import { useAuth } from '../auth/auth-context'
import { acceptVenueInvite, inspectVenueInvite, isVenueInviteError, type VenueInvitePreview } from './venue-sharing.api'
import { clearInviteToken, readInviteToken } from './venue-invite-session'

type LoadState =
  | { kind: 'missing-token' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'preview'; preview: VenueInvitePreview }

function errorStatus(error: unknown) {
  if (!isVenueInviteError(error)) return null
  const statuses: Record<string, string> = {
    venue_invite_expired: 'expired',
    venue_invite_used: 'used',
    venue_invite_revoked: 'revoked',
    venue_member_limit_reached: 'full',
    venue_invite_missing: 'missing',
    venue_owner_cannot_join: 'owner',
  }
  return statuses[error.code] ?? null
}

function stateMessage(t: ReturnType<typeof useI18n>['t'], preview: VenueInvitePreview) {
  if (preview.current_user_state === 'owner') return t('venueSharing.owner')
  if (preview.current_user_state === 'member') return t('venueSharing.alreadyMember')
  const statusKey: Record<string, 'expired' | 'used' | 'revoked' | 'full' | 'missing'> = {
    expired: 'expired', used: 'used', revoked: 'revoked', full: 'full', missing: 'missing',
  }
  return statusKey[preview.status] ? t(`venueSharing.${statusKey[preview.status]}`) : null
}

export function JoinVenuePage() {
  const { locale, t } = useI18n()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [token] = useState(readInviteToken)
  const [loadState, setLoadState] = useState<LoadState>(() => token ? { kind: 'loading' } : { kind: 'missing-token' })
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true
    setLoadState({ kind: 'loading' })
    void inspectVenueInvite(token)
      .then((preview) => { if (active) setLoadState({ kind: 'preview', preview }) })
      .catch(() => { if (active) setLoadState({ kind: 'error' }) })
    return () => { active = false }
  }, [session?.access_token, token])

  async function accept() {
    if (!token || loadState.kind !== 'preview' || loadState.preview.status !== 'active' || !session || accepting) return
    setAccepting(true)
    try {
      const result = await acceptVenueInvite(token)
      if (result.result === 'joined' || result.result === 'already_member') {
        clearInviteToken()
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['venues'] }),
          queryClient.invalidateQueries({ queryKey: ['venue-access'] }),
        ])
        navigate('/app', { replace: true })
        return
      }
      setLoadState({ kind: 'error' })
    } catch (error) {
      const status = errorStatus(error)
      if (status && loadState.kind === 'preview') setLoadState({ kind: 'preview', preview: { ...loadState.preview, status } })
      else setLoadState({ kind: 'error' })
    } finally {
      setAccepting(false)
    }
  }

  if (loadState.kind === 'missing-token') return <InviteState title={t('venueSharing.missingToken')} />
  if (loadState.kind === 'loading') return <InviteState title={t('venueSharing.loading')} busy />
  if (loadState.kind === 'error') return <InviteState title={t('venueSharing.loadError')} retry={() => window.location.reload()} />

  const { preview } = loadState
  const message = stateMessage(t, preview)
  if (message) return <InviteState title={message} />

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-xl content-center gap-6 px-5 py-10 text-body" lang={locale}>
      <section className="rounded-shell border border-line bg-surface p-6 shadow-soft sm:p-8" aria-labelledby="join-venue-title">
        <p className="m-0 text-sm font-bold tracking-eyebrow text-brand uppercase">{t('venueSharing.invitation')}</p>
        <h1 className="mt-2 text-page-title font-extrabold" id="join-venue-title">{t('venueSharing.joinTitle', { name: preview.venue_name ?? t('venueSharing.venueFallback') })}</h1>
        <p className="mt-3 leading-7 text-muted">{t('venueSharing.accessSummary', { owner: preview.owner_display_name ?? t('venueSharing.ownerFallback') })}</p>
        {!session ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="min-h-11 rounded-control bg-brand px-5 py-3 font-bold text-white no-underline" to="/login" state={{ returnTo: '/join/venue' }}>{t('venueSharing.signIn')}</Link>
            <Link className="min-h-11 rounded-control border border-line px-5 py-3 font-bold text-ink no-underline" to="/register" state={{ returnTo: '/join/venue' }}>{t('venueSharing.register')}</Link>
          </div>
        ) : (
          <button className="mt-6 min-h-11 rounded-control bg-brand px-5 font-bold text-white disabled:opacity-50" type="button" disabled={accepting} onClick={() => void accept()}>{accepting ? t('venueSharing.accepting') : t('venueSharing.accept')}</button>
        )}
      </section>
    </main>
  )
}

function InviteState({ title, busy = false, retry }: { title: string; busy?: boolean; retry?: () => void }) {
  const { locale, t } = useI18n()
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-xl content-center px-5 py-10 text-body" lang={locale}>
      <section className="grid min-h-44 place-content-center justify-items-center gap-3 rounded-card border border-line bg-surface px-6 py-10 text-center" aria-busy={busy}>
        <h1 className="m-0 text-card-title font-semibold text-ink">{title}</h1>
        {retry ? <button className="min-h-11 rounded-control bg-brand px-5 font-bold text-white" type="button" onClick={retry}>{t('common.retry')}</button> : null}
      </section>
    </main>
  )
}
