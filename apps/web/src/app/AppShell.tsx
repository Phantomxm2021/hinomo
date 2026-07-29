import {
  Link,
  NavLink,
  Outlet,
  type NavLinkRenderProps,
} from 'react-router-dom'
import { AppIcon, type AppIconName } from '../components/AppIcon'

type NavigationItem = {
  to: string
  label: string
  icon: AppIconName
  end?: boolean
  className?: string
}

const desktopNavigation: NavigationItem[] = [
  { to: '/app', label: '今日收纳', icon: 'home', end: true },
  { to: '/app/spaces', label: '我的空间', icon: 'space' },
  { to: '/app/boxes', label: '全部箱子', icon: 'box' },
  { to: '/app/search', label: '查找物品', icon: 'search' },
  { to: '/app/print', label: '打印标签', icon: 'print' },
]

const mobileNavigation: NavigationItem[] = [
  { to: '/app', label: '首页', icon: 'home', end: true },
  { to: '/app/spaces', label: '空间', icon: 'space' },
  { to: '/app/scan', label: '扫码', icon: 'scan', className: 'mobile-scan-action' },
  { to: '/app/boxes', label: '箱子', icon: 'box' },
  { to: '/app/search', label: '搜索', icon: 'search' },
]

function Navigation({ items }: { items: NavigationItem[] }) {
  return items.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      aria-label={item.label}
      className={({ isActive }: NavLinkRenderProps) =>
        [item.className, isActive ? 'active' : undefined].filter(Boolean).join(' ')
      }
    >
      <span className="nav-icon"><AppIcon name={item.icon} /></span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  ))
}

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <Link className="brand" to="/app">Nomo</Link>
          <small>智能收纳清单</small>
        </div>
        <nav aria-label="主导航"><Navigation items={desktopNavigation} /></nav>
        <p className="sidebar-footer">我的收纳空间</p>
      </aside>
      <main className="app-content"><Outlet /></main>
      <nav className="mobile-nav" aria-label="移动端主导航"><Navigation items={mobileNavigation} /></nav>
    </div>
  )
}
