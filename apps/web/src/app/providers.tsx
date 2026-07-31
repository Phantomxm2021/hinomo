import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthProvider'
import { MobileFeedbackProvider } from '../components/MobileFeedbackProvider'
import { router } from './router'

const queryClient = new QueryClient()

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <MobileFeedbackProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </MobileFeedbackProvider>
    </QueryClientProvider>
  )
}
