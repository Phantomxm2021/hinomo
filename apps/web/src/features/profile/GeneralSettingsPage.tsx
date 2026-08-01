import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useAuth } from '../auth/auth-context'
import { getProfile, updateLocale } from './profile.api'

export function GeneralSettingsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const feedback = useMobileFeedback()
  const user = session?.user
  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  })
  const localeMutation = useMutation({
    mutationFn: updateLocale,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      feedback.notify('设置已保存')
    },
  })

  if (!user) return null
  const locale = localeMutation.variables ?? profileQuery.data?.locale ?? 'zh-CN'

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5" aria-labelledby="general-settings-title">
      <nav className="mobile-detail-nav sticky top-0 z-20 -mx-4 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label="通用设置导航">
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label="返回设置" onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">通用</span>
        <span />
      </nav>

      <header className="hidden items-center gap-3 py-3 lg:flex">
        <Link className="grid size-10 place-items-center rounded-full text-ink no-underline hover:bg-surface" to="/app/me/settings" aria-label="返回设置">
          <AppIcon className="rotate-180" name="chevron-right" size={20} />
        </Link>
        <h1 className="m-0 text-page-title font-extrabold" id="general-settings-title">通用</h1>
      </header>

      {profileQuery.isPending ? (
        <SkeletonGroup className="grid gap-3 rounded-card bg-surface p-4 shadow-soft" label="正在加载通用设置">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-14 w-full rounded-control" />
        </SkeletonGroup>
      ) : null}
      {profileQuery.isError ? <PageState state="error" message="设置加载失败，请重试" onRetry={() => void profileQuery.refetch()} /> : null}
      {profileQuery.data ? (
        <div className="grid gap-2">
          <h2 className="m-0 px-4 text-meta font-medium text-muted">语言与地区</h2>
          <section className="overflow-hidden rounded-card border-0 bg-surface shadow-soft lg:rounded-shell lg:border lg:border-line" role="group" aria-label="语言与地区">
            <label className="flex min-h-16 items-center justify-between gap-4 px-4 text-body font-semibold text-ink lg:px-5" htmlFor="general-locale">语言
              <span className="relative flex min-w-0 items-center">
                <select
                  className="min-h-11 max-w-48 appearance-none border-0 bg-transparent py-0 pr-6 pl-3 text-right font-normal text-muted outline-none"
                  id="general-locale"
                  value={locale}
                  disabled={localeMutation.isPending}
                  onChange={(event) => localeMutation.mutate(event.target.value as 'zh-CN' | 'en-US')}
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
                <AppIcon name="chevron-right" className="pointer-events-none absolute right-0 rotate-90 text-muted/70" size={16} />
              </span>
            </label>
          </section>
        </div>
      ) : null}
      {localeMutation.isError ? <ResponsiveOperationError message="设置保存失败，请重试" /> : null}
    </section>
  )
}
