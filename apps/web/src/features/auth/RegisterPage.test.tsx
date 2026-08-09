import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider, type InitialEntry } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { LEGAL_POLICY_VERSION } from '../legal/legal-policy'
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

  function renderRegister(returnTo?: string) {
    const entry: InitialEntry = returnTo ? { pathname: '/register', state: { returnTo } } : '/register'
    const router = createMemoryRouter([
      { path: '/register', element: <RegisterPage /> },
      { path: '/join/venue', element: <h1>加入场地</h1> },
      { path: '/app', element: <h1>我的收纳</h1> },
      { path: '/login', element: <h1>登录页</h1> },
    ], { initialEntries: [entry] })
    render(<I18nProvider><RouterProvider router={router} /></I18nProvider>)
    return router
  }

  it('shows guidance and only enables registration for a valid complete form', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </I18nProvider>,
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
      <I18nProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </I18nProvider>,
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
            terms_version: LEGAL_POLICY_VERSION,
            privacy_version: LEGAL_POLICY_VERSION,
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
      <I18nProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'secure-password')
    await user.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }))

    expect(screen.getByRole('button', { name: '注册' })).toBeDisabled()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('preserves the venue return target for the sign-in link and an immediate session', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    renderRegister('/join/venue')

    expect(screen.getByRole('link', { name: '返回登录' })).toHaveAttribute('href', '/login')
    await user.type(screen.getByLabelText('昵称'), '小诺')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'secure-password')
    await user.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }))
    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(await screen.findByRole('heading', { name: '加入场地' })).toBeInTheDocument()
  })

  it('rejects an unsafe registration return target', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null })
    renderRegister('//evil.example')
    await user.type(screen.getByLabelText('昵称'), '小诺')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'secure-password')
    await user.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }))
    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(await screen.findByRole('heading', { name: '我的收纳' })).toBeInTheDocument()
  })
})
