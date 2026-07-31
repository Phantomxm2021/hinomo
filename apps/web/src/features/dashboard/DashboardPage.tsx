import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { GlobalFindBar } from '../../components/GlobalFindBar'
import { PageState } from '../../components/PageState'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { listBoxes } from '../boxes/boxes.api'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { listSpaces } from '../spaces/spaces.api'

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
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const spaces = spacesQuery.data ?? []
  const boxes = boxesQuery.data ?? []
  const itemTotal = boxes.reduce((sum, box) => sum + box.item_count, 0)
  const initiallyLoading = (
    (spacesQuery.isPending && spacesQuery.data === undefined)
    || (boxesQuery.isPending && boxesQuery.data === undefined)
  )

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-10" aria-labelledby="dashboard-title">
      <header className="flex flex-col gap-2 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,auto)] lg:items-center lg:gap-6">
        <div>
          <p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">家庭总览</p>
          <h1 className="mb-4 max-w-3xl text-display font-extrabold" id="dashboard-title">早上好，今天找什么？</h1>
        </div>
        <GlobalFindBar />
      </header>

      {spacesQuery.isError || boxesQuery.isError ? (
        <PageState state="error" message="部分数据加载失败，请稍后重试" onRetry={() => void Promise.all([spacesQuery.refetch(), boxesQuery.refetch()])} />
      ) : null}

      {initiallyLoading ? (
        <SkeletonGroup className="grid gap-8" label="正在加载家庭总览">
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
          <strong className="text-metric font-extrabold tracking-[-0.045em] text-ink">{spacesQuery.data?.length ?? '—'}</strong>
          <span className="font-medium text-ink">客厅、卧室、书房...</span>
        </article>
        <article className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" aria-label="箱子统计">
          <span className="text-meta font-medium text-muted">箱子</span>
          <strong className="text-metric font-extrabold tracking-[-0.045em] text-ink">{boxesQuery.data?.length ?? '—'}</strong>
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
          <h2 className="mb-0 text-section-title font-bold" id="rooms-title">按房间查看</h2>
          <Link className="text-meta font-medium text-muted no-underline hover:text-ink" to="/app/spaces">
            管理空间 <span aria-hidden="true">›</span>
          </Link>
        </div>
        {spacesQuery.isPending ? (
          <p role="status" aria-label="正在加载空间">正在加载空间…</p>
        ) : null}
        {spacesQuery.isSuccess && spaces.length === 0 ? (
          <p className="rounded-control border border-dashed border-line bg-surface/70 p-4">还没有空间，创建箱子时可以设置它所在的房间。</p>
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

      <section className="min-w-0" aria-labelledby="recent-boxes-title">
        <div className="my-3.5 flex items-center justify-between gap-4">
          <div>
            <h2 className="mb-0 text-section-title font-bold" id="recent-boxes-title">最近打开</h2>
          </div>
          {boxes.length > 0 ? (
            <Link className="text-meta font-medium text-muted no-underline hover:text-ink" to="/app/boxes">
              查看全部 <span aria-hidden="true">›</span>
            </Link>
          ) : null}
        </div>
        {boxesQuery.isPending ? (
          <p role="status" aria-label="正在加载箱子">正在加载箱子…</p>
        ) : null}
        {boxesQuery.isSuccess && boxes.length === 0 ? (
          <div className="grid min-h-56 place-content-center justify-items-center gap-4 rounded-card border border-dashed border-line bg-surface/70 p-7 text-center">
            <h3>给每件物品一个好找的家</h3>
            <p>从第一个箱子开始，记录它放在哪里、里面有什么。</p>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-control border border-brand bg-brand px-4 py-2 font-bold text-white no-underline" to="/app/boxes?create=1">创建第一个箱子</Link>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {boxes.slice(0, 3).map((box, index) => (
            <Link className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface text-muted no-underline hover:border-brand/40" to={`/b/${box.public_id}`} key={box.id}>
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
            </Link>
          ))}
        </div>
      </section>
        </>
      )}
    </section>
  )
}
