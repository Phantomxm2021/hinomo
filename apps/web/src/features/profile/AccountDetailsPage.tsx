import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useAuth } from '../auth/auth-context'
import { userDisplayName } from './account-name'
import { AvatarUploadControl, ReadOnlyAccountField } from './account-view'
import { getAvatarDownload, getProfile, uploadAvatar } from './profile.api'

export function AccountDetailsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const feedback = useMobileFeedback()
  const queryClient = useQueryClient()
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
    onError: () => feedback.notify('头像上传失败，请重试'),
  })

  if (!user) return null
  const name = profileQuery.data?.display_name || userDisplayName(user)
  const avatar = avatarQuery.data || user.user_metadata?.avatar_url
  const pending = profileQuery.isPending
    || (Boolean(profileQuery.data?.avatar_object_key) && avatarQuery.isPending)

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5" aria-labelledby="account-details-title">
      <nav className="sticky top-0 z-20 -mx-4 -mt-[max(1rem,var(--safe-area-top))] grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label="账户信息导航">
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label="返回" onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">账户信息</span>
        <div aria-hidden="true" />
      </nav>
      <header className="hidden items-center gap-3 py-3 lg:flex">
        <h1 className="m-0 text-section-title font-bold" id="account-details-title">账户信息</h1>
      </header>

      {pending ? (
        <SkeletonGroup className="grid gap-4 rounded-card bg-surface p-4 shadow-soft" label="正在加载账户信息">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="h-12 w-full rounded-control" />
          <Skeleton className="h-12 w-full rounded-control" />
        </SkeletonGroup>
      ) : (
        <>
          {profileQuery.isError ? <PageState state="error" message="资料加载失败，当前显示登录信息" onRetry={() => void profileQuery.refetch()} /> : null}
          <section className="overflow-hidden rounded-card border-0 bg-surface p-0 shadow-soft lg:grid lg:gap-5 lg:rounded-shell lg:border lg:border-line lg:p-6" role="group" aria-label="个人资料">
            <div className="grid justify-items-center gap-2 p-5 lg:p-0">
              <AvatarUploadControl src={avatar} name={name} pending={avatarMutation.isPending} onChange={(file) => avatarMutation.mutate(file)} />
              <p className="m-0 text-meta text-muted">点击头像更换</p>
            </div>
            <ReadOnlyAccountField listRow label="昵称" value={name} />
            <ReadOnlyAccountField listRow label="邮箱" value={user.email ?? '未设置'} />
          </section>
        </>
      )}
    </section>
  )
}
