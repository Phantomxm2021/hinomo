import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'

const { mockSignUp } = vi.hoisted(() => ({ mockSignUp: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signUp: mockSignUp } },
}))

describe('RegisterPage', () => {
  beforeEach(() => {
    mockSignUp.mockReset()
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
  })
  afterEach(cleanup)

  it('shows guidance and only enables registration for a valid complete form', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    const submitButton = screen.getByRole('button', { name: '注册' })
    expect(screen.getByPlaceholderText('怎么称呼你')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入邮箱地址')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入至少 8 位密码')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '《服务条款》' })).toHaveAttribute(
      'href',
      '/legal/terms?lang=zh-CN',
    )
    expect(screen.getByRole('link', { name: '《隐私政策》' })).toHaveAttribute(
      'href',
      '/legal/privacy?lang=zh-CN',
    )
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText('昵称'), '小诺')
    await user.type(screen.getByLabelText('邮箱'), 'not-an-email')
    await user.type(screen.getByLabelText('密码'), 'short')
    expect(submitButton).toBeDisabled()

    await user.clear(screen.getByLabelText('邮箱'))
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), '-password')
    expect(submitButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }))
    expect(submitButton).toBeEnabled()
  })

  it('registers and asks the user to verify their email', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('昵称'), ' 小诺 ')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'secure-password')
    await user.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }))
    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secure-password',
      options: {
        data: {
          display_name: '小诺',
          legal_acceptance: {
            terms_version: '2026-08-03',
            privacy_version: '2026-08-03',
            accepted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          },
        },
      },
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      '请查收验证邮件',
    )
  })

  it('keeps registration disabled when the nickname is missing', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'secure-password')
    await user.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }))

    expect(screen.getByRole('button', { name: '注册' })).toBeDisabled()
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})
