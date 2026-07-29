import { render, screen } from '@testing-library/react'
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from 'react-router-dom'
import { expect, test } from 'vitest'
import { AuthProvider } from '../features/auth/AuthProvider'
import { RequireAuth } from './RequireAuth'

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

test('redirects an anonymous user to login and preserves the target', async () => {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginProbe /> },
      {
        path: '/app/*',
        element: <RequireAuth />,
        children: [{ path: '*', element: <h1>箱子</h1> }],
      },
    ],
    { initialEntries: ['/app/boxes'] },
  )

  render(
    <AuthProvider session={null}>
      <RouterProvider router={router} />
    </AuthProvider>,
  )

  expect(await screen.findByRole('heading', { name: '登录' })).toBeInTheDocument()
  expect(screen.getByTestId('return-to')).toHaveTextContent('/app/boxes')
})
