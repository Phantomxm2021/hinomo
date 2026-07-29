import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listBoxes } from '../boxes/boxes.api'
import { listSpaces } from '../spaces/spaces.api'

const shortcuts = [
  { to: '/app/boxes/new', title: '创建箱子', description: '生成新的收纳二维码', icon: '+' },
  { to: '/app/scan', title: '扫码查看', description: '使用相机打开箱子', icon: '⌁' },
  { to: '/app/search', title: '搜索物品', description: '快速定位存放位置', icon: '⌕' },
  { to: '/app/print', title: '批量打印', description: '制作 A4 二维码标签', icon: '▦' },
]

export function DashboardPage() {
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: listSpaces })
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const boxes = boxesQuery.data ?? []
  const publicCount = boxes.filter((box) => box.visibility === 'public').length
  const privateCount = boxes.length - publicCount

  return (
    <section className="dashboard page-stack" aria-labelledby="dashboard-title">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">欢迎回来</p>
          <h1 id="dashboard-title">收纳工作台</h1>
          <p>从一个箱子开始，让家里的每件物品都有迹可循。</p>
        </div>
        <Link className="primary-link" to="/app/boxes/new">创建箱子</Link>
      </header>

      {spacesQuery.isError || boxesQuery.isError ? (
        <p role="alert">部分数据加载失败，请稍后重试</p>
      ) : null}

      <div className="dashboard-stats" aria-label="收纳概览">
        <article className="stat-card" aria-label="空间统计">
          <span>空间</span>
          <strong>{spacesQuery.data?.length ?? '—'}</strong>
          <Link to="/app/spaces">管理空间</Link>
        </article>
        <article className="stat-card" aria-label="箱子统计">
          <span>箱子</span>
          <strong>{boxesQuery.data?.length ?? '—'}</strong>
          <small>{publicCount} 个公开 · {privateCount} 个私有</small>
        </article>
      </div>

      <section aria-labelledby="quick-actions-title">
        <div className="section-heading">
          <p className="eyebrow">快捷开始</p>
          <h2 id="quick-actions-title">今天要整理什么？</h2>
        </div>
        <div className="quick-actions">
          {shortcuts.map((shortcut) => (
            <Link className="quick-action" to={shortcut.to} key={shortcut.to}>
              <span className="quick-action-icon" aria-hidden="true">{shortcut.icon}</span>
              <strong>{shortcut.title}</strong>
              <small>{shortcut.description}</small>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-boxes-title">
        <div className="section-heading heading-actions">
          <div>
            <p className="eyebrow">最近更新</p>
            <h2 id="recent-boxes-title">常用箱子</h2>
          </div>
          {boxes.length > 0 ? <Link to="/app/boxes">查看全部</Link> : null}
        </div>
        {boxesQuery.isPending ? <p role="status">正在加载箱子…</p> : null}
        {boxesQuery.isSuccess && boxes.length === 0 ? (
          <div className="empty-state">
            <p>还没有箱子，创建第一个二维码开始整理。</p>
            <Link className="primary-link" to="/app/boxes/new">创建第一个箱子</Link>
          </div>
        ) : null}
        <div className="recent-boxes">
          {boxes.slice(0, 3).map((box) => (
            <Link className="recent-box" to={`/b/${box.public_id}`} key={box.id}>
              <span className="box-code">{box.box_code}</span>
              <h3>{box.name}</h3>
              <p>{box.space_name} · {box.location || '未填写位置'}</p>
              <small>{box.visibility === 'public' ? '公开' : '私有'}</small>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
