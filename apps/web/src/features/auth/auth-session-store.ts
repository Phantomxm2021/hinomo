import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { AuthContextValue } from './auth-context'

type Listener = () => void

let snapshot: AuthContextValue = {
  session: null,
  loading: true,
  isPasswordRecovery: false,
}
let recoveryUserId: string | null = null
let recoveryAccessToken: string | null = null
let authEventCount = 0
const listeners = new Set<Listener>()

function sessionUserId(session: Session | null) {
  return session?.user?.id ?? null
}

function publish(nextSnapshot: AuthContextValue) {
  snapshot = nextSnapshot
  listeners.forEach((listener) => listener())
}

function clearRecovery() {
  recoveryUserId = null
  recoveryAccessToken = null
}

function receiveAuthEvent(event: AuthChangeEvent, session: Session | null) {
  authEventCount += 1
  const userId = sessionUserId(session)
  const accessToken = session?.access_token ?? null

  if (!session || event === 'SIGNED_OUT') {
    clearRecovery()
    publish({ session: null, loading: false, isPasswordRecovery: false })
    return
  }

  if (event === 'PASSWORD_RECOVERY' && userId && accessToken) {
    recoveryUserId = userId
    recoveryAccessToken = accessToken
  } else if (recoveryUserId && recoveryAccessToken) {
    if (!userId || userId !== recoveryUserId || !accessToken) {
      clearRecovery()
    } else if (event === 'TOKEN_REFRESHED') {
      recoveryAccessToken = accessToken
    } else if (accessToken !== recoveryAccessToken) {
      clearRecovery()
    }
  } else {
    clearRecovery()
  }

  publish({
    session,
    loading: false,
    isPasswordRecovery:
      recoveryUserId === userId && recoveryAccessToken === accessToken,
  })
}

supabase.auth.onAuthStateChange(receiveAuthEvent)

void supabase.auth
  .getSession()
  .then(({ data }) => {
    if (authEventCount > 0) return
    clearRecovery()
    publish({
      session: data.session,
      loading: false,
      isPasswordRecovery: false,
    })
  })
  .catch(() => {
    if (authEventCount > 0) return
    clearRecovery()
    publish({ session: null, loading: false, isPasswordRecovery: false })
  })

export function subscribeAuthSession(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthSessionSnapshot() {
  return snapshot
}

export function completePasswordRecovery() {
  if (!snapshot.isPasswordRecovery) return
  clearRecovery()
  publish({ ...snapshot, isPasswordRecovery: false })
}
