import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthContextValue = {
  session: Session | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
