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
import { VenuesPage } from '../features/venues/VenuesPage'
import { MyPage } from '../features/profile/MyPage'
import { AccountDetailsPage } from '../features/profile/AccountDetailsPage'
import { GeneralSettingsPage } from '../features/profile/GeneralSettingsPage'
import { SettingsPage } from '../features/profile/SettingsPage'
import { PackingCapturePage } from '../features/packing/PackingCapturePage'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { RootEntry } from './RootEntry'
import { AuthLayout } from './AuthLayout'

export const router = createBrowserRouter([
  { path: '/', element: <RootEntry /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
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
          { path: 'boxes/new', element: <Navigate replace to="/app/boxes?create=1" /> },
          { path: 'boxes/:boxId', element: <BoxDetailPage /> },
          { path: 'boxes/:boxId/packing', element: <PackingCapturePage /> },
          { path: 'boxes/:boxId/edit', element: <BoxFormPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'scan', element: <ScannerPage /> },
          { path: 'print', element: <PrintPage /> },
          { path: 'spaces', element: <SpacesPage /> },
          { path: 'venues', element: <VenuesPage /> },
          { path: 'me', element: <MyPage /> },
          { path: 'me/account', element: <AccountDetailsPage /> },
          { path: 'me/settings', element: <SettingsPage /> },
          { path: 'me/settings/general', element: <GeneralSettingsPage /> },
          { path: '*', element: <Navigate replace to="/app" /> },
        ],
      },
    ],
  },
])
