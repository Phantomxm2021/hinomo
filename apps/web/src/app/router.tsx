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
import { JoinVenuePage } from '../features/venues/JoinVenuePage'
import { VenueMembersPage } from '../features/venues/VenueMembersPage'
import { VenueActivityPage } from '../features/venues/VenueActivityPage'
import { MyPage } from '../features/profile/MyPage'
import { AccountDetailsPage } from '../features/profile/AccountDetailsPage'
import { GeneralSettingsPage } from '../features/profile/GeneralSettingsPage'
import { SettingsPage } from '../features/profile/SettingsPage'
import { CreditsPage } from '../features/credits/CreditsPage'
import { AppShell } from './AppShell'
import { RequireAuth } from './RequireAuth'
import { RootEntry } from './RootEntry'
import { AuthLayout } from './AuthLayout'
import { ThreeBoxResetPage } from '../features/marketing/ThreeBoxResetPage'

export const router = createBrowserRouter([
  { path: '/', element: <RootEntry /> },
  { path: '/3-box-reset', element: <ThreeBoxResetPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    path: '/legal/privacy',
    lazy: async () => ({
      Component: (await import('../features/legal/LegalDocumentPage')).PrivacyPolicyPage,
    }),
  },
  {
    path: '/legal/terms',
    lazy: async () => ({
      Component: (await import('../features/legal/LegalDocumentPage')).TermsOfServicePage,
    }),
  },
  { path: '/b/:publicId', element: <PublicBoxPage /> },
  { path: '/join/venue', element: <JoinVenuePage /> },
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
          { path: 'boxes/:boxId/edit', element: <BoxFormPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'scan', element: <ScannerPage /> },
          { path: 'print', element: <PrintPage /> },
          { path: 'spaces', element: <SpacesPage /> },
          { path: 'venues', element: <VenuesPage /> },
          { path: 'venues/:venueId/members', element: <VenueMembersPage /> },
          { path: 'venues/:venueId/activity', element: <VenueActivityPage /> },
          { path: 'me', element: <MyPage /> },
          { path: 'me/account', element: <AccountDetailsPage /> },
          { path: 'me/credits', element: <CreditsPage /> },
          { path: 'me/membership', element: <Navigate replace to="/app/me/credits" /> },
          { path: 'me/settings', element: <SettingsPage /> },
          { path: 'me/settings/general', element: <GeneralSettingsPage /> },
          { path: '*', element: <Navigate replace to="/app" /> },
        ],
      },
    ],
  },
])
