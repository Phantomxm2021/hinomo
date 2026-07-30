import {
  Link,
  NavLink,
  Outlet,
  type NavLinkRenderProps,
} from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppIcon, type AppIconName } from '../components/AppIcon'
import { UserAccountMenu } from '../features/profile/UserAccountMenu'

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
          'flex items-center gap-2.5 rounded-control no-underline',
          mobile
            ? 'flex-col justify-center gap-0.5 p-1 text-center text-xs'
            : 'px-2 py-2.5 text-body',
          isActive
            ? mobile
              ? 'active font-extrabold text-brand-strong'
              : 'active bg-surface font-bold text-ink'
            : 'font-medium text-muted hover:bg-surface/60 hover:text-ink',
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
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="min-h-dvh bg-canvas text-left text-ink" data-app-shell>
      {!online ? (
        <p className="fixed inset-x-3 top-3 z-50 m-0 rounded-control bg-ink px-4 py-2 text-center text-sm font-bold text-white shadow-float lg:left-[calc(15rem+0.75rem)]" role="status">
          当前离线，部分操作可能不可用
        </p>
      ) : null}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-10 overflow-y-auto border-r border-line bg-sidebar px-6 py-8 lg:flex">
        <div className="grid gap-0.5">
          <Link className="flex w-fit items-center gap-2 text-2xl font-black tracking-[-0.05em] text-ink no-underline" to="/app">
            <span className="grid size-10 place-items-center rounded-control bg-brand text-2xl font-black tracking-normal text-white" aria-hidden="true">N</span>
            Nomo
          </Link>
        </div>
        <nav className="grid gap-2" aria-label="主导航"><Navigation items={desktopNavigation} /></nav>
        <UserAccountMenu />
      </aside>
      <header className="flex items-center justify-between px-5 pt-5 lg:hidden" role="banner">
        <span className="flex items-center gap-2 text-xl font-black tracking-[-0.05em] text-ink">
          <span className="grid size-9 place-items-center rounded-control bg-brand text-xl font-black tracking-normal text-white" aria-hidden="true">N</span>
          Nomo
        </span>
        <Link
          className="grid size-11 place-items-center rounded-full border border-line bg-surface text-muted shadow-soft"
          to="/app/spaces"
          aria-label="我的收纳空间"
          title="我的收纳空间"
        >
          <AppIcon name="space" size={20} />
        </Link>
      </header>
      <main className="min-w-0 px-5 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:ml-60 lg:px-[clamp(1.75rem,4vw,4rem)] lg:pt-10 lg:pb-16"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid min-h-18 grid-cols-5 border-t border-line bg-surface/95 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-float backdrop-blur lg:hidden" aria-label="移动端主导航"><Navigation items={mobileNavigation} mobile /></nav>
    </div>
  )
}
