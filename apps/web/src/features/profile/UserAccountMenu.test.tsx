import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../auth/auth-context'
import { UserAccountMenu } from './UserAccountMenu'

const { mockGetAvatarDownload, mockGetProfile } = vi.hoisted(() => ({
  mockGetAvatarDownload: vi.fn(),
  mockGetProfile: vi.fn(),
}))

vi.mock('./profile.api', () => ({
  getAvatarDownload: mockGetAvatarDownload,
  getProfile: mockGetProfile,
  updateLocale: vi.fn(),
  uploadAvatar: vi.fn(),
}))
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { signOut: vi.fn() } } }))

afterEach(cleanup)
beforeEach(() => {
  mockGetAvatarDownload.mockReset()
  mockGetProfile.mockReset()
})

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{
          session: { user: { id: 'user-1', email: 'user@example.com' } } as Session,
          loading: false,
          isPasswordRecovery: false,
        }}>
          <UserAccountMenu />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
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

test('falls back to session data after a profile error', async () => {
  mockGetProfile.mockRejectedValue(new Error('network'))
  renderMenu()

  expect(await screen.findByText('user')).toBeInTheDocument()
  expect(screen.getByText('user@example.com')).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: '正在加载账户资料' })).not.toBeInTheDocument()
})
