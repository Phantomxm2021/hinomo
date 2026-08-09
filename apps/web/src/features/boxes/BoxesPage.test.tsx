import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useEffect, type PropsWithChildren } from 'react'
import { createMemoryRouter, RouterProvider, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxesPage } from './BoxesPage'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'

const {
  mockDeleteBox,
  mockGetVenueAccessSummary,
  mockGetBoxPlanSummary,
  mockListBoxes,
  mockListVenues,
  mockModalCleanupSawStatus,
  mockNotify,
  mockStartBoxUnlimitedCheckout,
} = vi.hoisted(() => ({
  mockDeleteBox: vi.fn(),
  mockGetVenueAccessSummary: vi.fn(),
  mockGetBoxPlanSummary: vi.fn(),
  mockListBoxes: vi.fn(),
  mockListVenues: vi.fn(),
  mockModalCleanupSawStatus: vi.fn(),
  mockNotify: vi.fn(),
  mockStartBoxUnlimitedCheckout: vi.fn(),
}))

const catalogueSpies = vi.hoisted(() => ({
  catalogueSpaces: vi.fn(),
  catalogueSummary: vi.fn(),
  filterBoxes: vi.fn(),
}))

vi.mock('./boxes.api', () => ({
  deleteBox: mockDeleteBox,
  listBoxesForVenue: mockListBoxes,
}))

vi.mock('../venues/venues.api', () => ({ listVenues: mockListVenues }))

vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}))

vi.mock('./box-entitlements.api', () => ({
  getVenueBoxPlanSummary: mockGetBoxPlanSummary,
  startBoxUnlimitedCheckout: mockStartBoxUnlimitedCheckout,
}))

vi.mock('../venues/venue-sharing.api', () => ({
  getVenueAccessSummary: mockGetVenueAccessSummary,
  isVenueAccessDenied: (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'venue_access_denied'),
  revokedVenueQueryKeys: [['venues'], ['venue-access'], ['spaces'], ['boxes'], ['box'], ['items'], ['search-items'], ['item-movements'], ['venue-activity'], ['box-plan']],
}))

vi.mock('../../components/mobile-feedback', () => ({
  useMobileFeedback: () => ({
    notify: mockNotify,
    showAlert: vi.fn(),
    showActionSheet: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

vi.mock('./box-catalogue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./box-catalogue')>()
  catalogueSpies.catalogueSpaces.mockImplementation(actual.catalogueSpaces)
  catalogueSpies.catalogueSummary.mockImplementation(actual.catalogueSummary)
  catalogueSpies.filterBoxes.mockImplementation(actual.filterBoxes)
  return { ...actual, ...catalogueSpies }
})

vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ objectKey, alt, className }: { objectKey: string; alt: string; className?: string }) => (
    <img src={`https://example.com/${objectKey}`} alt={alt} className={className} />
  ),
}))

vi.mock('./CreateBoxModal', async () => {
  const { useEffect } = await import('react')
  function MockCreateBoxModal({ open, onClose, onCompleted, onBusyChange, onLimitReached }: {
    open: boolean
    onClose: () => void
    onCompleted: (box: unknown) => void
    onBusyChange?: (busy: boolean) => void
    onLimitReached?: () => void
  }) {
    useEffect(() => {
      if (!open) return
      const appShell = document.querySelector('[data-app-shell]')
      appShell?.setAttribute('inert', '')
      appShell?.setAttribute('aria-hidden', 'true')
      return () => {
        mockModalCleanupSawStatus(Boolean(document.querySelector('[role="status"][aria-label="箱子已创建"]')))
        appShell?.removeAttribute('inert')
        appShell?.removeAttribute('aria-hidden')
      }
    }, [open])
    return open ? (
      <div role="dialog" aria-label="创建箱子">
        <button type="button" onClick={onClose}>关闭测试模态</button>
        <button type="button" onClick={() => onCompleted({ id: 'box-new', public_id: 'public-new', name: '书籍' })}>完成测试创建</button>
        <button type="button" onClick={() => onCompleted({ id: 'box-new', public_id: 'public-new', name: '待补封面' })}>暂不上传封面</button>
        <button type="button" onClick={() => onBusyChange?.(true)}>开始忙碌</button>
        <button type="button" onClick={() => onBusyChange?.(false)}>结束忙碌</button>
        <button type="button" onClick={() => onLimitReached?.()}>模拟额度竞态</button>
      </div>
    ) : null
  }
  return { CreateBoxModal: MockCreateBoxModal }
})

vi.mock('./EditBoxModal', () => ({
  EditBoxModal: ({ open, onClose, onBusyChange, onSaved }: { open: boolean; onClose: () => void; onBusyChange?: (busy: boolean) => void; onSaved?: () => void }) => open ? (
    <section role="dialog" aria-label="编辑箱子">
      <button type="button" onClick={() => onBusyChange?.(true)}>开始忙碌</button>
      <button type="button" onClick={() => onBusyChange?.(false)}>结束忙碌</button>
      <button type="button" onClick={() => onSaved?.()}>保存成功</button>
      <button type="button" onClick={onClose}>关闭编辑箱子</button>
    </section>
  ) : null,
}))

const boxes = [
  {
    id: 'box-1',
    public_id: 'public-1',
    box_code: 'BX-00001',
    name: '冬季衣物',
    space_id: 'space-1',
    space_name: '卧室',
    location: '衣柜上层',
    visibility: 'private',
    cover_object_key: 'users/u/boxes/box-1.webp',
    item_count: 8,
    updated_at: '2026-07-29T10:00:00Z',
  },
  {
    id: 'box-2',
    public_id: 'public-2',
    box_code: 'BX-00002',
    name: '露营用品',
    space_id: 'space-2',
    space_name: '储藏室',
    location: null,
    visibility: 'public',
    cover_object_key: null,
    item_count: 12,
    updated_at: '2026-07-28T10:00:00Z',
  },
]

function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  return (
    <>
      <output data-testid="location">{location.search}</output>
      <output data-testid="navigation-type">{navigationType}</output>
      <button type="button" onClick={() => navigate(-1)}>后退测试</button>
    </>
  )
}

function EnglishProvider({ children }: PropsWithChildren) {
  const { setLocale } = useI18n()
  useEffect(() => setLocale('en-US'), [setLocale])
  return <>{children}</>
}

function renderBoxes(initialEntry = '/app/boxes', locale: 'zh-CN' | 'en-US' = 'zh-CN', strict = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createMemoryRouter([{
    path: '/app/boxes',
    element: (
      <>
        <main data-app-shell />
        <BoxesPage />
        <LocationProbe />
      </>
    ),
  }], { initialEntries: [initialEntry] })
  const app = (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  const localizedApp = locale === 'en-US'
    ? <I18nProvider><EnglishProvider>{app}</EnglishProvider></I18nProvider>
    : app
  return {
    client,
    router,
    ...render(strict ? <StrictMode>{localizedApp}</StrictMode> : localizedApp),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

function primaryLinkNames() {
  return screen.getAllByRole('link', { name: /^打开/ }).map((link) => link.getAttribute('aria-label'))
}

let venueStorage: Map<string, string>

beforeEach(() => {
  venueStorage = new Map()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => venueStorage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { venueStorage.set(key, value) }),
    },
  })
  mockDeleteBox.mockReset()
  mockGetVenueAccessSummary.mockReset()
  mockGetBoxPlanSummary.mockReset()
  mockListBoxes.mockReset()
  mockListVenues.mockReset()
  mockNotify.mockReset()
  mockStartBoxUnlimitedCheckout.mockReset()
  mockGetBoxPlanSummary.mockResolvedValue({
    box_count: 2,
    free_limit: 3,
    unlimited_boxes: false,
    can_create: true,
  })
  mockGetVenueAccessSummary.mockResolvedValue({
    venue_id: 'venue-home', role: 'owner', can_delete_box: true, can_change_box_visibility: true,
  })
  mockListVenues.mockResolvedValue([
    { id: 'venue-home', name: '家里', description: null, is_default: true, space_count: 2 },
  ])
  mockModalCleanupSawStatus.mockReset()
  catalogueSpies.catalogueSpaces.mockClear()
  catalogueSpies.catalogueSummary.mockClear()
  catalogueSpies.filterBoxes.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

test('hydrates the space filter while ignoring a legacy search parameter', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?q=衣&space=space-1&sort=items')

  expect(await screen.findByRole('button', { name: '卧室 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('searchbox', { name: '搜索箱子' })).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toHaveAttribute('href', '/b/public-1')
  expect(screen.queryByRole('link', { name: '打开露营用品' })).not.toBeInTheDocument()
  expect(screen.getByText('显示 1 个')).toBeInTheDocument()
})

test('keeps creation available for a shared-venue member but directs a full plan to the owner', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  mockGetVenueAccessSummary.mockResolvedValue({
    venue_id: 'venue-home', role: 'member', can_delete_box: false, can_change_box_visibility: false,
  })
  mockGetBoxPlanSummary.mockResolvedValue({ box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false })
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  expect(screen.getByText('请联系场所所有者解锁')).toBeInTheDocument()
  expect(screen.queryByText('HK$38 永久解锁')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('button', { name: '编辑冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '删除冬季衣物' })).not.toBeInTheDocument()
})

test.each(['recent', 'items', 'unsupported'])('removes legacy sort=%s while preserving all other URL parameters', async (rawSort) => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes(`/app/boxes?q=%E8%A1%A3&space=space-1&sort=${rawSort}&create=1&panel=keep`)

  await screen.findByRole('dialog', { name: '创建箱子' })
  await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('sort='))
  expect(screen.getByTestId('location')).toHaveTextContent('q=%E8%A1%A3')
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-1')
  expect(screen.getByTestId('location')).toHaveTextContent('create=1')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
  expect(screen.getByTestId('location')).not.toHaveTextContent('sort=')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')

  await user.click(await screen.findByRole('button', { name: '卧室 1' }))
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-1')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
  expect(screen.getByTestId('location')).not.toHaveTextContent('sort=')
})

test('space chips preserve unknown URL parameters after legacy sort cleanup', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?q=%E7%94%A8%E5%93%81&sort=items&panel=keep')

  await screen.findByRole('link', { name: '打开露营用品' })
  await user.click(screen.getByRole('button', { name: '储藏室 1' }))

  expect(screen.getByTestId('location')).toHaveTextContent('q=%E7%94%A8%E5%93%81')
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-2')
  expect(screen.getByTestId('location')).not.toHaveTextContent('sort=')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')

  await user.click(screen.getByRole('button', { name: '全部空间 2' }))
  expect(screen.getByTestId('location')).not.toHaveTextContent('space=')
  expect(screen.getByTestId('location')).toHaveTextContent('q=%E7%94%A8%E5%93%81')
  expect(screen.getByTestId('location')).not.toHaveTextContent('sort=')
  expect(screen.getByTestId('location')).toHaveTextContent('panel=keep')
})

test('shows the global catalogue summary after loading', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1')

  expect(await screen.findByText('2 个箱子 · 20 件物品')).toBeInTheDocument()
  expect(screen.getByText('显示 1 个')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '全部箱子', level: 1 })).toBeInTheDocument()
  const title = screen.getByRole('heading', { name: '全部箱子', level: 1 })
  expect(within(title.parentElement!).getByText('家里')).toBeInTheDocument()
  expect(screen.getByText('收纳目录')).toBeInTheDocument()
})

test.each([
  [
    { box_count: 2, free_limit: 3, unlimited_boxes: false, can_create: true },
    '2 / 3 个免费箱子',
  ],
  [
    { box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false },
    '3 / 3 · 已达免费上限',
  ],
  [
    { box_count: 5, free_limit: 3, unlimited_boxes: false, can_create: false },
    '已有 5 个箱子 · 免费上限 3 个',
  ],
  [
    { box_count: 5, free_limit: 3, unlimited_boxes: true, can_create: true },
    '无限箱子 · 已永久解锁',
  ],
])('shows the account box-plan status %#', async (plan, expectedStatus) => {
  mockGetBoxPlanSummary.mockResolvedValue(plan)
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  expect(await screen.findByText(expectedStatus)).toBeInTheDocument()
})

test('pre-blocks a known full free account without changing the URL', async () => {
  const user = userEvent.setup()
  mockGetBoxPlanSummary.mockResolvedValue({
    box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false,
  })
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1')

  await screen.findByText('3 / 3 · 已达免费上限')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(screen.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?space=space-1')
})

test('opens creation directly for an unlimited account', async () => {
  const user = userEvent.setup()
  mockGetBoxPlanSummary.mockResolvedValue({
    box_count: 5, free_limit: 3, unlimited_boxes: true, can_create: true,
  })
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByText('无限箱子 · 已永久解锁')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).not.toBeInTheDocument()
})

test('allows creation while the plan summary is pending and relies on the create RPC', async () => {
  const user = userEvent.setup()
  mockGetBoxPlanSummary.mockReturnValue(new Promise(() => undefined))
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
})

test('layers the paywall over a preserved create form after a stale-summary limit rejection', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByText('2 / 3 个免费箱子')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  await user.click(screen.getByRole('button', { name: '模拟额度竞态' }))

  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')
})

test('shows only boxes from the venue restored from the dashboard selection', async () => {
  venueStorage.set('nomo-selected-venue-id:user-1', 'venue-office')
  mockListVenues.mockResolvedValue([
    { id: 'venue-home', name: '家里', description: null, is_default: true, space_count: 1 },
    { id: 'venue-office', name: '公司', description: null, is_default: false, space_count: 1 },
  ])
  mockListBoxes.mockResolvedValue([
    { ...boxes[0], venue_id: 'venue-home', venue_name: '家里' },
    { ...boxes[1], venue_id: 'venue-office', venue_name: '公司' },
  ])

  renderBoxes()

  expect(await screen.findByRole('link', { name: '打开露营用品' })).toBeInTheDocument()
  expect(mockListBoxes).toHaveBeenCalledWith('venue-office')
  expect(screen.queryByRole('link', { name: '打开冬季衣物' })).not.toBeInTheDocument()
  expect(screen.getByText('1 个箱子 · 12 件物品')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '全部空间 1' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '卧室 1' })).not.toBeInTheDocument()
})

test('shows a compact result count on mobile and keeps the desktop wording', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1')

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const resultStatus = screen.getByRole('status', { name: '显示 1 个箱子' })
  expect(screen.getByText('1 个', { selector: 'span' })).toHaveClass('sm:hidden')
  expect(screen.getByText('1 个', { selector: 'span' })).toHaveAttribute('aria-hidden', 'true')
  expect(screen.getByText('显示 1 个')).toHaveClass('hidden', 'sm:inline')
  expect(screen.getByText('显示 1 个')).toHaveAttribute('aria-hidden', 'true')
  expect(resultStatus).not.toHaveClass('hidden')
})

test('keeps rendered card links in API order', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?sort=items')

  await screen.findByRole('link', { name: '打开冬季衣物' })
  expect(primaryLinkNames()).toEqual(['打开冬季衣物', '打开露营用品'])
})

test('filters from chips and exposes cover, placeholder, and card metadata', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1')

  const winterCard = await screen.findByRole('article', { name: '冬季衣物' })
  expect(within(winterCard).getByRole('img', { name: '冬季衣物封面' })).toBeInTheDocument()
  expect(within(winterCard).getByText('BX-00001')).toBeInTheDocument()
  expect(within(winterCard).getByText('卧室 · 衣柜上层')).toBeInTheDocument()
  expect(within(winterCard).getByText('8 件物品')).toBeInTheDocument()
  expect(within(winterCard).getByText('私有')).toBeInTheDocument()
  expect(winterCard.parentElement).toHaveClass('grid-cols-1', 'min-[420px]:grid-cols-2', 'lg:grid-cols-3', '2xl:grid-cols-4')

  await user.click(screen.getByRole('button', { name: '储藏室 1' }))
  expect(screen.queryByRole('article', { name: '冬季衣物' })).not.toBeInTheDocument()
  const campingCard = screen.getByRole('article', { name: '露营用品' })
  expect(within(campingCard).getByRole('img', { name: '箱子封面占位图' })).toBeInTheDocument()
  expect(within(campingCard).getByText('储藏室 · 未填写位置')).toBeInTheDocument()
  expect(within(campingCard).getByText('12 件物品')).toBeInTheDocument()
  expect(within(campingCard).getByText('公开')).toBeInTheDocument()
})

test('keeps only one catalogue card menu open', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '编辑冬季衣物' }))
  expect(screen.getByRole('dialog', { name: '编辑箱子' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '全部箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?edit=box-1')
  await user.click(screen.getByRole('button', { name: '关闭编辑箱子' }))

  await user.click(screen.getByRole('button', { name: '管理露营用品' }))
  expect(screen.queryByRole('button', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '编辑露营用品' })).toBeInTheDocument()
})

test('blocks browser back while box editing is busy, then resumes after save work ends', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  const { router } = renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '编辑冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '开始忙碌' }))
  await act(async () => { await router.navigate(-1) })

  expect(screen.getByRole('dialog', { name: '编辑箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?edit=box-1')

  await user.click(screen.getByRole('button', { name: '结束忙碌' }))
  await act(async () => { await router.navigate(-1) })
  expect(screen.queryByRole('dialog', { name: '编辑箱子' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('')
})

test('closes the edit dialog after save completion waits for busy state to clear', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '编辑冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '开始忙碌' }))
  await user.click(screen.getByRole('button', { name: '保存成功' }))

  expect(screen.getByRole('dialog', { name: '编辑箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?edit=box-1')
  await user.click(screen.getByRole('button', { name: '结束忙碌' }))

  await waitFor(() => expect(screen.queryByRole('dialog', { name: '编辑箱子' })).not.toBeInTheDocument())
  expect(screen.getByTestId('location')).toHaveTextContent('')
})

test('does not recompute catalogue derivations for menu and mutation rerenders', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  mockDeleteBox.mockReturnValue(new Promise(() => {}))
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const callsAfterLoad = {
    spaces: catalogueSpies.catalogueSpaces.mock.calls.length,
    summary: catalogueSpies.catalogueSummary.mock.calls.length,
    visible: catalogueSpies.filterBoxes.mock.calls.length,
  }

  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '确认删除' }))
  await screen.findByRole('button', { name: '处理中…' })

  expect(catalogueSpies.catalogueSpaces).toHaveBeenCalledTimes(callsAfterLoad.spaces)
  expect(catalogueSpies.catalogueSummary).toHaveBeenCalledTimes(callsAfterLoad.summary)
  expect(catalogueSpies.filterBoxes).toHaveBeenCalledTimes(callsAfterLoad.visible)
})

test('does not close an open card menu when only a legacy sort parameter changes', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  const { router } = renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('button', { name: '编辑冬季衣物' })).toBeInTheDocument()

  await act(async () => { await router.navigate('/app/boxes?sort=items') })
  await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('sort='))
  expect(screen.getByRole('button', { name: '编辑冬季衣物' })).toBeInTheDocument()
})

test('keeps a restored card menu closed after the space filter changes through history', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  const { router } = renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('button', { name: '编辑冬季衣物' })).toBeInTheDocument()

  await act(async () => { await router.navigate('/app/boxes?space=space-2') })
  expect(await screen.findByRole('link', { name: '打开露营用品' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '打开冬季衣物' })).not.toBeInTheDocument()
  await act(async () => { await router.navigate(-1) })

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '管理冬季衣物' })).toHaveAttribute('aria-expanded', 'false')
})

test('distinguishes a true empty catalogue from filtered no-match results', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  const firstView = renderBoxes('/app/boxes?space=missing&sort=items&panel=keep')

  expect(await screen.findByText('没有匹配的箱子')).toBeInTheDocument()
  expect(screen.queryByText('还没有箱子')).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: '创建箱子' })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: '清除筛选' }))

  expect(screen.getByTestId('location')).toHaveTextContent('?panel=keep')
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开露营用品' })).toBeInTheDocument()
  firstView.unmount()

  mockListBoxes.mockResolvedValue([])
  renderBoxes()
  expect(await screen.findByText('还没有箱子')).toBeInTheDocument()
  expect(screen.queryByText('没有匹配的箱子')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox', { name: '搜索箱子' })).not.toBeInTheDocument()
  await user.click(screen.getAllByRole('button', { name: '创建箱子' }).at(-1)!)
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
})

test('routes creation to the space prerequisite when the selected venue has no spaces', async () => {
  const user = userEvent.setup()
  mockListVenues.mockResolvedValue([
    { id: 'venue-home', name: '家里', description: null, is_default: true, space_count: 0 },
  ])
  mockListBoxes.mockResolvedValue([])
  const { router } = renderBoxes()

  await screen.findByText('还没有箱子')
  await user.click(screen.getAllByRole('button', { name: '创建箱子' }).at(-1)!)

  await waitFor(() => expect(router.state.location.pathname).toBe('/app/spaces'))
  expect(router.state.location.search).toBe('?create=1&from=box')
  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
})

test('opens creation from the URL and closes it without losing catalogue state', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?space=space-1&create=1')

  expect(await screen.findByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '关闭测试模态' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?space=space-1')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('REPLACE')
})

test('closes, refreshes, announces success, renders the new card, and restores focus after creation completes', async () => {
  const user = userEvent.setup()
  const newBox = {
    id: 'box-new', public_id: 'public-new', box_code: 'BX-00003', name: '书籍',
    space_id: 'space-1', space_name: '卧室', location: null, visibility: 'private',
    cover_object_key: null, item_count: 0, updated_at: '2026-07-30T10:00:00Z',
  }
  mockListBoxes.mockResolvedValueOnce(boxes).mockResolvedValueOnce([newBox, ...boxes])
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const createButton = screen.getByRole('button', { name: '创建箱子' })
  const title = screen.getByRole('heading', { name: '全部箱子', level: 1 })
  expect(title.parentElement).toHaveTextContent('家里')
  expect(title.parentElement?.parentElement).toContainElement(createButton)
  expect(title.parentElement?.parentElement).toHaveClass('flex', 'items-center', 'justify-between')
  expect(createButton).toHaveClass('size-11', 'shrink-0', 'bg-brand')
  expect(createButton).not.toHaveClass('w-full')
  expect(createButton).toHaveTextContent('')
  expect(createButton).toHaveAttribute('title', '创建箱子')
  await user.click(createButton)
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')
  expect(screen.getByTestId('navigation-type')).toHaveTextContent('PUSH')
  await user.click(screen.getByRole('button', { name: '开始忙碌' }))
  await user.click(screen.getByRole('button', { name: '完成测试创建' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(await screen.findByRole('article', { name: '书籍' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: '箱子已创建' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '记录箱内物品' })).toHaveAttribute('href', '/b/public-new')
  expect(mockModalCleanupSawStatus).toHaveBeenCalledWith(false)
  expect(document.querySelector('[data-app-shell]')).not.toHaveAttribute('inert')
  expect(document.querySelector('[data-app-shell]')).not.toHaveAttribute('aria-hidden')
  await waitFor(() => expect(createButton).toHaveFocus())
  expect(mockListBoxes).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(mockGetBoxPlanSummary).toHaveBeenCalledTimes(2))
})

test('keeps the creation next step visible long enough to act on it', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?create=1')
  await screen.findByRole('dialog', { name: '创建箱子' })
  vi.useFakeTimers()

  fireEvent.click(screen.getByRole('button', { name: '完成测试创建' }))
  await act(async () => { await Promise.resolve() })
  expect(screen.getByRole('status', { name: '箱子已创建' })).toBeInTheDocument()

  act(() => { vi.advanceTimersByTime(12_000) })
  expect(screen.queryByRole('status', { name: '箱子已创建' })).not.toBeInTheDocument()
  vi.useRealTimers()
})

test('closes and renders the created card when finishing without a cover', async () => {
  const user = userEvent.setup()
  const newBox = {
    id: 'box-new', public_id: 'public-new', box_code: 'BX-00003', name: '待补封面',
    space_id: 'space-1', space_name: '卧室', location: null, visibility: 'private',
    cover_object_key: null, item_count: 0, updated_at: '2026-07-30T10:00:00Z',
  }
  mockListBoxes.mockResolvedValueOnce(boxes).mockResolvedValueOnce([newBox, ...boxes])
  renderBoxes('/app/boxes?create=1')

  await user.click(await screen.findByRole('button', { name: '开始忙碌' }))
  await user.click(screen.getByRole('button', { name: '暂不上传封面' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(await screen.findByRole('article', { name: '待补封面' })).toBeInTheDocument()
  expect(mockListBoxes).toHaveBeenCalledTimes(2)
})

test('clears an earlier success status when starting another creation', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?create=1')

  await user.click(await screen.findByRole('button', { name: '完成测试创建' }))
  await screen.findByRole('status', { name: '箱子已创建' })
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: '箱子已创建' })).not.toBeInTheDocument()
})

test('lets browser back close a modal opened from the list and restores focus', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '后退测试' }))

  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(screen.getByTestId('location')).toBeEmptyDOMElement()
  await waitFor(() => expect(screen.getByRole('button', { name: '创建箱子' })).toHaveFocus())
})

test('blocks browser back while creation is busy', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  await user.click(screen.getByRole('button', { name: '开始忙碌' }))
  await user.click(screen.getByRole('button', { name: '后退测试' }))

  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('?create=1')

  await user.click(screen.getByRole('button', { name: '结束忙碌' }))
  await user.click(screen.getByRole('button', { name: '后退测试' }))
  expect(screen.queryByRole('dialog', { name: '创建箱子' })).not.toBeInTheDocument()
})

test('cleans a canceled purchase return and announces the cancellation', async () => {
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?purchase=canceled&session_id=cs_cancel_123&space=space-1')

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?space=space-1'))
  expect(screen.getByTestId('location')).not.toHaveTextContent('purchase=')
  expect(screen.getByTestId('location')).not.toHaveTextContent('session_id=')
  expect(mockNotify).toHaveBeenCalledWith('已取消购买无限箱子')
})

test('opens creation after a successful purchase return confirms the entitlement', async () => {
  mockGetBoxPlanSummary.mockResolvedValue({
    box_count: 3, free_limit: 3, unlimited_boxes: true, can_create: true,
  })
  mockListBoxes.mockResolvedValue(boxes)
  const { client } = renderBoxes('/app/boxes?purchase=success&session_id=cs_success_123&space=space-1')
  const invalidateQueries = vi.spyOn(client, 'invalidateQueries')

  expect(await screen.findByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('space=space-1')
  expect(screen.getByTestId('location')).toHaveTextContent('create=1')
  expect(screen.getByTestId('location')).not.toHaveTextContent('purchase=')
  expect(screen.getByTestId('location')).not.toHaveTextContent('session_id=')
  expect(mockNotify).toHaveBeenCalledWith('无限箱子已永久解锁')
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['boxes'] })
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['box-plan'] })
})

test('restarts purchase confirmation after the StrictMode effect cleanup', async () => {
  const freePlan = { box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false }
  const unlimitedPlan = { ...freePlan, unlimited_boxes: true, can_create: true }
  const initialPlan = deferred<typeof freePlan>()
  mockGetBoxPlanSummary.mockReturnValueOnce(initialPlan.promise).mockResolvedValue(unlimitedPlan)
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?purchase=success', 'zh-CN', true)

  expect(mockGetBoxPlanSummary).toHaveBeenCalledTimes(1)
  vi.useFakeTimers()
  await act(async () => { initialPlan.resolve(freePlan) })
  await act(async () => { await vi.advanceTimersByTimeAsync(1_500) })

  expect(mockGetBoxPlanSummary.mock.calls.length).toBeGreaterThanOrEqual(2)
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
})

test('bounds purchase confirmation to eight refetches and offers a manual recheck', async () => {
  const freePlan = { box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false }
  const initialPlan = deferred<typeof freePlan>()
  mockGetBoxPlanSummary
    .mockReturnValueOnce(initialPlan.promise)
    .mockResolvedValue(freePlan)
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes('/app/boxes?purchase=success&session_id=cs_pending_123')

  expect(mockGetBoxPlanSummary).toHaveBeenCalledTimes(1)
  vi.useFakeTimers()
  await act(async () => { initialPlan.resolve(freePlan) })
  expect(screen.getByRole('status', { name: '正在确认付款，请稍候' })).toHaveTextContent('正在确认付款，请稍候')
  expect(screen.getByRole('status', { name: '正在确认付款，请稍候' })).not.toHaveTextContent('支付已完成')
  for (let attempt = 1; attempt < 8; attempt += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500) })
  }

  expect(mockGetBoxPlanSummary).toHaveBeenCalledTimes(9)
  expect(screen.getByRole('status', { name: '付款正在确认' })).toHaveTextContent('付款正在确认')
  expect(screen.getByRole('status', { name: '付款正在确认' })).toHaveTextContent('付款状态仍在确认中，请稍后再检查。')
  expect(screen.getByRole('status', { name: '付款正在确认' })).toHaveTextContent('Checkout Session ID：cs_pending_123')
  const createButton = screen.getByRole('button', { name: '创建箱子' })
  expect(createButton).toBeDisabled()
  fireEvent.click(createButton)
  expect(screen.queryByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).not.toBeInTheDocument()
  const recheck = screen.getByRole('button', { name: '重新检查' })
  fireEvent.click(recheck)
  await act(async () => { await Promise.resolve() })
  expect(mockGetBoxPlanSummary).toHaveBeenCalledTimes(10)
  expect(screen.getByTestId('location')).toHaveTextContent('purchase=success')
  expect(screen.queryByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).not.toBeInTheDocument()
})

test('keeps checkout busy until navigation and shows a retryable billing error without closing the form', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  mockStartBoxUnlimitedCheckout
    .mockRejectedValueOnce(new Error('billing_unavailable'))
    .mockReturnValueOnce(new Promise(() => undefined))
  renderBoxes('/app/boxes?create=1')

  await user.click(await screen.findByRole('button', { name: '模拟额度竞态' }))
  await user.click(screen.getByRole('button', { name: 'HK$38 永久解锁' }))

  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent('暂时无法连接支付服务，请稍后重试')
  expect(mockNotify).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).toBeInTheDocument()

  await user.click(within(error).getByRole('button', { name: '重试' }))
  expect(await screen.findByRole('button', { name: '购买中…' })).toBeDisabled()
  expect(mockStartBoxUnlimitedCheckout).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
})

test('refreshes an already-owned entitlement and resumes creation instead of showing a billing error', async () => {
  const user = userEvent.setup()
  const fullPlan = { box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false }
  const unlimitedPlan = { box_count: 3, free_limit: 3, unlimited_boxes: true, can_create: true }
  mockGetBoxPlanSummary.mockResolvedValueOnce(fullPlan).mockResolvedValue(unlimitedPlan)
  mockStartBoxUnlimitedCheckout.mockRejectedValue(new Error('entitlement_already_owned'))
  mockListBoxes.mockResolvedValue(boxes)
  renderBoxes()

  await screen.findByText('3 / 3 · 已达免费上限')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  await user.click(screen.getByRole('button', { name: 'HK$38 永久解锁' }))

  expect(await screen.findByRole('dialog', { name: '创建箱子' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: '免费版最多可保有 3 个箱子' })).not.toBeInTheDocument()
  expect(screen.queryByText('暂时无法连接支付服务，请稍后重试')).not.toBeInTheDocument()
  expect(mockNotify).toHaveBeenCalledWith('你已拥有无限箱子权益')
})

test('removes a deleted box and closes the dialog before catalogue revalidation finishes', async () => {
  const user = userEvent.setup()
  let resolveRefetch!: (value: typeof boxes) => void
  mockListBoxes
    .mockResolvedValueOnce(boxes)
    .mockReturnValueOnce(new Promise((resolve) => { resolveRefetch = resolve }))
  mockDeleteBox.mockResolvedValue(undefined)
  const { client } = renderBoxes()

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toHaveAttribute('href', '/b/public-1')
  const stableCreateAction = screen.getByRole('button', { name: '创建箱子' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  expect(screen.getByRole('button', { name: '编辑冬季衣物' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  expect(screen.queryByRole('button', { name: '编辑冬季衣物' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteBox).toHaveBeenCalledWith('box-1')
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('link', { name: '打开冬季衣物' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开露营用品' })).toBeInTheDocument()
  expect(client.getQueryData(['boxes', 'venue-home'])).toEqual([boxes[1]])
  await waitFor(() => expect(stableCreateAction).toHaveFocus())
  expect(mockListBoxes).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(mockGetBoxPlanSummary).toHaveBeenCalledTimes(2))

  await act(async () => { resolveRefetch([boxes[1]]) })
})

test('shows a toolbar and six-card skeleton until the catalogue request resolves', async () => {
  let resolveBoxes!: (value: typeof boxes) => void
  mockListBoxes.mockReturnValue(new Promise((resolve) => { resolveBoxes = resolve }))
  renderBoxes()

  const loading = screen.getByRole('status', { name: '正在加载箱子目录' })
  const visualLayout = loading.querySelector(':scope > [aria-hidden="true"]')
  expect(visualLayout).toHaveClass('grid', 'gap-5')
  const cardGrid = Array.from(visualLayout?.children ?? []).find((child) => child.classList.contains('lg:grid-cols-3'))
  expect(cardGrid).toHaveClass('grid', 'min-[420px]:grid-cols-2')
  expect(cardGrid?.children).toHaveLength(6)
  expect(Array.from(cardGrid?.children ?? []).every((card) => card.querySelector('[data-testid="skeleton"]'))).toBe(true)
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox', { name: '搜索箱子' })).not.toBeInTheDocument()

  await act(async () => { resolveBoxes(boxes) })

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByText('正在加载箱子…')).not.toBeInTheDocument()
})

test('keeps real catalogue content visible without skeletons during a background refetch', async () => {
  const refresh = deferred<typeof boxes>()
  mockListBoxes.mockResolvedValueOnce(boxes).mockReturnValueOnce(refresh.promise)
  const { client } = renderBoxes()

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  act(() => { void client.invalidateQueries({ queryKey: ['boxes'] }) })

  await waitFor(() => expect(mockListBoxes).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('searchbox', { name: '搜索箱子' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: '正在加载箱子目录' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument()

  await act(async () => { refresh.resolve(boxes) })
})

test('retries a failed catalogue load', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce(boxes)
  renderBoxes()

  expect(await screen.findByRole('alert')).toHaveTextContent('箱子加载失败，请重试')
  await user.click(screen.getByRole('button', { name: '重试' }))

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
})

test('keeps the stale catalogue available when a background refetch fails', async () => {
  const user = userEvent.setup()
  mockListBoxes
    .mockResolvedValueOnce(boxes)
    .mockRejectedValueOnce(new Error('refetch failed'))
    .mockResolvedValueOnce(boxes)
  const { client } = renderBoxes('/app/boxes?space=space-1')

  expect(await screen.findByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  await act(async () => { await client.invalidateQueries({ queryKey: ['boxes'] }) })

  const refetchAlert = await screen.findByRole('alert')
  expect(refetchAlert).toHaveTextContent('箱子刷新失败，正在显示上次结果')
  expect(screen.getByText('2 个箱子 · 20 件物品')).toBeInTheDocument()
  expect(screen.queryByRole('searchbox', { name: '搜索箱子' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '卧室 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('link', { name: '打开冬季衣物' })).toBeInTheDocument()
  expect(screen.queryByText('箱子加载失败，请重试')).not.toBeInTheDocument()

  await user.click(within(refetchAlert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(screen.queryByText('箱子刷新失败，正在显示上次结果')).not.toBeInTheDocument())
})

test('keeps a failed delete inline and restores focus to its card trigger on cancel', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  mockDeleteBox.mockRejectedValue(new Error('delete failed'))
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  const winterTrigger = screen.getByRole('button', { name: '管理冬季衣物' })
  await user.click(winterTrigger)
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))

  const dialog = screen.getByRole('alertdialog', { name: '删除“冬季衣物”？' })
  await waitFor(() => expect(within(dialog).getByRole('button', { name: '取消' })).toHaveFocus())
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('删除失败，请稍后重试')
  expect(within(dialog).getByRole('button', { name: '确认删除' })).toBeEnabled()
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: '取消' }))

  await waitFor(() => expect(winterTrigger).toHaveFocus())

  await user.click(screen.getByRole('button', { name: '管理露营用品' }))
  await user.click(screen.getByRole('button', { name: '删除露营用品' }))
  expect(within(screen.getByRole('alertdialog')).queryByRole('alert')).not.toBeInTheDocument()
})

test('retries a failed inline deletion', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValueOnce([boxes[0]]).mockResolvedValueOnce([])
  mockDeleteBox.mockRejectedValueOnce(new Error('delete failed')).mockResolvedValueOnce(undefined)
  renderBoxes()

  await screen.findByRole('link', { name: '打开冬季衣物' })
  await user.click(screen.getByRole('button', { name: '管理冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  const dialog = screen.getByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: '确认删除' }))
  await within(dialog).findByRole('alert')

  await user.click(within(dialog).getByRole('button', { name: '确认删除' }))

  expect(mockDeleteBox).toHaveBeenCalledTimes(2)
  expect(await screen.findByText('还没有箱子')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('renders the boxes empty state and create CTA in English', async () => {
  mockListBoxes.mockResolvedValue([])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{
    path: '/app/boxes',
    element: <><main data-app-shell /><BoxesPage /><LocationProbe /></>,
  }], { initialEntries: ['/app/boxes'] })
  render(<I18nProvider><EnglishProvider><QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider></EnglishProvider></I18nProvider>)

  expect(await screen.findByRole('heading', { name: 'No boxes yet' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Create box' }).length).toBeGreaterThan(0)
})

test('localizes box deletion confirmation and errors in English', async () => {
  const user = userEvent.setup()
  mockListBoxes.mockResolvedValue(boxes)
  mockDeleteBox.mockRejectedValue(new Error('delete failed'))
  renderBoxes('/app/boxes', 'en-US')

  await screen.findByRole('link', { name: 'Open 冬季衣物' })
  await user.click(screen.getByRole('button', { name: 'Manage 冬季衣物' }))
  await user.click(screen.getByRole('button', { name: 'Delete 冬季衣物' }))

  const dialog = screen.getByRole('alertdialog', { name: 'Delete “冬季衣物”?' })
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Confirm delete' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not delete. Please try again later.')
})
