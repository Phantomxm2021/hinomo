import {
  Link,
  NavLink,
  Outlet,
  type NavLinkRenderProps,
} from 'react-router-dom'

const navigation = [
  { to: '/app/boxes', label: '箱子' },
  { to: '/app/search', label: '搜索' },
  { to: '/app/scan', label: '扫码' },
  { to: '/app/spaces', label: '空间' },
]

function Navigation() {
  return navigation.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }: NavLinkRenderProps) =>
        isActive ? 'active' : undefined
      }
    >
      {item.label}
    </NavLink>
  ))
}

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Link className="brand" to="/app/boxes">Nomo</Link>
        <nav aria-label="主导航"><Navigation /></nav>
      </aside>
      <main className="app-content"><Outlet /></main>
      <nav className="mobile-nav" aria-label="移动端主导航"><Navigation /></nav>
    </div>
  )
}
