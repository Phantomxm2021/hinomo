import { createBrowserRouter } from 'react-router-dom'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { RequireAuth } from './RequireAuth'
import { PlaceholderPage } from './RoutePlaceholders'

export const router = createBrowserRouter([
  { path: '/', element: <PlaceholderPage title="Nomo" /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/b/:publicId', element: <PlaceholderPage title="收纳箱" /> },
  {
    path: '/app/*',
    element: <RequireAuth />,
    children: [{ path: '*', element: <PlaceholderPage title="我的收纳" /> }],
  },
])
