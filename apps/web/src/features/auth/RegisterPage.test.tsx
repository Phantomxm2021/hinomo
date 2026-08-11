import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider, type InitialEntry } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { LEGAL_POLICY_VERSION } from '../legal/legal-policy'
import { RegisterPage } from './RegisterPage'

const { mockSignUp, mockCaptureGrowthEvent, mockIdentifyAnalyticsUser } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockCaptureGrowthEvent: vi.fn(),
  mockIdentifyAnalyticsUser: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signUp: mockSignUp } },
}))

vi.mock('../../lib/analytics', () => ({
  captureGrowthEvent: mockCaptureGrowthEvent,
  identifyAnalyticsUser: mockIdentifyAnalyticsUser,
}))

function installStorage() {
  const values = new Map<string, string>()
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    clear: () => { values.clear() },
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
}

describe('RegisterPage', () => {
  beforeEach(() => {
    installStorage()
    mockSignUp.mockReset()
    mockCaptureGrowthEvent.mockReset()
    mockIdentifyAnalyticsUser.mockReset()
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    window.localStorage.setItem('nomo-locale', 'zh-CN')
  })
  afterEach(cleanup)

  function renderRegister(returnTo?: string, search = '') {
    const entry: InitialEntry = returnTo
      ? { pathname: '/register', search, state: { returnTo } }
      : `/register${search}`
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
    expect(screen.getByRole('checkbox', { name: '接收整理建议和一次性创始人优惠。我可以随时停止接收这些邮件。' })).toBeInTheDocument()
    expect(screen.getByRole('main')).not.toHaveTextContent(/订阅|取消订阅/)
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
    expect(screen.getByRole('checkbox', { name: /接收整理建议/ })).not.toBeChecked()
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
          growth_contact_opt_in_at: null,
          signup_campaign: 'organic',
        },
      },
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      '请查收验证邮件',
    )
  })

  it('records opted-in three-box campaign signup without blocking registration', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('nomo-locale', 'en-US')
    mockSignUp.mockResolvedValue({ data: { user: { id: 'user-123' }, session: null }, error: null })
    renderRegister(undefined, '?campaign=three_box_reset')

    const contactOptIn = screen.getByRole('checkbox', { name: 'Email me setup tips and the one-time founder offer. I can stop receiving these emails at any time.' })
    expect(contactOptIn).not.toBeChecked()
    expect(screen.getByRole('main')).not.toHaveTextContent(/subscription|unsubscribe/i)
    await user.type(screen.getByLabelText('Nickname'), 'Nomo')
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'secure-password')
    await user.click(screen.getByRole('checkbox', { name: /I have read and agree/ }))
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeEnabled()
    await user.click(contactOptIn)
    await user.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
      options: { data: expect.objectContaining({
        signup_campaign: 'three_box_reset',
        growth_contact_opt_in_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }) },
    }))
    expect(mockIdentifyAnalyticsUser).toHaveBeenCalledWith('user-123')
    expect(mockCaptureGrowthEvent).toHaveBeenCalledWith('signup_completed', {
      campaign: 'three_box_reset', language: 'en-US', contact_opt_in: true,
    })
  })

  it('treats unknown campaigns as organic and records no optional contact consent', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ data: { user: { id: 'user-456' }, session: null }, error: null })
    renderRegister(undefined, '?campaign=untrusted')

    await user.type(screen.getByLabelText('昵称'), '小诺')
    await user.type(screen.getByLabelText('邮箱'), 'new@example.com')
    await user.type(screen.getByLabelText('密码'), 'secure-password')
    await user.click(screen.getByRole('checkbox', { name: /我已阅读并同意/ }))
    await user.click(screen.getByRole('button', { name: '注册' }))

    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
      options: { data: expect.objectContaining({
        signup_campaign: 'organic',
        growth_contact_opt_in_at: null,
      }) },
    }))
    expect(mockCaptureGrowthEvent).toHaveBeenCalledWith('signup_completed', {
      campaign: 'organic', language: 'zh-CN', contact_opt_in: false,
    })
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
