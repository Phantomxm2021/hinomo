import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useI18n } from '../../i18n/I18nProvider'
import { MyPage } from './MyPage'

const { mockGetAvatarDownload, mockGetProfile, mockSignOut, mockUpdateLocale, mockUploadAvatar, mockGetCreditSummary } = vi.hoisted(() => ({
  mockGetAvatarDownload: vi.fn(),
  mockGetProfile: vi.fn(),
  mockSignOut: vi.fn(),
  mockUpdateLocale: vi.fn(),
  mockUploadAvatar: vi.fn(),
  mockGetCreditSummary: vi.fn(),
}))

vi.mock('./profile.api', () => ({
  getAvatarDownload: mockGetAvatarDownload,
  getProfile: mockGetProfile,
  updateLocale: mockUpdateLocale,
  uploadAvatar: mockUploadAvatar,
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: mockSignOut } } }))
vi.mock('../credits/credits.api', () => ({ getCreditSummary: mockGetCreditSummary }))

beforeEach(() => {
  mockGetProfile.mockReset().mockResolvedValue({
    id: 'user-1', display_name: '林家', avatar_object_key: null, locale: 'zh-CN',
  })
  mockGetAvatarDownload.mockReset().mockResolvedValue(null)
  mockUpdateLocale.mockReset().mockResolvedValue(undefined)
  mockUploadAvatar.mockReset().mockResolvedValue('blob:avatar')
  mockSignOut.mockReset().mockResolvedValue({ error: null })
  mockGetCreditSummary.mockReset().mockResolvedValue({ credits_available: 0, credits_reserved: 0 })
})
afterEach(cleanup)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <AuthContext.Provider value={{
            session: { user: { id: 'user-1', email: 'lin@example.com', user_metadata: { display_name: '林家' } } } as unknown as Session,
            loading: false,
            isPasswordRecovery: false,
          }}>
            <LocaleControl />
            <MyPage />
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nProvider>,
  )
}

function LocaleControl() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en-US')}>English</button>
}

test('uses skeletons until the profile is ready', () => {
  mockGetProfile.mockReturnValue(new Promise(() => undefined))
  renderPage()

  expect(screen.getByRole('status', { name: '正在加载我的资料' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(4)
})

test('shows an email summary that opens the account details page', async () => {
  renderPage()

  const accountLink = await screen.findByRole('link', { name: /林家.*lin@example.com/ })
  expect(accountLink).toHaveAttribute('href', '/app/me/account')
  expect(screen.queryByLabelText('更换头像')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('昵称')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('邮箱')).not.toBeInTheDocument()
})

test('opens the AI credit store from the account summary', async () => {
  renderPage()

  const creditLink = await screen.findByRole('link', { name: /AI 点数.*0 点数/ })
  expect(creditLink).toHaveAttribute('href', '/app/me/credits')
})

test('localizes the credit summary when the global locale switches', async () => {
  const user = userEvent.setup()
  renderPage()

  await screen.findByText('AI 拍照识别与智能清单')
  await user.click(screen.getByRole('button', { name: 'English' }))

  expect(await screen.findByText('AI photo recognition and smart lists')).toBeInTheDocument()
  expect(screen.getByText('0 credits')).toBeInTheDocument()
})

test('moves preferences into the settings hierarchy', async () => {
  renderPage()

  await screen.findByRole('link', { name: /林家.*lin@example.com/ })
  expect(screen.getByRole('link', { name: /设置.*通用、语言与地区/ })).toHaveAttribute('href', '/app/me/settings')
  expect(screen.queryByLabelText('语言')).not.toBeInTheDocument()
})

test('uses native-style grouped rows for the mobile preferences page', async () => {
  renderPage()

  await screen.findByRole('link', { name: /林家.*lin@example.com/ })
  const preferencesGroup = screen.getByRole('group', { name: '设置' })
  const accountActionGroup = screen.getByRole('group', { name: '账户操作' })

  expect(preferencesGroup).toHaveClass('rounded-card', 'bg-surface', 'overflow-hidden')
  expect(accountActionGroup).toHaveClass('rounded-card', 'bg-surface', 'overflow-hidden')
  expect(screen.getByRole('link', { name: /林家.*lin@example.com/ })).toHaveClass('rounded-card', 'bg-surface')
})

test('requires confirmation before signing out', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: '退出登录' }))
  expect(mockSignOut).not.toHaveBeenCalled()
  expect(screen.getByRole('alertdialog', { name: '退出登录？' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '确认退出' }))
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
})
