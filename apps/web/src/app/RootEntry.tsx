import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'
import { Skeleton, SkeletonGroup } from '../components/Skeleton'

export function RootEntry() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main className="grid min-h-dvh place-content-center justify-items-center gap-4 bg-canvas">
        <SkeletonGroup className="grid justify-items-center gap-4" label="正在进入 Nomo">
          <span className="grid size-16 place-items-center rounded-card bg-brand text-3xl font-black text-white shadow-float">N</span>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </SkeletonGroup>
      </main>
    )
  }

  return <Navigate replace to={session ? '/app' : '/login'} />
}
