import { useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useState, type PropsWithChildren } from 'react'
import { useAuth } from '../features/auth/auth-context'

export function AccountQueryBoundary({ children }: PropsWithChildren) {
  const { session, loading } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id ?? null
  const [activeUserId, setActiveUserId] = useState(userId)

  useLayoutEffect(() => {
    if (activeUserId === userId) return
    queryClient.clear()
    setActiveUserId(userId)
  }, [activeUserId, queryClient, userId])

  if (loading || activeUserId !== userId) return null
  return children
}
