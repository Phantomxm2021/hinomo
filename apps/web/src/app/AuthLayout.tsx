import { Link, Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <section className="auth-brand" aria-label="Nomo 产品介绍">
        <Link className="auth-logo" to="/">Nomo</Link>
        <div>
          <p className="eyebrow">智能收纳清单</p>
          <h2>让每件物品都有迹可循</h2>
          <p>为收纳箱生成二维码，扫码即可查看、搜索和维护箱内物品。</p>
        </div>
      </section>
      <div className="auth-content"><Outlet /></div>
    </div>
  )
}
