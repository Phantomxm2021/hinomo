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
    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secure-password',
      options: { data: { display_name: '小诺' } },
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      '请查收验证邮件',
    )
  })

  it('requires a nickname before registration', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'secure-password')
    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('请输入昵称')
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})
