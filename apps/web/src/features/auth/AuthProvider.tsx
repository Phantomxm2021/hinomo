import type { Session } from '@supabase/supabase-js'
import type { PropsWithChildren } from 'react'
import { AuthContext } from './auth-context'

type AuthProviderProps = PropsWithChildren<{
  session?: Session | null
}>

export function AuthProvider({ children, session = null }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ session }}>{children}</AuthContext.Provider>
  )
}
