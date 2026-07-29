import { createBrowserRouter } from 'react-router-dom'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { BoxFormPage } from '../features/boxes/BoxFormPage'
import { BoxesPage } from '../features/boxes/BoxesPage'
import { BoxDetailPage } from '../features/boxes/BoxDetailPage'
import { PublicBoxPage } from '../features/boxes/PublicBoxPage'
import { PrintPage } from '../features/qr-print/PrintPage'
import { SearchPage } from '../features/search/SearchPage'
import { SpacesPage } from '../features/spaces/SpacesPage'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { PlaceholderPage } from './RoutePlaceholders'

export const router = createBrowserRouter([
  { path: '/', element: <PlaceholderPage title="Nomo" /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/b/:publicId', element: <PublicBoxPage /> },
  {
    path: '/app',
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <PlaceholderPage title="我的收纳" /> },
          { path: 'boxes', element: <BoxesPage /> },
          { path: 'boxes/new', element: <BoxFormPage /> },
          { path: 'boxes/:boxId', element: <BoxDetailPage /> },
          { path: 'boxes/:boxId/edit', element: <BoxFormPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'print', element: <PrintPage /> },
          { path: 'spaces', element: <SpacesPage /> },
          { path: '*', element: <PlaceholderPage title="我的收纳" /> },
        ],
      },
    ],
  },
])
