import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GlobalFindBar } from '../../components/GlobalFindBar'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { useAuth } from '../auth/auth-context'
import { listBoxes } from '../boxes/boxes.api'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { getProfile, markOnboardingWelcomeSeen } from '../profile/profile.api'
import { listSpaces } from '../spaces/spaces.api'
import { listVenues } from '../venues/venues.api'
import { VenueSwitcher } from '../venues/VenueSwitcher'
import { useSelectedVenue } from '../venues/selected-venue'
import { greetingForHour } from './dashboard-greeting'
import { OnboardingWelcomeDialog } from './OnboardingWelcomeDialog'
import { getOnboardingProgress } from './onboarding-progress'

const boxPlaceholderTones = ['bg-[#a98b6e]', 'bg-[#788790]', 'bg-[#b7925c]'] as const

function spaceEmoji(name: string) {
  if (/客厅|起居/.test(name)) return '🛋️'
  if (/卧室|主卧|次卧/.test(name)) return '🛏️'
  if (/书房|办公室|工作/.test(name)) return '👩‍💻'
  if (/储藏|仓库/.test(name)) return '🚪'
  if (/厨房/.test(name)) return '🍳'
  if (/浴室|卫生间/.test(name)) return '🛁'
  if (/儿童|玩具/.test(name)) return '🧸'
  return '🏠'
}

export function DashboardPage() {
  const { session } = useAuth()
  const user = session?.user
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [greeting, setGreeting] = useState(() => greetingForHour(new Date().getHours()))
  const venuesQuery = useQuery({ queryKey: ['venues'], queryFn: listVenues })
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  })
  const venues = venuesQuery.data ?? []
  const [activeVenueId, setActiveVenueId] = useSelectedVenue(venues)
  const spaces = activeVenueId
    ? (spacesQuery.data ?? []).filter((space) => space.venue_id === activeVenueId)
    : []
  const visibleSpaceIds = new Set(spaces.map((space) => space.id))
  const boxes = (boxesQuery.data ?? []).filter((box) => visibleSpaceIds.has(box.space_id))
  const itemTotal = boxes.reduce((sum, box) => sum + box.item_count, 0)
  const allSpaces = spacesQuery.data ?? []
  const allBoxes = boxesQuery.data ?? []
  const allItemTotal = allBoxes.reduce((sum, box) => sum + box.item_count, 0)
  const dashboardDataReady = venuesQuery.isSuccess && spacesQuery.isSuccess && boxesQuery.isSuccess
  const profileReady = profileQuery.isSuccess
  const currentDashboardRoute = location.pathname === '/app'
  const onboardingAvailable = currentDashboardRoute && dashboardDataReady && profileReady && allItemTotal === 0
  const onboardingProgress = getOnboardingProgress({
    hasSpace: allSpaces.length > 0,
    hasBox: allBoxes.length > 0,
    hasItem: allItemTotal > 0,
    firstBoxPublicId: allBoxes[0]?.public_id,
  })
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [welcomeSeenPending, setWelcomeSeenPending] = useState(false)
  const [welcomeSeenError, setWelcomeSeenError] = useState(false)
  const autoOpenedRef = useRef(false)
  const autoOpenedUserIdRef = useRef<string | null>(null)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)
  const recordWelcomeSeen = useCallback(() => {
    if (!user) return
    setWelcomeSeenError(false)
    setWelcomeSeenPending(true)
    void markOnboardingWelcomeSeen()
      .then(() => {
        queryClient.setQueryData(['profile', user.id], (profile: typeof profileQuery.data) => (
          profile ? { ...profile, onboarding_welcome_seen_at: new Date().toISOString() } : profile
        ))
      })
      .catch(() => setWelcomeSeenError(true))
      .finally(() => setWelcomeSeenPending(false))
  }, [queryClient, user])

  const openOnboarding = useCallback(() => {
    setOnboardingOpen(true)
    if (welcomeSeenError) recordWelcomeSeen()
  }, [recordWelcomeSeen, welcomeSeenError])

  useEffect(() => {
    if (!user?.id) return
    if (autoOpenedUserIdRef.current !== user.id) {
      autoOpenedUserIdRef.current = user.id
      autoOpenedRef.current = false
    }
    const shouldAutoOpen = currentDashboardRoute
      && dashboardDataReady
      && profileReady
      && allItemTotal === 0
      && !profileQuery.data?.onboarding_welcome_seen_at
    if (!shouldAutoOpen || autoOpenedRef.current) return

    autoOpenedRef.current = true
    setOnboardingOpen(true)
    recordWelcomeSeen()
  }, [allItemTotal, currentDashboardRoute, dashboardDataReady, profileReady, profileQuery.data?.onboarding_welcome_seen_at, recordWelcomeSeen, user?.id])

  const initiallyLoading = (
    (venuesQuery.isPending && venuesQuery.data === undefined)
    ||
    (spacesQuery.isPending && spacesQuery.data === undefined)
    || (boxesQuery.isPending && boxesQuery.data === undefined)
    || (Boolean(user) && profileQuery.isPending && profileQuery.data === undefined)
  )

  useEffect(() => {
    const updateGreeting = () => setGreeting(greetingForHour(new Date().getHours()))
    const timer = window.setInterval(updateGreeting, 60_000)
    window.addEventListener('focus', updateGreeting)
    document.addEventListener('visibilitychange', updateGreeting)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', updateGreeting)
      document.removeEventListener('visibilitychange', updateGreeting)
    }
  }, [])

  const dashboardTitle = `${greeting}，今天找什么？`

  return (
    <>
    <section className="mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-6 lg:gap-10" aria-labelledby="dashboard-title">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,auto)] lg:items-center lg:gap-x-6">
        <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="mb-0 text-meta font-medium tracking-eyebrow text-muted">空间总览</p>
          <div className="flex items-center gap-2">
            {onboardingAvailable ? (
              <button
                className="inline-flex min-h-11 items-center rounded-control px-3 text-meta font-semibold text-brand-strong hover:bg-brand/10"
                type="button"
                ref={returnFocusRef}
                onClick={openOnboarding}
              >
                新手指南
              </button>
            ) : null}
            {venuesQuery.isPending && venuesQuery.data === undefined ? (
              <Skeleton className="h-11 w-32 rounded-control lg:w-48" />
            ) : <VenueSwitcher venues={venues} selectedId={activeVenueId} onSelect={setActiveVenueId} />}
          </div>
        </div>
        <h1 className="col-span-2 mb-2 max-w-3xl text-display font-extrabold lg:col-span-1 lg:row-start-2 lg:mb-4" id="dashboard-title">{dashboardTitle}</h1>
        <div className="col-span-2 flex min-w-0 items-stretch lg:col-span-1 lg:col-start-2 lg:row-start-2 lg:justify-end">
          <GlobalFindBar />
        </div>
      </header>

      {venuesQuery.isError || spacesQuery.isError || boxesQuery.isError ? (
        <PageState state="error" message="部分数据加载失败，请稍后重试" onRetry={() => void Promise.all([venuesQuery.refetch(), spacesQuery.refetch(), boxesQuery.refetch()])} />
      ) : null}

      {initiallyLoading ? (
        <SkeletonGroup className="grid gap-8" label="正在加载空间总览">
          <div className="hidden gap-4 sm:grid-cols-3 lg:grid">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" key={index}>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="grid min-h-28 content-between rounded-card border border-line bg-surface p-5" key={index}>
                <Skeleton className="size-8 rounded-full" />
                <div className="grid gap-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="overflow-hidden rounded-card border border-line bg-surface" key={index}>
                <Skeleton className="aspect-[3.5/1] w-full rounded-none" />
                <div className="grid gap-2 p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
              </div>
            ))}
          </div>
        </SkeletonGroup>
      ) : (
        <>
      <div className="hidden gap-4 sm:grid-cols-3 lg:grid" aria-label="收纳概览">
        <article className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" aria-label="空间统计">
          <span className="text-meta font-medium text-muted">空间</span>
          <strong className="text-metric font-extrabold tracking-[-0.045em] text-ink">{spacesQuery.data ? spaces.length : '—'}</strong>
          <span className="font-medium text-ink">客厅、卧室、书房...</span>
        </article>
        <article className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" aria-label="箱子统计">
          <span className="text-meta font-medium text-muted">箱子</span>
          <strong className="text-metric font-extrabold tracking-[-0.045em] text-ink">{boxesQuery.data ? boxes.length : '—'}</strong>
          <span className="font-medium text-ink">3 个最近更新</span>
        </article>
        <article className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" aria-label="物品统计">
          <span className="text-meta font-medium text-muted">物品</span>
          <strong className="text-metric font-extrabold tracking-[-0.045em] text-ink">{boxesQuery.data ? itemTotal : '—'}</strong>
          <span className="font-medium text-ink">跨箱子快速搜索</span>
        </article>
      </div>

      <section className="min-w-0" aria-labelledby="rooms-title">
        <div className="my-3.5 flex items-center justify-between gap-4">
          <h2 className="mb-0 text-section-title font-bold" id="rooms-title">按空间查看</h2>
          <Link className="inline-flex min-h-11 items-center text-meta font-medium text-muted no-underline hover:text-ink" to="/app/spaces">
            管理空间 <span aria-hidden="true">›</span>
          </Link>
        </div>
        {spacesQuery.isSuccess && spaces.length === 0 ? (
          <PageState
            state="empty"
            icon="space"
            title="这个场地还没有空间"
            description="空间可以是客厅、卧室、储藏室，也可以是一组货架。"
            action={<Link to="/app/spaces?create=1">创建第一个空间</Link>}
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {spaces.map((space) => (
            <Link
              className="flex min-h-28 flex-col justify-between rounded-card border border-line bg-surface p-5 text-muted no-underline hover:border-brand/40"
              to={`/app/boxes?space=${encodeURIComponent(space.id)}`}
              key={space.id}
            >
              <span className="text-3xl leading-none" role="img" aria-label={`${space.name}图标`}>{spaceEmoji(space.name)}</span>
              <div>
                <h3 className="text-card-title font-bold">{space.name}</h3>
                <p className="text-body text-muted">{space.box_count} 个箱子</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {spaces.length > 0 ? <section className="min-w-0" aria-labelledby="recent-boxes-title">
        <div className="my-3.5 flex items-center justify-between gap-4">
          <div>
            <h2 className="mb-0 text-section-title font-bold" id="recent-boxes-title">最近打开</h2>
          </div>
          {boxes.length > 0 ? (
            <Link className="inline-flex min-h-11 items-center text-meta font-medium text-muted no-underline hover:text-ink" to="/app/boxes">
              查看全部 <span aria-hidden="true">›</span>
            </Link>
          ) : null}
        </div>
        {boxesQuery.isSuccess && boxes.length === 0 ? (
          <PageState
            state="empty"
            icon="box"
            title="给每件物品一个好找的家"
            description="从第一个箱子开始，记录它放在哪里、里面有什么。"
            action={<Link to="/app/boxes?create=1">创建第一个箱子</Link>}
          />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {boxes.slice(0, 3).map((box, index) => (
            <article className="relative flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface text-muted hover:border-brand/40" key={box.id}>
              <span
                className={`relative block aspect-[3.5/1] w-full overflow-hidden ${box.cover_object_key ? 'bg-placeholder' : boxPlaceholderTones[index % boxPlaceholderTones.length]}`}
                role={box.cover_object_key ? undefined : 'img'}
                aria-label={box.cover_object_key ? undefined : `${box.name}封面占位图`}
              >
                {box.cover_object_key ? (
                  <AuthorizedImage
                    objectKey={box.cover_object_key}
                    alt={`${box.name}封面`}
                    className="block h-full w-full object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 block">
                    <span className="absolute top-1/2 right-[8%] -translate-y-1/2 text-4xl leading-none" aria-hidden="true">📦</span>
                  </span>
                )}
              </span>
              <span className="block px-5 pt-4.5 pb-5">
                <h3 className="text-card-title font-bold">{box.name}</h3>
                <p className="mb-2 text-meta text-muted">{box.space_name} · {box.location || '未填写位置'}</p>
              </span>
              <Link className="absolute inset-0 z-10 focus-visible:outline-offset-[-3px]" to={`/b/${box.public_id}`} aria-label={`打开${box.name}`} />
            </article>
          ))}
        </div>
      </section> : null}
        </>
      )}
    </section>
    {welcomeSeenError ? (
      <p className="mx-auto mt-3 w-full max-w-7xl text-meta text-muted" role="status" aria-label="新手指南状态" aria-live="polite">
        新手指南记录失败，下次打开时会重试。
      </p>
    ) : null}
    <OnboardingWelcomeDialog
      open={onboardingOpen && onboardingAvailable}
      busy={welcomeSeenPending}
      progress={onboardingProgress}
      onClose={() => setOnboardingOpen(false)}
      onStart={(actionHref) => navigate(actionHref)}
      returnFocusRef={returnFocusRef}
    />
    </>
  )
}
