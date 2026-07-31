import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { Skeleton, SkeletonGroup } from '../components/Skeleton'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <SkeletonGroup className="mx-auto grid min-h-64 w-full max-w-4xl content-center gap-4 px-4" label="正在检查登录状态">
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
