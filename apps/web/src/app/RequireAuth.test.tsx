import { cleanup, render, screen } from '@testing-library/react'
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AuthContext } from '../features/auth/auth-context'
import { RequireAuth } from './RequireAuth'

const { storeSnapshot } = vi.hoisted(() => ({
  storeSnapshot: {
    session: null,
    loading: false,
    isPasswordRecovery: false,
  },
}))

vi.mock('../features/auth/auth-session-store', () => ({
  getAuthSessionSnapshot: () => storeSnapshot,
  subscribeAuthSession: () => () => undefined,
}))

afterEach(cleanup)

function LoginProbe() {
  const location = useLocation()
  const state = location.state as { returnTo?: string } | null

  return (
    <>
      <h1>登录</h1>
      <span data-testid="return-to">{state?.returnTo}</span>
    </>
  )
}

function renderAppAt(path: string, session: Session | null) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginProbe /> },
      {
        path: '/app/*',
        element: <RequireAuth />,
        children: [{ path: '*', element: <h1>箱子</h1> }],
      },
    ],
    { initialEntries: [path] },
  )

  return render(
    <AuthProvider session={session}>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

test('redirects an anonymous user to login and preserves the target', async () => {
  renderAppAt('/app/boxes', null)

  expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument()
  expect(screen.getByTestId('return-to')).toHaveTextContent('/app/boxes')
})

test('preserves query and hash in the login return target', async () => {
  renderAppAt('/app/boxes?sort=name#media', null)

  expect(await screen.findByTestId('return-to')).toHaveTextContent(
    '/app/boxes?sort=name#media',
  )
})

test('renders the protected outlet for an authenticated session', async () => {
  renderAppAt('/app/boxes', { access_token: 'test-token' } as Session)

  expect(await screen.findByRole('heading', { name: '箱子' })).toBeInTheDocument()
})

test('does not redirect while the initial session is loading', () => {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <h1>登录</h1> },
      {
        path: '/app/*',
        element: <RequireAuth />,
        children: [{ path: '*', element: <h1>箱子</h1> }],
      },
    ],
    { initialEntries: ['/app/boxes'] },
  )

  render(
    <AuthContext.Provider
      value={{ session: null, loading: true, isPasswordRecovery: false }}
    >
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )

  expect(screen.getByRole('status', { name: '正在检查登录状态' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(1)
  expect(screen.queryByText('正在检查登录状态…')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '登录' })).not.toBeInTheDocument()
})
