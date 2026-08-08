import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { userDisplayName } from './account-name'
import { AccountAvatar } from './account-view'
import { getAvatarDownload, getProfile } from './profile.api'
import { getCreditSummary } from '../credits/credits.api'
import { useI18n } from '../../i18n/I18nProvider'

export function MyPage() {
  const { session } = useAuth()
  const { t } = useI18n()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
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
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  })

  if (!user) return null
  const name = profileQuery.data?.display_name || userDisplayName(user, t('profile.accountNameFallback'))
  const avatar = avatarQuery.data || user.user_metadata?.avatar_url
  const pending = profileQuery.isPending
    || (Boolean(profileQuery.data?.avatar_object_key) && avatarQuery.isPending)

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5" aria-labelledby="my-title">
      <header className="py-3">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">{t('profile.title')}</p>
        <h1 className="mb-0 text-page-title font-extrabold" id="my-title">{t('profile.title')}</h1>
      </header>

      {pending ? (
        <SkeletonGroup className="grid gap-5 rounded-shell border border-line bg-surface p-5" label={t('profile.myLoading')}>
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="h-12 w-full rounded-control" />
          <Skeleton className="h-12 w-full rounded-control" />
          <Skeleton className="h-12 w-full rounded-control" />
        </SkeletonGroup>
      ) : (
        <>
          {profileQuery.isError ? <PageState state="error" message={t('profile.accountLoadFailed')} onRetry={() => void profileQuery.refetch()} /> : null}
          <Link className="flex min-h-24 items-center gap-4 rounded-card border-0 bg-surface p-4 text-inherit no-underline shadow-soft transition-colors hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-brand lg:rounded-shell lg:border lg:border-line lg:p-6" to="/app/me/account">
            <AccountAvatar src={avatar} name={name} size="lg" avatarLabel={t('profile.avatar', { name })} />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-card-title text-ink">{name}</strong>
              <span className="mt-1 block truncate text-meta text-muted">{user.email ?? t('profile.emailNotSet')}</span>
            </span>
            <AppIcon name="chevron-right" className="shrink-0 text-muted" />
          </Link>

          <Link className="group overflow-hidden rounded-[1.45rem] bg-[linear-gradient(145deg,#647e6e_0%,#385447_100%)] p-5 text-white no-underline shadow-float active:scale-[0.995]" to="/app/me/credits">
            <span className="flex items-start justify-between gap-4"><span className="grid size-12 place-items-center rounded-[0.95rem] bg-white/14 ring-1 ring-white/15"><AppIcon name="scan" size={24} /></span><AppIcon name="chevron-right" className="text-white/65 transition-transform group-hover:translate-x-0.5" /></span>
            <strong className="mt-5 block text-[1.25rem]">{t('profile.creditsTitle')}</strong>
            <span className="mt-1 flex items-end justify-between gap-4"><span className="text-sm text-white/70">{t('profile.creditsDescription')}</span><span className="shrink-0 text-sm font-extrabold">{t('profile.creditsBalance', { credits: creditQuery.data?.credits_available ?? 0 })}</span></span>
          </Link>

          <section className="overflow-hidden rounded-card border-0 bg-surface shadow-soft lg:rounded-shell lg:border lg:border-line" role="group" aria-label={t('profile.sectionSettings')}>
            <Link className="group flex min-h-16 items-center gap-3 px-4 text-inherit no-underline transition-colors hover:bg-canvas lg:px-5" to="/app/me/settings">
              <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] bg-brand text-white shadow-sm">
                <AppIcon name="settings" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-body font-semibold text-ink">{t('profile.settings')}</strong>
                <span className="mt-0.5 block truncate text-meta text-muted">{t('profile.settingsDescription')}</span>
              </span>
              <AppIcon name="chevron-right" className="shrink-0 text-muted/70 transition-transform group-hover:translate-x-0.5" size={18} />
            </Link>
          </section>

          <section className="overflow-hidden rounded-card border border-danger/15 bg-surface shadow-soft" role="group" aria-label={t('profile.accountActions')}>
            <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-transparent px-4 font-semibold text-danger" type="button" onClick={() => setConfirmingSignOut(true)}>
              <AppIcon name="logout" />{t('appShell.menu.signOut')}
            </button>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmingSignOut}
        title={t('profile.signOutConfirmTitle')}
        description={t('profile.signOutConfirmDescription')}
        confirmLabel={t('profile.signOutConfirm')}
        cancelLabel={t('common.cancel')}
        busyLabel={t('common.processing')}
        busy={signOutMutation.isPending}
        error={signOutMutation.isError ? t('profile.signOutFailed') : undefined}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => signOutMutation.mutate()}
      />
    </section>
  )
}
