import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'

export function RootEntry() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main className="entry-loading">
        <span className="brand-mark" aria-hidden="true">N</span>
        <p role="status">正在进入 Nomo…</p>
      </main>
    )
  }

  return <Navigate replace to={session ? '/app' : '/login'} />
}
