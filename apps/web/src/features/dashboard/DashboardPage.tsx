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
    <section className="dashboard page-stack" aria-labelledby="dashboard-title">
      <header className="dashboard-hero">
        <p className="eyebrow">家庭总览</p>
        <h1 id="dashboard-title">早上好，今天找什么？</h1>
        <GlobalFindBar />
      </header>

      {spacesQuery.isError || boxesQuery.isError ? (
        <p role="alert">部分数据加载失败，请稍后重试</p>
      ) : null}

      <div className="dashboard-stats" aria-label="收纳概览">
        <article className="stat-card" aria-label="空间统计">
          <span>空间</span>
          <strong>{spacesQuery.data?.length ?? '—'}</strong>
        </article>
        <article className="stat-card" aria-label="箱子统计">
          <span>箱子</span>
          <strong>{boxesQuery.data?.length ?? '—'}</strong>
        </article>
        <article className="stat-card" aria-label="物品统计">
          <span>物品</span>
          <strong>{boxesQuery.data ? itemTotal : '—'}</strong>
        </article>
      </div>

      <section className="dashboard-section" aria-labelledby="rooms-title">
        <div className="section-heading">
          <p className="eyebrow">空间分布</p>
          <h2 id="rooms-title">按房间查看</h2>
        </div>
        {spacesQuery.isPending ? (
          <p role="status" aria-label="正在加载空间">正在加载空间…</p>
        ) : null}
        {spacesQuery.isSuccess && spaces.length === 0 ? (
          <p className="dashboard-section-note">还没有空间，创建箱子时可以设置它所在的房间。</p>
        ) : null}
        <div className="dashboard-spaces">
          {spaces.map((space) => (
            <Link
              className="dashboard-space-card"
              to={`/app/boxes?space=${encodeURIComponent(space.id)}`}
              key={space.id}
            >
              <h3>{space.name}</h3>
              <p>{space.box_count} 个箱子 · {space.item_count} 件物品</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="recent-boxes-title">
        <div className="section-heading heading-actions">
          <div>
            <p className="eyebrow">最近活动</p>
            <h2 id="recent-boxes-title">最近的箱子</h2>
          </div>
          {boxes.length > 0 ? <Link to="/app/boxes">查看全部</Link> : null}
        </div>
        {boxesQuery.isPending ? (
          <p role="status" aria-label="正在加载箱子">正在加载箱子…</p>
        ) : null}
        {boxesQuery.isSuccess && boxes.length === 0 ? (
          <div className="empty-state dashboard-empty-state">
            <h3>给每件物品一个好找的家</h3>
            <p>从第一个箱子开始，记录它放在哪里、里面有什么。</p>
            <Link className="primary-link" to="/app/boxes/new">创建第一个箱子</Link>
          </div>
        ) : null}
        <div className="recent-boxes">
          {boxes.slice(0, 3).map((box) => (
            <Link className="recent-box" to={`/b/${box.public_id}`} key={box.id}>
              <span className="recent-box-cover">
                {box.cover_object_key ? (
                  <AuthorizedImage
                    objectKey={box.cover_object_key}
                    alt={`${box.name}封面`}
                    className="recent-box-image"
                  />
                ) : (
                  <span className="recent-box-cover-fallback" role="img" aria-label={`${box.name}封面占位图`}>
                    <span aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="recent-box-content">
                <span className="box-code">{box.box_code}</span>
                <h3>{box.name}</h3>
                <p>{box.space_name} · {box.location || '未填写位置'}</p>
                <small>{box.item_count} 件物品</small>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
