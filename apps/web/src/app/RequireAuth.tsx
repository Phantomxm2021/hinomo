import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'

export function RequireAuth() {
  const { session } = useAuth()
  const location = useLocation()

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
