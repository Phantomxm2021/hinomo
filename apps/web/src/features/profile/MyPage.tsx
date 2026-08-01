import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { userDisplayName } from './account-name'
import { AccountAvatar } from './account-view'
import { getAvatarDownload, getProfile, updateLocale } from './profile.api'

export function MyPage() {
  const { session } = useAuth()
  const feedback = useMobileFeedback()
  const queryClient = useQueryClient()
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
  const localeMutation = useMutation({
    mutationFn: updateLocale,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      feedback.notify('设置已保存')
    },
  })
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
  })

  if (!user) return null
  const name = profileQuery.data?.display_name || userDisplayName(user)
  const avatar = avatarQuery.data || user.user_metadata?.avatar_url
  const pending = profileQuery.isPending
    || (Boolean(profileQuery.data?.avatar_object_key) && avatarQuery.isPending)

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5" aria-labelledby="my-title">
      <header className="py-3">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">账户与偏好</p>
        <h1 className="mb-0 text-page-title font-extrabold" id="my-title">我的</h1>
      </header>

      {pending ? (
        <SkeletonGroup className="grid gap-5 rounded-shell border border-line bg-surface p-5" label="正在加载我的资料">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="h-12 w-full rounded-control" />
          <Skeleton className="h-12 w-full rounded-control" />
          <Skeleton className="h-12 w-full rounded-control" />
        </SkeletonGroup>
      ) : (
        <>
          {profileQuery.isError ? <PageState state="error" message="资料加载失败，当前显示登录信息" onRetry={() => void profileQuery.refetch()} /> : null}
          <Link className="flex min-h-24 items-center gap-4 rounded-card border-0 bg-surface p-4 text-inherit no-underline shadow-soft transition-colors hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-brand lg:rounded-shell lg:border lg:border-line lg:p-6" to="/app/me/account">
            <AccountAvatar src={avatar} name={name} size="lg" />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-card-title text-ink">{name}</strong>
              <span className="mt-1 block truncate text-meta text-muted">{user.email ?? '未设置邮箱'}</span>
            </span>
            <AppIcon name="chevron-right" className="shrink-0 text-muted" />
          </Link>

          <section className="overflow-hidden rounded-card border-0 bg-surface p-0 shadow-soft lg:grid lg:gap-4 lg:rounded-shell lg:border lg:border-line lg:p-6" role="group" aria-label="偏好设置">
            <h2 className="m-0 px-4 pt-4 text-meta font-medium text-muted lg:px-0 lg:pt-0 lg:text-section-title lg:font-bold lg:text-ink" id="preferences-title">设置</h2>
            <label className="flex min-h-12 items-center justify-between gap-4 px-4 text-ink lg:grid lg:gap-2 lg:px-0 lg:font-bold" htmlFor="my-locale">语言
              <select
                className="min-h-11 max-w-[60%] border-0 bg-transparent p-0 text-right text-muted outline-none lg:min-h-12 lg:max-w-none lg:rounded-control lg:border lg:border-line lg:bg-canvas lg:px-3 lg:text-left lg:font-normal"
                id="my-locale"
                value={(localeMutation.isPending || localeMutation.isSuccess)
                  ? localeMutation.variables
                  : profileQuery.data?.locale ?? 'zh-CN'}
                disabled={localeMutation.isPending}
                onChange={(event) => localeMutation.mutate(event.target.value as 'zh-CN' | 'en-US')}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select>
            </label>
            {localeMutation.isSuccess ? <p className="m-0 hidden text-sm text-muted lg:block" role="status">设置已保存</p> : null}
            {localeMutation.isError ? <ResponsiveOperationError message="设置保存失败，请重试" /> : null}
          </section>

          <section className="overflow-hidden rounded-card border border-danger/15 bg-surface shadow-soft" role="group" aria-label="账户操作">
            <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-transparent px-4 font-semibold text-danger" type="button" onClick={() => setConfirmingSignOut(true)}>
              <AppIcon name="logout" />退出登录
            </button>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmingSignOut}
        title="退出登录？"
        description="退出后需要重新登录才能编辑收纳内容。"
        confirmLabel="确认退出"
        busy={signOutMutation.isPending}
        error={signOutMutation.isError ? '退出失败，请重试' : undefined}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => signOutMutation.mutate()}
      />
    </section>
  )
}
