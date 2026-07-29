import type { Session } from '@supabase/supabase-js'
import { useSyncExternalStore, type PropsWithChildren } from 'react'
import {
  getAuthSessionSnapshot,
  subscribeAuthSession,
} from './auth-session-store'
import { AuthContext } from './auth-context'

type AuthProviderProps = PropsWithChildren<{
  session?: Session | null
  isPasswordRecovery?: boolean
}>

export function AuthProvider(props: AuthProviderProps) {
  const controlled = Object.prototype.hasOwnProperty.call(props, 'session')

  if (controlled) {
    return (
      <AuthContext.Provider
        value={{
          session: props.session ?? null,
          loading: false,
          isPasswordRecovery: props.isPasswordRecovery ?? false,
        }}
      >
        {props.children}
      </AuthContext.Provider>
    )
  }

  return <LiveAuthProvider>{props.children}</LiveAuthProvider>
}

function LiveAuthProvider({ children }: PropsWithChildren) {
  const liveAuthState = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getAuthSessionSnapshot,
  )

  return (
    <AuthContext.Provider value={liveAuthState}>
      {children}
    </AuthContext.Provider>
  )
}
