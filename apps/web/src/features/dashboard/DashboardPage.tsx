import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { GlobalFindBar } from '../../components/GlobalFindBar'
import { listBoxes } from '../boxes/boxes.api'
import { AuthorizedImage } from '../media/AuthorizedImage'
import { listSpaces } from '../spaces/spaces.api'

export function DashboardPage() {
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const spaces = spacesQuery.data ?? []
  const boxes = boxesQuery.data ?? []
  const itemTotal = boxes.reduce((sum, box) => sum + box.item_count, 0)

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-8" aria-labelledby="dashboard-title">
      <header className="flex flex-col gap-2 py-3">
        <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">家庭总览</p>
        <h1 className="mb-4 max-w-3xl" id="dashboard-title">早上好，今天找什么？</h1>
        <GlobalFindBar />
      </header>

      {spacesQuery.isError || boxesQuery.isError ? (
        <p role="alert">部分数据加载失败，请稍后重试</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3" aria-label="收纳概览">
        <article className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" aria-label="空间统计">
          <span className="font-bold text-ink">空间</span>
          <strong className="text-5xl leading-none font-extrabold tracking-[-0.06em] text-ink">{spacesQuery.data?.length ?? '—'}</strong>
        </article>
        <article className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" aria-label="箱子统计">
          <span className="font-bold text-ink">箱子</span>
          <strong className="text-5xl leading-none font-extrabold tracking-[-0.06em] text-ink">{boxesQuery.data?.length ?? '—'}</strong>
        </article>
        <article className="grid min-h-36 content-between rounded-card border border-line bg-surface p-6" aria-label="物品统计">
          <span className="font-bold text-ink">物品</span>
          <strong className="text-5xl leading-none font-extrabold tracking-[-0.06em] text-ink">{boxesQuery.data ? itemTotal : '—'}</strong>
        </article>
      </div>

      <section className="min-w-0" aria-labelledby="rooms-title">
        <div className="my-3.5">
          <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">空间分布</p>
          <h2 className="mb-0" id="rooms-title">按房间查看</h2>
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
              className="flex min-h-30 flex-col justify-end rounded-card border border-line bg-surface p-5 text-muted no-underline hover:border-brand/40"
              to={`/app/boxes?space=${encodeURIComponent(space.id)}`}
              key={space.id}
            >
              <h3>{space.name}</h3>
              <p>{space.box_count} 个箱子 · {space.item_count} 件物品</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="min-w-0" aria-labelledby="recent-boxes-title">
        <div className="my-3.5 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">最近活动</p>
            <h2 className="mb-0" id="recent-boxes-title">最近的箱子</h2>
          </div>
          {boxes.length > 0 ? <Link to="/app/boxes">查看全部</Link> : null}
        </div>
        {boxesQuery.isPending ? (
          <p role="status" aria-label="正在加载箱子">正在加载箱子…</p>
        ) : null}
        {boxesQuery.isSuccess && boxes.length === 0 ? (
          <div className="grid min-h-56 place-content-center justify-items-center gap-4 rounded-card border border-dashed border-line bg-surface/70 p-7 text-center">
            <h3>给每件物品一个好找的家</h3>
            <p>从第一个箱子开始，记录它放在哪里、里面有什么。</p>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-control border border-brand bg-brand px-4 py-2 font-bold text-white no-underline" to="/app/boxes/new">创建第一个箱子</Link>
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {boxes.slice(0, 3).map((box) => (
            <Link className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface text-muted no-underline hover:border-brand/40" to={`/b/${box.public_id}`} key={box.id}>
              <span className="relative block aspect-[16/10] w-full overflow-hidden bg-placeholder">
                {box.cover_object_key ? (
                  <AuthorizedImage
                    objectKey={box.cover_object_key}
                    alt={`${box.name}封面`}
                    className="block h-full w-full object-cover"
                  />
                ) : (
                  <span className="relative block h-full w-full bg-placeholder" role="img" aria-label={`${box.name}封面占位图`}>
                    <span className="absolute right-[23%] bottom-[18%] h-[43%] w-[46%] rounded-control border-2 border-brand/40 bg-surface/70 shadow-[10px_10px_0_rgb(223_101_56_/_12%)]" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="block px-5 pt-4.5 pb-5">
                <span className="font-mono text-xs font-extrabold text-brand">{box.box_code}</span>
                <h3>{box.name}</h3>
                <p className="mb-2">{box.space_name} · {box.location || '未填写位置'}</p>
                <small>{box.item_count} 件物品</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
