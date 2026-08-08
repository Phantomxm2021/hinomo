import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createMemoryRouter,
  RouterProvider,
  type InitialEntry,
} from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import { LoginPage } from './LoginPage'

const { mockSignInWithPassword } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  },
}))

function LocaleControls() {
  const { setLocale } = useI18n()
  return <button type="button" onClick={() => setLocale('en-US')}>English</button>
}

function renderLogin(returnTo?: string) {
  const entry: InitialEntry = returnTo
    ? { pathname: '/login', state: { returnTo } }
    : '/login'
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/app/boxes', element: <h1>箱子</h1> },
      { path: '/app', element: <h1>我的收纳</h1> },
    ],
    { initialEntries: [entry] },
  )

  render(
    <I18nProvider>
      <LocaleControls />
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return router
}

async function submitValidCredentials() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('邮箱'), 'user@example.com')
  await user.type(screen.getByLabelText('密码'), 'correct-password')
  await user.click(screen.getByRole('button', { name: '登录' }))
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset()
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    })
  })

  afterEach(cleanup)

  it('uses the shared semantic typography classes', () => {
    renderLogin()

    expect(screen.getByRole('main')).toHaveClass('text-body')
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'zh-CN')
    expect(screen.getByRole('heading', { name: '欢迎回来' })).toHaveClass('text-page-title', 'font-extrabold')
  })

  it('only enables login for valid complete credentials', async () => {
    const user = userEvent.setup()
    renderLogin()

    const submitButton = screen.getByRole('button', { name: '登录' })
    expect(screen.getByPlaceholderText('请输入邮箱地址')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入至少 8 位密码')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByLabelText('邮箱'), 'invalid-email')
    await user.type(screen.getByLabelText('密码'), 'short')
    expect(submitButton).toBeDisabled()

    await user.clear(screen.getByLabelText('邮箱'))
    await user.type(screen.getByLabelText('邮箱'), 'user@example.com')
    await user.type(screen.getByLabelText('密码'), '-password')
    expect(submitButton).toBeEnabled()
  })

  it('signs in and returns to the requested page', async () => {
    renderLogin('/app/boxes')

    await submitValidCredentials()

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct-password',
    })
    expect(await screen.findByRole('heading', { name: '箱子' })).toBeInTheDocument()
  })

  it('refreshes touched field validation when the global locale changes', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText('邮箱'), 'not-an-email')
    expect(await screen.findByText('请输入有效的邮箱地址')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  })

  it('shows a Chinese error without leaking the raw auth error', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    })
    renderLogin()

    await submitValidCredentials()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('邮箱或密码不正确')
    expect(alert).not.toHaveTextContent('Invalid login credentials')
  })

  it('refreshes a submitted auth error when the global locale changes', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    })
    renderLogin()

    await submitValidCredentials()
    expect(await screen.findByRole('alert')).toHaveTextContent('邮箱或密码不正确')

    await userEvent.setup().click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The email or password is incorrect.')
  })

  it('rejects a protocol-relative return target', async () => {
    renderLogin('//evil.example/steal-session')

    await submitValidCredentials()

    expect(
      await screen.findByRole('heading', { name: '我的收纳' }),
    ).toBeInTheDocument()
  })
})
