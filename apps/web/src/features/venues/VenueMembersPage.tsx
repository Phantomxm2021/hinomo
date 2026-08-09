import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { useI18n } from '../../i18n/I18nProvider'
import { VenueInviteDialog } from './VenueInviteDialog'
import {
  createVenueInvite,
  getVenueAccessSummary,
  isVenueInviteError,
  leaveVenue,
  listVenueInvites,
  listVenueMembers,
  removeVenueMember,
  revokeVenueInvite,
  type VenueMember,
} from './venue-sharing.api'

const affectedQueryKeys = (venueId: string) => [
  ['venues'], ['venue-members', venueId], ['venue-access', venueId], ['venue-activity', venueId], ['spaces'], ['boxes'], ['items'], ['search-items'],
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

export function VenueMembersPage() {
  const { venueId = '' } = useParams<{ venueId: string }>()
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [invite, setInvite] = useState<{ invite_id: string; token: string; expires_at: string } | null>(null)
  const [invitePending, setInvitePending] = useState(false)
  const [inviteError, setInviteError] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<VenueMember | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const accessDeniedHandled = useRef(false)
  const accessQuery = useQuery({ queryKey: ['venue-access', venueId], queryFn: () => getVenueAccessSummary(venueId), retry: false, enabled: Boolean(venueId) })
  const membersQuery = useQuery({ queryKey: ['venue-members', venueId], queryFn: () => listVenueMembers(venueId), retry: false, enabled: Boolean(venueId) })
  const owner = accessQuery.data?.role === 'owner'
  const invitesQuery = useQuery({ queryKey: ['venue-invites', venueId], queryFn: () => listVenueInvites(venueId), retry: false, enabled: Boolean(venueId) && owner })

  const accessDenied = [accessQuery.error, membersQuery.error, invitesQuery.error].some((error) => isVenueInviteError(error, 'venue_access_denied'))

  useEffect(() => {
    if (!accessDenied || accessDeniedHandled.current) return
    accessDeniedHandled.current = true
    for (const queryKey of affectedQueryKeys(venueId)) queryClient.removeQueries({ queryKey })
    queryClient.removeQueries({ queryKey: ['venue-invites', venueId] })
    navigate('/app', { replace: true })
  }, [accessDenied, navigate, queryClient, venueId])

  async function invalidateAffected() {
    await Promise.all(affectedQueryKeys(venueId).map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: string) => revokeVenueInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['venue-invites', venueId] }),
  })
  const removeMemberMutation = useMutation({
    mutationFn: (member: VenueMember) => removeVenueMember(venueId, member.user_id),
    onSuccess: async () => { setMemberToRemove(null); await invalidateAffected() },
  })
  const leaveMutation = useMutation({
    mutationFn: () => leaveVenue(venueId),
    onSuccess: async () => {
      setLeaveOpen(false)
      await invalidateAffected()
      queryClient.removeQueries({ queryKey: ['venues'] })
      navigate('/app', { replace: true })
    },
  })

  function closeInvite() {
    setInvite(null)
    void queryClient.invalidateQueries({ queryKey: ['venue-invites', venueId] })
  }

  async function createInvite() {
    if (invitePending) return
    setInvitePending(true)
    setInviteError(false)
    try {
      setInvite(await createVenueInvite(venueId))
      await queryClient.invalidateQueries({ queryKey: ['venue-invites', venueId] })
    } catch {
      setInviteError(true)
    } finally {
      setInvitePending(false)
    }
  }

  if (accessQuery.isPending || membersQuery.isPending) return <PageState state="loading" label={t('venueSharing.membersLoading')} />
  if (accessQuery.isError || membersQuery.isError || (owner && invitesQuery.isError)) return <PageState state="error" message={t('venueSharing.membersLoadError')} onRetry={() => { void accessQuery.refetch(); void membersQuery.refetch(); if (owner) void invitesQuery.refetch() }} />
  if (!accessQuery.data) return null

  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6" aria-labelledby="venue-members-title">
      <header className="flex items-center justify-between gap-4">
        <div><p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">{t('venues.sharedBadge')}</p><h1 className="m-0 text-page-title font-extrabold" id="venue-members-title">{t('venueSharing.membersTitle')}</h1></div>
        <div className="flex items-center gap-3"><Link className="min-h-11 rounded-control px-3 py-2 font-bold text-brand-strong no-underline" to={`/app/venues/${venueId}/activity`}>{t('venueActivity.link')}</Link><span className="rounded-full bg-brand/10 px-3 py-2 font-bold text-brand-strong">{t('venueSharing.memberLimit', { count: accessQuery.data.member_count, max: accessQuery.data.max_members })}</span></div>
      </header>

      <div className="grid gap-3">
        {membersQuery.data?.map((member) => (
          <article className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-soft" key={member.user_id}>
            <MemberAvatar member={member} />
            <div className="min-w-0 flex-1"><strong className="block truncate">{member.display_name || '?'}</strong><span className="text-sm text-muted">{member.role === 'owner' ? t('venueSharing.ownerRole') : t('venueSharing.memberRole')} · {t('venueSharing.joinedAt', { date: displayDate(member.joined_at) })}</span></div>
            {owner && member.role === 'member' ? <button className="min-h-11 rounded-control px-3 font-bold text-danger" type="button" aria-label={t('venueSharing.removeMember', { name: member.display_name || '?' })} onClick={() => setMemberToRemove(member)}>{t('venueSharing.removeMember', { name: member.display_name || '?' })}</button> : null}
          </article>
        ))}
      </div>

      {owner ? <section className="grid gap-4 rounded-card border border-line bg-surface p-5" aria-labelledby="venue-invites-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-section-title font-bold" id="venue-invites-title">{t('venueSharing.unusedInvites')}</h2><button className="inline-flex min-h-11 items-center gap-2 rounded-control bg-brand px-4 font-bold text-white disabled:opacity-50" type="button" disabled={invitePending} onClick={() => void createInvite()}><AppIcon name="share" />{invitePending ? t('venueSharing.creatingInvite') : t('venueSharing.createInvite')}</button></div>
        {invitesQuery.data?.filter((item) => item.status === 'active').map((item) => <div className="flex items-center justify-between gap-3 text-sm" key={item.invite_id}><span className="text-muted">{t('venueSharing.inviteExpiresAt', { date: displayDate(item.expires_at) })}</span><button className="min-h-11 rounded-control px-3 font-bold text-danger disabled:opacity-50" type="button" disabled={revokeInviteMutation.isPending} onClick={() => revokeInviteMutation.mutate(item.invite_id)}>{t('venueSharing.revoke')}</button></div>)}
        {inviteError ? <p className="m-0 text-sm text-danger" role="alert">{t('venueSharing.actionError')}</p> : null}
      </section> : <button className="justify-self-start min-h-11 rounded-control border border-danger px-4 font-bold text-danger" type="button" onClick={() => setLeaveOpen(true)}>{t('venueSharing.leaveVenue')}</button>}

      <VenueInviteDialog open={Boolean(invite)} invite={invite} onClose={closeInvite} />
      <ConfirmDialog open={Boolean(memberToRemove)} title={t('venueSharing.removeMemberTitle')} description={t('venueSharing.removeMemberDescription')} confirmLabel={t('venueSharing.removeMemberTitle')} busyLabel={t('venueSharing.removingMember')} busy={removeMemberMutation.isPending} onCancel={() => setMemberToRemove(null)} onConfirm={() => { if (memberToRemove) removeMemberMutation.mutate(memberToRemove) }} />
      <ConfirmDialog open={leaveOpen} title={t('venueSharing.leaveVenueTitle')} description={t('venueSharing.leaveVenueDescription')} confirmLabel={t('venueSharing.leaveVenue')} busyLabel={t('venueSharing.leavingVenue')} busy={leaveMutation.isPending} onCancel={() => setLeaveOpen(false)} onConfirm={() => leaveMutation.mutate()} />
    </section>
  )
}
