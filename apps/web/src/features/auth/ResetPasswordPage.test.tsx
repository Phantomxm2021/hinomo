import type { Session } from '@supabase/supabase-js'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { ResetPasswordPage } from './ResetPasswordPage'

const { mockUpdateUser } = vi.hoisted(() => ({ mockUpdateUser: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { updateUser: mockUpdateUser } },
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

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockUpdateUser.mockReset()
    mockUpdateUser.mockResolvedValue({ data: {}, error: null })
  })
  afterEach(cleanup)

  it('updates the password for a recovery session', async () => {
    const user = userEvent.setup()
    renderReset({ access_token: 'recovery-token' } as Session, true)

    await user.type(screen.getByLabelText('新密码'), 'new-password')
    await user.type(screen.getByLabelText('确认新密码'), 'new-password')
    await user.click(screen.getByRole('button', { name: '保存新密码' }))

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-password' })
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
