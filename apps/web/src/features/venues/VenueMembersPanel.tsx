import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { classifyFeedbackError } from '../../lib/feedback-errors'
import { VenueInviteDialog } from './VenueInviteDialog'
import {
  createVenueInvite,
  getVenueAccessSummary,
  isVenueAccessDenied,
  leaveVenue,
  listVenueInvites,
  listVenueMembers,
  removeVenueMember,
  revokedVenueQueryKeys,
  type VenueInvite,
  type VenueMember,
} from './venue-sharing.api'

export type VenueMembersPanelProps = {
  venueId: string
  invitesEnabled: boolean
  /** Renders the full-page heading and activity route link when true. */
  showHeader?: boolean
  onBusyChange?: (busy: boolean) => void
}

const affectedQueryKeys = (venueId: string) => [
  ...revokedVenueQueryKeys, ['venue-members', venueId], ['venue-invites', venueId], ['venue-access', venueId], ['venue-activity', venueId],
]

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}

function MemberAvatar({ member }: { member: VenueMember }) {
  const initial = member.display_name?.trim().charAt(0) || '?'
  return member.avatar_url
    ? <img className="size-11 rounded-full object-cover" src={member.avatar_url} alt="" referrerPolicy="no-referrer" />
    : <span className="grid size-11 place-items-center rounded-full bg-brand/10 font-bold text-brand-strong" aria-hidden="true">{initial}</span>
}

export function VenueMembersPanel({ venueId, invitesEnabled, showHeader = false, onBusyChange }: VenueMembersPanelProps) {
  const { t } = useI18n()
  const feedback = useMobileFeedback()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [invite, setInvite] = useState<VenueInvite | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const invitePendingRef = useRef(false)
  const [memberToRemove, setMemberToRemove] = useState<VenueMember | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const accessDeniedHandled = useRef(false)
  const accessQuery = useQuery({ queryKey: ['venue-access', venueId], queryFn: () => getVenueAccessSummary(venueId), retry: false, enabled: Boolean(venueId) })
  const membersQuery = useQuery({ queryKey: ['venue-members', venueId], queryFn: () => listVenueMembers(venueId), retry: false, enabled: Boolean(venueId) })
  const owner = accessQuery.data?.role === 'owner'
  const invitesQuery = useQuery({ queryKey: ['venue-invites', venueId], queryFn: () => listVenueInvites(venueId), retry: false, enabled: Boolean(venueId) && owner && invitesEnabled })
  const activeInvite = invitesQuery.data?.find((item) => item.status === 'active')

  const accessDeniedError = [accessQuery.error, membersQuery.error, invitesQuery.error].find(isVenueAccessDenied)
  const clearRevokedVenue = useCallback((error: unknown) => {
    if (!isVenueAccessDenied(error) || accessDeniedHandled.current) return false
    accessDeniedHandled.current = true
    feedback.error({
      key: `venue.access.denied:${venueId}`,
      title: t('common.operationFailed'),
      message: t('common.permissionDenied'),
    })
    for (const queryKey of affectedQueryKeys(venueId)) queryClient.removeQueries({ queryKey })
    navigate('/app', { replace: true })
    return true
  }, [feedback, navigate, queryClient, t, venueId])

  useEffect(() => {
    if (accessDeniedError) clearRevokedVenue(accessDeniedError)
  }, [accessDeniedError, clearRevokedVenue])

  async function invalidateAffected() {
    await Promise.all(affectedQueryKeys(venueId).map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  const removeMemberMutation = useMutation({
    mutationFn: (member: VenueMember) => removeVenueMember(venueId, member.user_id),
    onSuccess: async () => { setMemberToRemove(null); await invalidateAffected() },
    onError: clearRevokedVenue,
  })
  const leaveMutation = useMutation({
    mutationFn: () => leaveVenue(venueId),
    onSuccess: async () => {
      setLeaveOpen(false)
      await invalidateAffected()
      queryClient.removeQueries({ queryKey: ['venues'] })
      navigate('/app', { replace: true })
    },
    onError: clearRevokedVenue,
  })

  const busy = invitePending || removeMemberMutation.isPending || leaveMutation.isPending || Boolean(memberToRemove) || leaveOpen
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange])

  function closeInvite() {
    setInvite(null)
    void queryClient.invalidateQueries({ queryKey: ['venue-invites', venueId] })
  }

  async function createInvite() {
    if (!invitesEnabled || invitePendingRef.current) return
    invitePendingRef.current = true
    setInvitePending(true)
    try {
      setInvite(await createVenueInvite(venueId))
      await queryClient.invalidateQueries({ queryKey: ['venue-invites', venueId] })
    } catch (error) {
      if (!clearRevokedVenue(error)) {
        const classification = classifyFeedbackError(error)
        feedback.error({
          key: `venue.invite.create:${venueId}`,
          title: t(classification.titleKey),
          message: t(classification.messageKey),
          retry: classification.retryable ? () => createInvite() : undefined,
        })
      }
    } finally {
      invitePendingRef.current = false
      setInvitePending(false)
    }
  }

  if (accessQuery.isPending || membersQuery.isPending) return <PageState state="loading" label={t('venueSharing.membersLoading')} />
  if (accessQuery.isError || membersQuery.isError || (owner && invitesEnabled && invitesQuery.isError)) return <PageState state="error" message={t('venueSharing.membersLoadError')} onRetry={() => { void accessQuery.refetch(); void membersQuery.refetch(); if (owner && invitesEnabled) void invitesQuery.refetch() }} />
  if (!accessQuery.data) return null

  return (
    <section className={showHeader ? 'mx-auto grid w-full max-w-3xl gap-6' : 'grid gap-5'} aria-labelledby={showHeader ? 'venue-members-title' : undefined} aria-label={showHeader ? undefined : t('venueSharing.membersTitle')}>
      {showHeader ? <header className="flex items-center justify-between gap-4">
        <div><p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">{t('venues.sharedBadge')}</p><h1 className="m-0 text-page-title font-extrabold" id="venue-members-title">{t('venueSharing.membersTitle')}</h1></div>
        <div className="flex items-center gap-3"><Link className="min-h-11 rounded-control px-3 py-2 font-bold text-brand-strong no-underline" to={`/app/venues/${venueId}/activity`}>{t('venueActivity.link')}</Link><span className="rounded-full bg-brand/10 px-3 py-2 font-bold text-brand-strong">{t('venueSharing.memberLimit', { count: accessQuery.data.member_count, max: accessQuery.data.max_members })}</span></div>
      </header> : <div className="flex justify-end"><span className="rounded-full bg-brand/10 px-3 py-2 text-sm font-bold text-brand-strong">{t('venueSharing.memberLimit', { count: accessQuery.data.member_count, max: accessQuery.data.max_members })}</span></div>}

      <div className="grid gap-3">
        {membersQuery.data?.map((member) => (
          <article className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-soft" key={member.user_id}>
            <MemberAvatar member={member} />
            <div className="min-w-0 flex-1"><strong className="block truncate">{member.display_name || '?'}</strong><span className="text-sm text-muted">{member.role === 'owner' ? t('venueSharing.ownerRole') : t('venueSharing.memberRole')} · {t('venueSharing.joinedAt', { date: displayDate(member.joined_at) })}</span></div>
            {owner && member.role === 'member' ? <button className="min-h-11 rounded-control px-3 font-bold text-danger" type="button" aria-label={t('venueSharing.removeMember', { name: member.display_name || '?' })} onClick={() => setMemberToRemove(member)}>{t('venueSharing.removeMember', { name: member.display_name || '?' })}</button> : null}
          </article>
        ))}
      </div>

      {owner ? invitesEnabled ? <section className="grid gap-4 rounded-card border border-line bg-surface p-5" aria-labelledby="venue-invites-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-section-title font-bold" id="venue-invites-title">{activeInvite?.reusable || (activeInvite?.accepted_count ?? 0) > 0 ? t('venueSharing.inviteActive') : t('venueSharing.unusedInvites')}</h2><button className="inline-flex min-h-11 items-center gap-2 rounded-control bg-brand px-4 font-bold text-white disabled:opacity-50" type="button" disabled={invitePending} onClick={() => void createInvite()}><AppIcon name="share" />{invitePending ? t('venueSharing.creatingInvite') : t('venueSharing.createInvite')}</button></div>
        {activeInvite ? <div className="flex items-center justify-between gap-3 text-sm" key={activeInvite.invite_id}><span className="grid gap-1 text-muted"><span className="font-semibold text-ink">{activeInvite.accepted_count > 0 ? t('venueSharing.inviteActiveWithMembers', { count: activeInvite.accepted_count }) : t('venueSharing.inviteActive')}</span><span>{t('venueSharing.inviteExpiresAt', { date: displayDate(activeInvite.expires_at) })}</span></span></div> : null}
      </section> : null : <button className="justify-self-start min-h-11 rounded-control border border-danger px-4 font-bold text-danger" type="button" onClick={() => setLeaveOpen(true)}>{t('venueSharing.leaveVenue')}</button>}

      {invitesEnabled ? <VenueInviteDialog open={Boolean(invite)} invite={invite} onClose={closeInvite} /> : null}
      <ConfirmDialog open={Boolean(memberToRemove)} title={t('venueSharing.removeMemberTitle')} description={t('venueSharing.removeMemberDescription')} confirmLabel={t('venueSharing.removeMemberTitle')} busyLabel={t('venueSharing.removingMember')} busy={removeMemberMutation.isPending} onCancel={() => setMemberToRemove(null)} onConfirm={() => { if (memberToRemove) removeMemberMutation.mutate(memberToRemove) }} />
      <ConfirmDialog open={leaveOpen} title={t('venueSharing.leaveVenueTitle')} description={t('venueSharing.leaveVenueDescription')} confirmLabel={t('venueSharing.leaveVenue')} busyLabel={t('venueSharing.leavingVenue')} busy={leaveMutation.isPending} onCancel={() => setLeaveOpen(false)} onConfirm={() => leaveMutation.mutate()} />
    </section>
  )
}
