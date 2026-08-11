import type { Session } from '@supabase/supabase-js'
import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react'
import {
  getAnalyticsConsent,
  identifyAnalyticsUser,
  resetAnalyticsUser,
  subscribeAnalyticsConsent,
} from '../../lib/analytics'
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
  const analyticsConsent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    getAnalyticsConsent,
  )

  useEffect(() => {
    if (liveAuthState.session && analyticsConsent === 'accepted') {
      identifyAnalyticsUser(liveAuthState.session.user.id)
      return
    }
    if (!liveAuthState.session) resetAnalyticsUser()
  }, [analyticsConsent, liveAuthState.session])

  return (
    <AuthContext.Provider value={liveAuthState}>
      {children}
    </AuthContext.Provider>
  )
}
