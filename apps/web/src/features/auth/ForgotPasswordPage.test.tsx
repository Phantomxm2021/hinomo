import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const { mockResetPasswordForEmail } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
}))

vi.mock('../../lib/env', () => ({
  env: { VITE_PUBLIC_APP_ORIGIN: 'https://nomo.example/' },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { resetPasswordForEmail: mockResetPasswordForEmail },
  },
}))

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockReset()
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  })
  afterEach(cleanup)

  it('requests a recovery email with the configured redirect URL', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('邮箱'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: '发送重置邮件' }))

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: 'https://nomo.example/reset-password' },
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      '如果该邮箱已注册',
    )
  })
})
