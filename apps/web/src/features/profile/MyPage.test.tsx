import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { MyPage } from './MyPage'

const { mockGetAvatarDownload, mockGetProfile, mockSignOut, mockUpdateLocale, mockUploadAvatar } = vi.hoisted(() => ({
  mockGetAvatarDownload: vi.fn(),
  mockGetProfile: vi.fn(),
  mockSignOut: vi.fn(),
  mockUpdateLocale: vi.fn(),
  mockUploadAvatar: vi.fn(),
}))

vi.mock('./profile.api', () => ({
  getAvatarDownload: mockGetAvatarDownload,
  getProfile: mockGetProfile,
  updateLocale: mockUpdateLocale,
  uploadAvatar: mockUploadAvatar,
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: mockSignOut } } }))

beforeEach(() => {
  mockGetProfile.mockReset().mockResolvedValue({
    id: 'user-1', display_name: '林家', avatar_object_key: null, locale: 'zh-CN',
  })
  mockGetAvatarDownload.mockReset().mockResolvedValue(null)
  mockUpdateLocale.mockReset().mockResolvedValue(undefined)
  mockUploadAvatar.mockReset().mockResolvedValue('blob:avatar')
  mockSignOut.mockReset().mockResolvedValue({ error: null })
})
afterEach(cleanup)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{
          session: { user: { id: 'user-1', email: 'lin@example.com', user_metadata: { display_name: '林家' } } } as unknown as Session,
          loading: false,
          isPasswordRecovery: false,
        }}>
          <MyPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
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

test('updates locale through the profile API', async () => {
  const user = userEvent.setup()
  renderPage()

  await screen.findByRole('link', { name: /林家.*lin@example.com/ })

  await user.selectOptions(screen.getByLabelText('语言'), 'en-US')
  await waitFor(() => expect(mockUpdateLocale.mock.calls[0]?.[0]).toBe('en-US'))
  expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('设置已保存')
})

test('uses native-style grouped rows for the mobile preferences page', async () => {
  renderPage()

  await screen.findByRole('link', { name: /林家.*lin@example.com/ })
  const preferencesGroup = screen.getByRole('group', { name: '偏好设置' })
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
