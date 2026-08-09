import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { AccountDetailsPage } from './AccountDetailsPage'

const { mockGetAvatarDownload, mockGetProfile, mockUploadAvatar } = vi.hoisted(() => ({
  mockGetAvatarDownload: vi.fn(),
  mockGetProfile: vi.fn(),
  mockUploadAvatar: vi.fn(),
}))

vi.mock('./profile.api', () => ({
  getAvatarDownload: mockGetAvatarDownload,
  getProfile: mockGetProfile,
  uploadAvatar: mockUploadAvatar,
}))

beforeEach(() => {
  mockGetProfile.mockReset().mockResolvedValue({
    id: 'user-1', display_name: '林家', avatar_object_key: null, locale: 'zh-CN',
  })
  mockGetAvatarDownload.mockReset().mockResolvedValue(null)
  mockUploadAvatar.mockReset().mockResolvedValue('blob:avatar')
})
afterEach(cleanup)

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <MobileFeedbackProvider><QueryClientProvider client={client}>
        <AuthContext.Provider value={{
          session: { user: { id: 'user-1', email: 'lin@example.com', user_metadata: { display_name: '林家' } } } as unknown as Session,
          loading: false,
          isPasswordRecovery: false,
        }}>
          <AccountDetailsPage />
        </AuthContext.Provider>
      </QueryClientProvider></MobileFeedbackProvider>
    </MemoryRouter>,
  )
}

test('keeps avatar editing and read-only identity on the account details page', async () => {
  renderPage()

  const navigation = screen.getByRole('navigation', { name: '账户信息导航' })
  expect(navigation).toHaveClass('sticky', 'grid', 'grid-cols-[6rem_minmax(0,1fr)_6rem]', 'lg:hidden')
  expect(within(navigation).getByRole('button', { name: '返回' })).toBeInTheDocument()
  expect(await screen.findByLabelText('更换头像')).toBeInTheDocument()
  expect(screen.getByLabelText('昵称')).toHaveValue('林家')
  expect(screen.getByLabelText('昵称')).toHaveAttribute('readonly')
  expect(screen.getByLabelText('邮箱')).toHaveValue('lin@example.com')
  expect(screen.getByLabelText('邮箱')).toHaveAttribute('readonly')
})

test('uploads an avatar from the account details page', async () => {
  const user = userEvent.setup()
  renderPage()
  const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

  await user.upload(await screen.findByLabelText('更换头像'), file)

  await waitFor(() => expect(mockUploadAvatar.mock.calls[0]?.[0]).toBe(file))
})

test('reports avatar upload failures through the global Apple feedback', async () => {
  const user = userEvent.setup()
  mockUploadAvatar.mockRejectedValue(new Error('upload failed'))
  renderPage()
  const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

  await user.upload(await screen.findByLabelText('更换头像'), file)

  expect(await screen.findByRole('alertdialog', { name: '操作未完成' })).toHaveTextContent('头像上传失败，请重试')
})
