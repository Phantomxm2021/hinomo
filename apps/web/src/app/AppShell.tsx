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
  { to: '/app/scan', label: '扫码', icon: 'scan', className: 'mobile-scan-action -translate-y-[18px]' },
  { to: '/app/boxes', label: '箱子', icon: 'box' },
  { to: '/app/search', label: '搜索', icon: 'search' },
]

function Navigation({ items, mobile = false }: { items: NavigationItem[]; mobile?: boolean }) {
  return items.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      aria-label={item.label}
      className={({ isActive }: NavLinkRenderProps) =>
        [
          item.className,
          'flex items-center gap-2.5 rounded-control text-muted no-underline',
          mobile
            ? 'flex-col justify-center gap-0.5 p-1 text-center text-xs'
            : 'px-2 py-2.5',
          isActive
            ? mobile
              ? 'active font-extrabold text-brand-strong'
              : 'active bg-brand/10 font-extrabold text-brand-strong'
            : 'hover:bg-surface/60 hover:text-ink',
        ].filter(Boolean).join(' ')
      }
    >
      <span className={[
        'grid place-items-center',
        item.className
          ? 'h-14 w-14 rounded-full bg-brand text-white shadow-float [.active_&]:ring-4 [.active_&]:ring-brand/15'
          : undefined,
      ].filter(Boolean).join(' ')}><AppIcon name={item.icon} /></span>
      <span className={item.className ? 'text-ink' : undefined}>{item.label}</span>
    </NavLink>
  ))
}

export function AppShell() {
  return (
    <div className="app-shell min-h-dvh bg-canvas text-left text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-10 overflow-y-auto border-r border-line bg-sidebar px-6 py-8 lg:flex">
        <div className="grid gap-0.5">
          <Link className="w-fit text-2xl font-black tracking-[-0.05em] text-ink no-underline" to="/app">Nomo</Link>
          <small>智能收纳清单</small>
        </div>
        <nav className="grid gap-2" aria-label="主导航"><Navigation items={desktopNavigation} /></nav>
        <p className="mt-auto text-sm text-muted">我的收纳空间</p>
      </aside>
      <main className="min-w-0 px-5 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:ml-60 lg:px-10 lg:pt-10 lg:pb-16 xl:px-16"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid min-h-18 grid-cols-5 border-t border-line/80 bg-surface/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-soft backdrop-blur-lg lg:hidden" aria-label="移动端主导航"><Navigation items={mobileNavigation} mobile /></nav>
    </div>
  )
}
