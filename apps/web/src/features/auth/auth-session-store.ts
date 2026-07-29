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
}

function receiveAuthEvent(event: AuthChangeEvent, session: Session | null) {
  authEventCount += 1
  const userId = sessionUserId(session)

  if (!session || event === 'SIGNED_OUT') {
    clearRecovery()
    publish({ session: null, loading: false, isPasswordRecovery: false })
    return
  }

  if (event === 'PASSWORD_RECOVERY' && userId) {
    recoveryUserId = userId
  } else if (!userId || userId !== recoveryUserId) {
    clearRecovery()
  }

  publish({
    session,
    loading: false,
    isPasswordRecovery: recoveryUserId !== null && userId === recoveryUserId,
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
