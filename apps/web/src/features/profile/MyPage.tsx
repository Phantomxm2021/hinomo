import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { userDisplayName } from './account-name'
import { AvatarUploadControl, ReadOnlyAccountField } from './account-view'
import { getAvatarDownload, getProfile, updateLocale, uploadAvatar } from './profile.api'

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
  const avatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['profile-avatar', user?.id] })
      feedback.notify('头像已更新')
    },
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
          <section className="grid gap-5 rounded-shell border border-line bg-surface p-5 shadow-soft sm:p-6" aria-label="账户信息">
            <div className="grid justify-items-center gap-2">
              <AvatarUploadControl src={avatar} name={name} pending={avatarMutation.isPending} onChange={(file) => avatarMutation.mutate(file)} />
              <p className="m-0 text-sm text-muted">点击头像更换</p>
              {avatarMutation.isError ? <ResponsiveOperationError message="头像上传失败，请重试" /> : null}
            </div>
            <ReadOnlyAccountField label="昵称" value={name} />
            <ReadOnlyAccountField label="邮箱" value={user.email ?? '未设置'} />
          </section>

          <section className="grid gap-4 rounded-shell border border-line bg-surface p-5 shadow-soft sm:p-6" aria-labelledby="preferences-title">
            <h2 className="m-0 text-section-title font-bold" id="preferences-title">设置</h2>
            <label className="grid gap-2 font-bold text-ink" htmlFor="my-locale">语言
              <select
                className="min-h-12 rounded-control border border-line bg-canvas px-3 font-normal"
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

          <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-danger/30 bg-surface px-4 font-bold text-danger" type="button" onClick={() => setConfirmingSignOut(true)}>
            <AppIcon name="logout" />退出登录
          </button>
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
