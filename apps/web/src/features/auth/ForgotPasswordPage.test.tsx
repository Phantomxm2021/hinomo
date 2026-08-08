import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { ForgotPasswordPage } from './ForgotPasswordPage'

const { mockResetPasswordForEmail } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
}))

vi.mock('../../lib/env', () => ({
  env: { VITE_PUBLIC_APP_ORIGIN: 'https://nomo.example/' },
  publicAppOrigin: () => 'https://nomo.example',
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

  it('uses the shared auth form and requires a valid email', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByRole('main')).toHaveClass('auth-page', 'text-body')
    expect(screen.getByPlaceholderText('请输入邮箱地址')).toBeInTheDocument()
    expect(screen.queryByText('想起密码了？')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回登录' })).toHaveAttribute('href', '/login')
    const submitButton = screen.getByRole('button', { name: '发送重置邮件' })
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText('邮箱'), 'not-an-email')
    expect(submitButton).toBeDisabled()
    await user.clear(screen.getByLabelText('邮箱'))
    await user.type(screen.getByLabelText('邮箱'), 'user@example.com')
    expect(submitButton).toBeEnabled()
  })

  it('requests a recovery email with the configured redirect URL', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>
      </I18nProvider>,
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
