import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useI18n } from '../../i18n/I18nProvider'
import { UserAccountMenu } from './UserAccountMenu'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'

const { mockGetAvatarDownload, mockGetCreditSummary, mockGetProfile, mockUploadAvatar, mockSignOut } = vi.hoisted(() => ({
  mockGetAvatarDownload: vi.fn(),
  mockGetCreditSummary: vi.fn(),
  mockGetProfile: vi.fn(),
  mockUploadAvatar: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock('./profile.api', () => ({
  getAvatarDownload: mockGetAvatarDownload,
  getProfile: mockGetProfile,
  updateLocale: vi.fn(),
  uploadAvatar: mockUploadAvatar,
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: mockSignOut } } }))
vi.mock('../credits/credits.api', () => ({ getCreditSummary: mockGetCreditSummary }))

afterEach(cleanup)
beforeEach(() => {
  mockGetAvatarDownload.mockReset()
  mockGetCreditSummary.mockReset().mockResolvedValue({ credits_available: 82, credits_reserved: 3 })
  mockGetProfile.mockReset()
  mockUploadAvatar.mockReset().mockResolvedValue('blob:avatar')
  mockSignOut.mockReset().mockResolvedValue(undefined)
})

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nProvider><MobileFeedbackProvider>
      <MemoryRouter>
        <QueryClientProvider client={client}>
        <AuthContext.Provider value={{
            session: { user: { id: 'user-1', email: 'user@example.com' } } as Session,
            loading: false,
            isPasswordRecovery: false,
        }}>
          <LocaleControl />
          <UserAccountMenu />
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    </MobileFeedbackProvider></I18nProvider>,
  )
}

function LocaleControl() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en-US')}>English</button>
}

test('shows an avatar and two text skeletons while the profile loads', () => {
  mockGetProfile.mockReturnValue(new Promise(() => undefined))
  renderMenu()

  expect(screen.getByRole('status', { name: '正在加载账户资料' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton')).toHaveLength(3)
  expect(screen.getByText('user@example.com')).toBeInTheDocument()
  expect(screen.queryByText('user')).not.toBeInTheDocument()
})

test('keeps the account skeleton visible while an existing avatar is authorized', async () => {
  mockGetProfile.mockResolvedValue({
    id: 'user-1', display_name: '小诺', avatar_object_key: 'avatars/user-1.webp', locale: 'zh-CN',
  })
  mockGetAvatarDownload.mockReturnValue(new Promise(() => undefined))
  renderMenu()

  expect(await screen.findByRole('status', { name: '正在加载账户资料' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton')).toHaveLength(3)
  expect(screen.queryByText('小诺')).not.toBeInTheDocument()
})

test('shows real profile data and keeps the account dialog available after loading', async () => {
  const user = userEvent.setup()
  mockGetProfile.mockResolvedValue({
    id: 'user-1', display_name: '小诺', avatar_object_key: null, locale: 'zh-CN',
  })
  renderMenu()

  expect(await screen.findByText('小诺')).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: '正在加载账户资料' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '打开账户菜单' }))
  await user.click(screen.getByRole('menuitem', { name: '账户信息' }))
  expect(screen.getByRole('dialog', { name: '账户信息' })).toBeInTheDocument()
  expect(screen.getByDisplayValue('小诺')).toBeInTheDocument()
})

test('makes the credit balance and store available from the desktop account menu', async () => {
  const user = userEvent.setup()
  mockGetProfile.mockResolvedValue({
    id: 'user-1', display_name: '小诺', avatar_object_key: null, locale: 'zh-CN',
  })
  renderMenu()

  expect(await screen.findByText('82 AI 点数')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '打开账户菜单' }))
  expect(screen.getByRole('menuitem', { name: 'AI 点数，82 点数，购买额度' })).toHaveAttribute('href', '/app/me/credits')
})

test('localizes credit store copy when the global locale switches', async () => {
  const user = userEvent.setup()
  mockGetProfile.mockResolvedValue({
    id: 'user-1', display_name: '小诺', avatar_object_key: null, locale: 'zh-CN',
  })
  renderMenu()

  await screen.findByText('82 AI 点数')
  await user.click(screen.getByRole('button', { name: '打开账户菜单' }))
  expect(screen.getByText('一次购买 · 不自动续费')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'English' }))

  expect(await screen.findByText('One-time purchase · No auto-renewal')).toBeInTheDocument()
  expect(screen.getByText('Available balance')).toBeInTheDocument()
})

test('falls back to session data after a profile error', async () => {
  mockGetProfile.mockRejectedValue(new Error('network'))
  renderMenu()

  expect(await screen.findByText('user')).toBeInTheDocument()
  expect(screen.getByText('user@example.com')).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: '正在加载账户资料' })).not.toBeInTheDocument()
})

test('reports avatar upload failures through the global Apple feedback', async () => {
  const user = userEvent.setup()
  mockGetProfile.mockResolvedValue({
    id: 'user-1', display_name: '小诺', avatar_object_key: null, locale: 'zh-CN',
  })
  mockUploadAvatar.mockRejectedValue(new Error('upload failed'))
  renderMenu()

  await screen.findByText('小诺')
  await user.click(screen.getByRole('button', { name: '打开账户菜单' }))
  await user.click(screen.getByRole('menuitem', { name: '账户信息' }))
  await user.upload(screen.getByLabelText('更换头像'), new File(['avatar'], 'avatar.png', { type: 'image/png' }))

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('头像上传失败，请重试')
})

test('reports sign-out failures through the global Apple feedback', async () => {
  const user = userEvent.setup()
  mockGetProfile.mockResolvedValue({
    id: 'user-1', display_name: '小诺', avatar_object_key: null, locale: 'zh-CN',
  })
  mockSignOut.mockResolvedValue({ error: new Error('sign out failed') })
  renderMenu()

  await screen.findByText('小诺')
  await user.click(screen.getByRole('button', { name: '打开账户菜单' }))
  await user.click(screen.getByRole('menuitem', { name: '退出登录' }))

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('暂时无法完成此操作，请稍后再试')
})
