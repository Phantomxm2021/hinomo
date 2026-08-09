import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from '../features/auth/AuthProvider'
import { GeneralSettingsPage } from '../features/profile/GeneralSettingsPage'
import { SettingsPage } from '../features/profile/SettingsPage'
import { I18nProvider, useI18n } from '../i18n/I18nProvider'
import { AppShell } from './AppShell'

const { mockGetAvatarDownload, mockGetProfile } = vi.hoisted(() => ({
  mockGetAvatarDownload: vi.fn(),
  mockGetProfile: vi.fn(),
}))

const originalMatchMedia = window.matchMedia

vi.mock('../features/profile/profile.api', () => ({
  getProfile: mockGetProfile,
  getAvatarDownload: mockGetAvatarDownload,
  updateLocale: vi.fn(),
  uploadAvatar: vi.fn(),
}))

beforeEach(() => {
  mockGetProfile.mockReset().mockResolvedValue({ id: 'user-1', display_name: '林家', avatar_object_key: null, locale: 'zh-CN' })
  mockGetAvatarDownload.mockReset().mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
})

test('announces offline state and clears it when connectivity returns', () => {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true)
  renderShell()
  expect(screen.queryByText('当前离线，部分操作可能不可用')).not.toBeInTheDocument()

  act(() => window.dispatchEvent(new Event('offline')))
  expect(screen.getByRole('status', { name: '' })).toHaveTextContent('当前离线，部分操作可能不可用')

  act(() => window.dispatchEvent(new Event('online')))
  expect(screen.queryByText('当前离线，部分操作可能不可用')).not.toBeInTheDocument()
  vi.restoreAllMocks()
})

function LocaleTestControl() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en-US')}>切换语言</button>
}

function renderShell(initialEntry = '/app', options?: { withLocaleControl?: boolean }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider session={{ user: { id: 'user-1', email: 'lin@example.com', user_metadata: { display_name: '林家' } } } as unknown as Session}>
            {options?.withLocaleControl ? <LocaleTestControl /> : null}
            <Routes>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<p>内容</p>} />
                <Route path="*" element={<p>内容</p>} />
              </Route>
            </Routes>
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nProvider>,
  )
}

function mockDesktopViewport() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function RouteProbe() {
  return <output data-testid="route-path">{useLocation().pathname}</output>
}

test('keeps language selection inside settings instead of the desktop sidebar', async () => {
  const user = userEvent.setup()
  renderShell()

  const sidebar = screen.getByRole('complementary')
  expect(within(sidebar).queryByRole('combobox', { name: '语言' })).not.toBeInTheDocument()

  await user.click(await screen.findByRole('button', { name: '打开账户菜单' }))
  expect(screen.getByRole('button', { name: '打开账户菜单' })).toHaveAttribute('data-settings-return-focus')
  expect(screen.getByRole('menuitem', { name: /设置/ })).toHaveAttribute('type', 'button')
})

test('opens desktop settings in place without changing the route and restores the account trigger after close', async () => {
  mockDesktopViewport()
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/app']}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider session={{ user: { id: 'user-1', email: 'lin@example.com', user_metadata: { display_name: '林家' } } } as unknown as Session}>
            <Routes>
              <Route path="/app" element={<AppShell />}>
                <Route index element={<RouteProbe />} />
                <Route path="me/settings" element={<SettingsPage />} />
                <Route path="me/settings/general" element={<GeneralSettingsPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nProvider>,
  )

  const accountTrigger = await screen.findByRole('button', { name: '打开账户菜单' })
  await user.click(accountTrigger)
  await user.click(screen.getByRole('menuitem', { name: /设置/ }))
  expect(await screen.findByRole('dialog', { name: '设置' })).toBeInTheDocument()
  expect(screen.getByTestId('route-path')).toHaveTextContent('/app')

  await user.click(screen.getByRole('button', { name: '关闭设置' }))
  await waitFor(() => expect(accountTrigger).toHaveFocus())
})

test('restores the General link after closing the real nested settings route', async () => {
  mockDesktopViewport()
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/app/me/settings']}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider session={{ user: { id: 'user-1', email: 'lin@example.com', user_metadata: { display_name: '林家' } } } as unknown as Session}>
            <Routes>
              <Route path="/app" element={<AppShell />}>
                <Route path="me/settings" element={<SettingsPage />} />
                <Route path="me/settings/general" element={<GeneralSettingsPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nProvider>,
  )

  await user.click(await screen.findByRole('link', { name: /通用.*语言与地区/ }))
  expect(await screen.findByRole('dialog', { name: '通用' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭通用' }))

  const generalLink = await screen.findByRole('link', { name: /通用.*语言与地区/ })
  await waitFor(() => expect(generalLink).toHaveFocus())
})

test('provides the complete desktop navigation without a scan destination', async () => {
  renderShell()

  const navigation = screen.getByRole('navigation', { name: '主导航' })
  const links = within(navigation).getAllByRole('link')

  expect(links.map((link) => link.textContent)).toEqual([
    '今日收纳',
    '空间',
    '全部箱子',
    '查找物品',
    '打印标签',
  ])
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/app',
    '/app/spaces',
    '/app/boxes',
    '/app/search',
    '/app/print',
  ])
  expect(within(navigation).queryByRole('link', { name: '扫码' })).not.toBeInTheDocument()
  const desktopBrand = within(screen.getByRole('complementary')).getByRole('link', { name: 'Nomo' })
  expect(desktopBrand).toHaveAttribute('href', '/app')
  expect(desktopBrand.querySelector('img')).toHaveAttribute('src', '/brand/nomo-apple-icon-v2-192.png')
  expect(await screen.findByText('林家')).toBeInTheDocument()
  expect(screen.getByText('lin@example.com')).toBeInTheDocument()
  expect(screen.getByRole('complementary')).toHaveClass('lg:flex')
  expect(screen.getByRole('main')).toHaveClass('lg:ml-60', 'lg:px-[clamp(1.75rem,4vw,4rem)]')
  expect(within(navigation).getByRole('link', { name: '今日收纳' })).toHaveClass(
    'bg-surface',
    'font-bold',
    'text-body',
    'text-ink',
  )
  expect(within(navigation).getByRole('link', { name: '空间' })).toHaveClass(
    'font-medium',
    'text-body',
    'text-muted',
  )
})

test('keeps the approved central mobile scan action', () => {
  renderShell()

  const navigation = screen.getByRole('navigation', { name: '移动端主导航' })
  const links = within(navigation).getAllByRole('link')

  expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
    '首页',
    '空间',
    '扫码',
    '箱子',
    '我的',
  ])
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/app',
    '/app/spaces',
    '/app/scan',
    '/app/boxes',
    '/app/me',
  ])
  expect(within(navigation).getByRole('link', { name: '扫码' })).toHaveClass('mobile-scan-action', '-translate-y-[18px]')
  expect(navigation).toHaveClass(
    'lg:hidden',
    'border-line/80',
    'pb-[max(0.35rem,var(--safe-area-bottom))]',
    'backdrop-blur-xl',
  )
})

test('opens real account actions and read-only profile details', async () => {
  const user = userEvent.setup()
  renderShell()
  await user.click(await screen.findByRole('button', { name: '打开账户菜单' }))
  expect(screen.getByRole('menu')).toHaveClass('fixed', 'z-[60]')
  expect(screen.getByRole('menuitem', { name: /账户信息/ })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /设置/ })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /退出登录/ })).toBeInTheDocument()
  await user.click(screen.getByRole('menuitem', { name: /账户信息/ }))
  expect(screen.getByRole('dialog', { name: '账户信息' })).toBeInTheDocument()
  expect(screen.getByLabelText('昵称')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('邮箱')).toHaveAttribute('readonly')
})

test('uses the avatar itself as the upload control with a hover cover', async () => {
  const user = userEvent.setup()
  renderShell()
  await user.click(await screen.findByRole('button', { name: '打开账户菜单' }))
  await user.click(screen.getByRole('menuitem', { name: /账户信息/ }))

  const upload = screen.getByLabelText('更换头像')
  const avatarControl = upload.closest('label')
  const cover = screen.getByText('更换头像')

  expect(avatarControl).toHaveClass('group', 'relative', 'rounded-full')
  expect(cover).toHaveClass('absolute', 'opacity-0', 'group-hover:opacity-100')
})

test('does not render a global brand header on mobile', () => {
  renderShell()

  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Nomo' })).toHaveLength(1)
  expect(within(screen.getByRole('complementary')).getByRole('link', { name: 'Nomo' })).toHaveAttribute('href', '/app')
})

test('keeps mobile content narrow-safe with responsive gutters and nav clearance', () => {
  renderShell()

  expect(screen.getByRole('main')).toHaveClass(
    'min-w-0',
    'px-4',
    'min-[360px]:px-5',
    'pt-[max(1rem,var(--safe-area-top))]',
    'pb-[calc(8rem+var(--safe-area-bottom))]',
    'lg:px-[clamp(1.75rem,4vw,4rem)]',
  )
  expect(screen.getByRole('navigation', { name: '移动端主导航' })).toHaveClass(
    'pb-[max(0.35rem,var(--safe-area-bottom))]',
  )
})

test('marks the central mobile scan action active on the scan route', () => {
  renderShell('/app/scan')

  const navigation = screen.getByRole('navigation', { name: '移动端主导航' })
  const scanLink = within(navigation).getByRole('link', { name: '扫码' })

  expect(scanLink).toHaveClass('mobile-scan-action', 'active')
  expect(scanLink).toHaveAttribute('aria-current', 'page')
  expect(within(navigation).getByRole('link', { name: '首页' })).not.toHaveAttribute('aria-current')
})

test('keeps the boxes destination active on nested box routes', () => {
  renderShell('/app/boxes/new')

  const navigation = screen.getByRole('navigation', { name: '移动端主导航' })
  const boxesLink = within(navigation).getByRole('link', { name: '箱子' })

  expect(boxesLink).toHaveClass('active')
  expect(boxesLink).toHaveAttribute('aria-current', 'page')
  expect(within(navigation).getByRole('link', { name: '扫码' })).not.toHaveAttribute('aria-current')
})

test('switches desktop and mobile navigation copy when the global locale changes', async () => {
  const user = userEvent.setup()
  renderShell('/app', { withLocaleControl: true })

  await user.click(screen.getByRole('button', { name: '切换语言' }))

  expect(within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('link', { name: 'Today' })).toBeInTheDocument()
  expect(within(screen.getByRole('navigation', { name: 'Mobile primary navigation' })).getByRole('link', { name: 'Home' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Open account menu' })).toBeInTheDocument()
})
