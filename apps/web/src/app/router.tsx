import { createBrowserRouter, Navigate } from 'react-router-dom'
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
import { ScannerPage } from '../features/scanner/ScannerPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { SpacesPage } from '../features/spaces/SpacesPage'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { RootEntry } from './RootEntry'

export const router = createBrowserRouter([
  { path: '/', element: <RootEntry /> },
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
          { index: true, element: <DashboardPage /> },
          { path: 'boxes', element: <BoxesPage /> },
          { path: 'boxes/new', element: <BoxFormPage /> },
          { path: 'boxes/:boxId', element: <BoxDetailPage /> },
          { path: 'boxes/:boxId/edit', element: <BoxFormPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'scan', element: <ScannerPage /> },
          { path: 'print', element: <PrintPage /> },
          { path: 'spaces', element: <SpacesPage /> },
          { path: '*', element: <Navigate replace to="/app" /> },
        ],
      },
    ],
  },
])
