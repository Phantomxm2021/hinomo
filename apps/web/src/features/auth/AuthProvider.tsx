import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext } from './auth-context'

type AuthProviderProps = PropsWithChildren<{
  session?: Session | null
  isPasswordRecovery?: boolean
}>

type AuthState = {
  session: Session | null
  loading: boolean
  isPasswordRecovery: boolean
}

export function AuthProvider(props: AuthProviderProps) {
  const controlled = Object.prototype.hasOwnProperty.call(props, 'session')
  const [authState, setAuthState] = useState<AuthState>(() => ({
    session: props.session ?? null,
    loading: !controlled,
    isPasswordRecovery: controlled && (props.isPasswordRecovery ?? false),
  }))

  useEffect(() => {
    if (controlled) {
      setAuthState({
        session: props.session ?? null,
        loading: false,
        isPasswordRecovery: props.isPasswordRecovery ?? false,
      })
      return
    }

    let active = true
    let receivedAuthEvent = false
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      receivedAuthEvent = true
      setAuthState({
        session,
        loading: false,
        isPasswordRecovery: event === 'PASSWORD_RECOVERY',
      })
    })

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active || receivedAuthEvent) return
      setAuthState({
        session: sessionData.session,
        loading: false,
        isPasswordRecovery: false,
      })
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [controlled, props.isPasswordRecovery, props.session])

  return (
    <AuthContext.Provider value={authState}>
      {props.children}
    </AuthContext.Provider>
  )
}
