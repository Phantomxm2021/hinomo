import type { Session } from '@supabase/supabase-js'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { AuthContext } from './auth-context'
import { ResetPasswordPage } from './ResetPasswordPage'

const { mockCompletePasswordRecovery, mockUpdateUser, storeSnapshot } =
  vi.hoisted(() => ({
    mockCompletePasswordRecovery: vi.fn(),
    mockUpdateUser: vi.fn(),
    storeSnapshot: {
      session: null,
      loading: false,
      isPasswordRecovery: false,
    },
  }))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { updateUser: mockUpdateUser } },
}))

vi.mock('./auth-session-store', () => ({
  completePasswordRecovery: mockCompletePasswordRecovery,
  getAuthSessionSnapshot: () => storeSnapshot,
  subscribeAuthSession: () => () => undefined,
}))

function renderReset(
  session: Session | null,
  isPasswordRecovery = false,
) {
  const router = createMemoryRouter(
    [
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/app', element: <h1>我的收纳</h1> },
    ],
    { initialEntries: ['/reset-password'] },
  )
  render(
    <AuthProvider
      session={session}
      isPasswordRecovery={isPasswordRecovery}
    >
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

function renderLoadingReset() {
  const router = createMemoryRouter(
    [{ path: '/reset-password', element: <ResetPasswordPage /> }],
    { initialEntries: ['/reset-password'] },
  )
  render(
    <AuthContext.Provider value={{ session: null, loading: true, isPasswordRecovery: false }}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset()
    mockCompletePasswordRecovery.mockReset()
    mockUpdateUser.mockResolvedValue({ data: {}, error: null })
  })
  afterEach(cleanup)

  it('shows a form skeleton while the recovery link is validated', () => {
    renderLoadingReset()

    expect(screen.getByRole('status', { name: '正在验证重置链接' })).toBeInTheDocument()
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(2)
    expect(screen.queryByText('正在验证重置链接…')).not.toBeInTheDocument()
  })

  it('updates the password for a recovery session', async () => {
    const user = userEvent.setup()
    renderReset({ access_token: 'recovery-token' } as Session, true)

    const submitButton = screen.getByRole('button', { name: '保存新密码' })
    expect(screen.getByRole('main')).toHaveClass('auth-page', 'text-body')
    expect(screen.getByPlaceholderText('请输入至少 8 位密码')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请再次输入新密码')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText('新密码'), 'new-password')
    await user.type(screen.getByLabelText('确认新密码'), 'new-password')
    expect(submitButton).toBeEnabled()
    await user.click(submitButton)

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-password' })
    expect(mockCompletePasswordRecovery).toHaveBeenCalledOnce()
    expect(
      await screen.findByRole('heading', { name: '我的收纳' }),
    ).toBeInTheDocument()
  })

  it('rejects an ordinary authenticated session without updating the user', () => {
    renderReset({ access_token: 'ordinary-token' } as Session, false)

    expect(screen.getByRole('alert')).toHaveTextContent(
      '重置链接无效或已过期',
    )
    expect(
      screen.queryByRole('button', { name: '保存新密码' }),
    ).not.toBeInTheDocument()
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('rejects a reset page without a recovery session', () => {
    renderReset(null)

    expect(screen.getByRole('alert')).toHaveTextContent(
      '重置链接无效或已过期',
    )
    expect(
      screen.queryByRole('button', { name: '保存新密码' }),
    ).not.toBeInTheDocument()
  })
})
