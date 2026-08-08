import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { Skeleton, SkeletonGroup } from '../components/Skeleton'
import { useI18n } from '../i18n/I18nProvider'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const { t } = useI18n()

  if (loading) {
    return (
      <SkeletonGroup className="mx-auto grid min-h-64 w-full max-w-4xl content-center gap-4 px-4" label={t('auth.sessionChecking')}>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </SkeletonGroup>
    )
  }

  if (!session) {
    return (
      <Navigate
        replace
        state={{
          returnTo: `${location.pathname}${location.search}${location.hash}`,
        }}
        to="/login"
      />
    )
  }

  return <Outlet />
}
