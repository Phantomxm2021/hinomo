import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthProvider'
import { MobileFeedbackProvider } from '../components/MobileFeedbackProvider'
import { AnalyticsConsentBanner } from '../components/AnalyticsConsentBanner'
import { I18nProvider } from '../i18n/I18nProvider'
import { LocaleProfileSync } from '../i18n/LocaleProfileSync'
import { AccountQueryBoundary } from './AccountQueryBoundary'
import { router } from './router'

const queryClient = new QueryClient()

export function AppProviders() {
  return (
    <I18nProvider>
      <AnalyticsConsentBanner />
      <QueryClientProvider client={queryClient}>
        <MobileFeedbackProvider>
          <AuthProvider>
            <AccountQueryBoundary>
              <LocaleProfileSync />
              <RouterProvider router={router} />
            </AccountQueryBoundary>
          </AuthProvider>
        </MobileFeedbackProvider>
      </QueryClientProvider>
    </I18nProvider>
  )
}
