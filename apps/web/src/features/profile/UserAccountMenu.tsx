import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { Skeleton } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { getCreditSummary } from '../credits/credits.api'
import { userDisplayName } from './account-name'
import { AccountAvatar, AvatarUploadControl, ReadOnlyAccountField } from './account-view'
import { getAvatarDownload, getProfile, uploadAvatar } from './profile.api'
import { useI18n } from '../../i18n/I18nProvider'

export function UserAccountMenu() {
  const { session } = useAuth()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'profile' | null>(null)
  const user = session?.user
  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  })
  const avatarQuery = useQuery({
    queryKey: ['profile-avatar', user?.id, profileQuery.data?.avatar_object_key],
    queryFn: getAvatarDownload,
    enabled: Boolean(profileQuery.data?.avatar_object_key),
  })
  const creditQuery = useQuery({ queryKey: ['credit-summary'], queryFn: getCreditSummary })
  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['profile-avatar', user?.id] })
    },
  })

  if (!user) return null
  const name = profileQuery.data?.display_name || userDisplayName(user, t('profile.accountNameFallback'))
  const avatar = avatarQuery.data || user.user_metadata?.avatar_url
  const accountPending = profileQuery.isPending
    || (Boolean(profileQuery.data?.avatar_object_key) && avatarQuery.isPending)

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="relative mt-auto">
      <button
        className="flex w-full items-center gap-3 border-t border-line pt-5 text-left"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('appShell.menu.open')}
        onClick={() => setOpen((value) => !value)}
      >
        {accountPending ? (
          <span className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-label={t('profile.accountMenuLoading')}>
            <span className="sr-only">{t('profile.accountMenuLoading')}</span>
            <Skeleton as="span" className="block size-10 shrink-0 rounded-full" />
            <span className="grid min-w-0 flex-1 gap-2">
              <Skeleton as="span" className="block h-4 w-2/3" />
              <Skeleton as="span" className="block h-3 w-5/6" />
            </span>
          </span>
        ) : (
          <>
            <AccountAvatar src={avatar} name={name} size="sm" avatarLabel={t('profile.avatar', { name })} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold text-ink">{name}</span>
              <span className="block truncate text-meta text-muted">{user.email}</span>
              <span className="mt-1 block text-xs font-bold text-brand">
                {creditQuery.isPending ? t('profile.creditsLoading') : t('profile.creditsCount', { count: creditQuery.data?.credits_available ?? 0 })}
              </span>
            </span>
          </>
        )}
        {accountPending && user.email ? <span className="sr-only">{user.email}</span> : null}
        <AppIcon name="chevron-right" size={18} />
      </button>
      {open ? createPortal(
        <div className="fixed bottom-28 left-6 z-[60] grid w-72 max-w-[calc(100vw-3rem)] gap-1 rounded-card border border-line bg-surface p-2 shadow-float" role="menu" aria-label={t('appShell.menu.account')}>
          <Link
            className="group mb-1 overflow-hidden rounded-[1rem] bg-[linear-gradient(145deg,#647e6e_0%,#385447_100%)] p-4 text-white no-underline shadow-soft transition-transform hover:-translate-y-0.5"
            to="/app/me/credits"
            role="menuitem"
            aria-label={t('profile.creditsAria', { credits: creditQuery.data?.credits_available ?? 0 })}
            onClick={() => setOpen(false)}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="grid size-9 place-items-center rounded-[0.7rem] bg-white/15 ring-1 ring-white/15"><AppIcon name="scan" size={19} /></span>
              <span className="text-xs font-bold text-white/70">{t('profile.creditsOneTime')}</span>
            </span>
            <span className="mt-4 flex items-end justify-between gap-3">
              <span><span className="block text-xs font-semibold text-white/70">{t('profile.creditsAvailable')}</span><strong className="mt-0.5 block text-xl leading-none">{t('profile.creditsBalance', { credits: creditQuery.data?.credits_available ?? 0 })}</strong></span>
              <span className="flex items-center gap-0.5 text-xs font-bold">{t('profile.creditsBuy')}<AppIcon name="chevron-right" size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
            </span>
          </Link>
          <button className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-ink hover:bg-canvas" type="button" role="menuitem" onClick={() => { setDialog('profile'); setOpen(false) }}>
            <AppIcon name="user" size={18} />{t('profile.account')}
          </button>
          <Link className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-ink no-underline hover:bg-canvas" to="/app/me/settings" role="menuitem" onClick={() => setOpen(false)}>
            <AppIcon name="settings" size={18} />{t('appShell.navigation.settings')}
          </Link>
          <button className="flex min-h-11 items-center gap-3 rounded-control px-3 text-left text-body font-medium text-danger hover:bg-danger/5" type="button" role="menuitem" onClick={() => void signOut()}>
            <AppIcon name="logout" size={18} />{t('appShell.menu.signOut')}
          </button>
        </div>,
        document.body,
      ) : null}
      {dialog === 'profile' ? (
        <Dialog title={t('profile.account')} closeLabel={t('profile.closeDialog')} onClose={() => setDialog(null)}>
          <div className="grid gap-4">
            <AvatarUploadControl
              src={avatar}
              name={name}
              pending={avatarMutation.isPending}
              onChange={(file) => avatarMutation.mutate(file)}
              avatarLabel={t('profile.avatar', { name })}
              pendingLabel={t('profile.uploadingAvatar')}
              changeLabel={t('profile.changeAvatar')}
            />
            {avatarMutation.isError ? <p role="alert">{t('profile.avatarUploadFailed')}</p> : null}
            <ReadOnlyAccountField label={t('profile.nickname')} value={name} />
            <ReadOnlyAccountField label={t('profile.email')} value={user.email ?? t('profile.emailNotSet')} />
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}

function Dialog({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="w-full max-w-md rounded-shell border border-line bg-surface p-6 shadow-float" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-section-title font-bold" id="user-dialog-title">{title}</h2>
          <button className="grid size-11 place-items-center rounded-control border border-line bg-canvas" type="button" aria-label={closeLabel} onClick={onClose}><AppIcon name="close" /></button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  )
}
