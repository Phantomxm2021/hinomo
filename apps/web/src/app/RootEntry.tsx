import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'

export function RootEntry() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main className="grid min-h-dvh place-content-center justify-items-center gap-4 bg-canvas">
        <span className="grid size-16 place-items-center rounded-card bg-brand text-3xl font-black text-white shadow-float" aria-hidden="true">N</span>
        <p role="status">正在进入 Nomo…</p>
      </main>
    )
  }

  return <Navigate replace to={session ? '/app' : '/login'} />
}
