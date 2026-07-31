import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockOnAuthStateChange, mockUnsubscribe } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockOnAuthStateChange: vi.fn(),
    mockUnsubscribe: vi.fn(),
  }),
)

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

function session(userId: string, token = `${userId}-token`) {
  return {
    access_token: token,
    user: { id: userId },
  } as Session
}

describe('auth session store', () => {
  let emit: (event: AuthChangeEvent, session: Session | null) => void

  beforeEach(() => {
    vi.resetModules()
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
    mockUnsubscribe.mockReset()
    mockOnAuthStateChange.mockImplementation((callback: (event: AuthChangeEvent, nextSession: Session | null) => void) => {
      emit = callback
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
  })

  afterEach(cleanup)

  it('preserves a recovery event that arrives before the provider mounts', async () => {
    let resolveSession: (result: unknown) => void = () => undefined
    mockGetSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    await import('./auth-session-store')

    emit('PASSWORD_RECOVERY', session('user-1', 'recovery-token'))

    const { AuthProvider } = await import('./AuthProvider')
    const { useAuth } = await import('./auth-context')
    function Probe() {
      const auth = useAuth()
      return <p>{auth.isPasswordRecovery ? '密码恢复' : '普通会话'}</p>
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByText('密码恢复')).toBeInTheDocument()

    await act(async () => {
      resolveSession({ data: { session: null }, error: null })
    })
    expect(screen.getByText('密码恢复')).toBeInTheDocument()
  })

  it('keeps recovery state for same-token sign-in and initial-session events', async () => {
    mockGetSession.mockReturnValue(new Promise(() => undefined))
    const store = await import('./auth-session-store')

    emit('PASSWORD_RECOVERY', session('user-1', 'recovery-token'))
    for (const event of ['SIGNED_IN', 'INITIAL_SESSION'] as AuthChangeEvent[]) {
      emit(event, session('user-1', 'recovery-token'))
      expect(store.getAuthSessionSnapshot().isPasswordRecovery).toBe(true)
    }
  })

  it('clears recovery state for a same-user sign-in with a new token', async () => {
    mockGetSession.mockReturnValue(new Promise(() => undefined))
    const store = await import('./auth-session-store')
    emit('PASSWORD_RECOVERY', session('user-1', 'recovery-token'))

    emit('SIGNED_IN', session('user-1', 'ordinary-login-token'))

    expect(store.getAuthSessionSnapshot().isPasswordRecovery).toBe(false)
  })

  it('updates the recovery token on refresh and accepts that token on sign-in', async () => {
    mockGetSession.mockReturnValue(new Promise(() => undefined))
    const store = await import('./auth-session-store')
    emit('PASSWORD_RECOVERY', session('user-1', 'recovery-token'))

    emit('TOKEN_REFRESHED', session('user-1', 'refreshed-token'))
    emit('SIGNED_IN', session('user-1', 'refreshed-token'))

    expect(store.getAuthSessionSnapshot().isPasswordRecovery).toBe(true)
  })

  it('keeps user updates only when they belong to the current token chain', async () => {
    mockGetSession.mockReturnValue(new Promise(() => undefined))
    const store = await import('./auth-session-store')
    emit('PASSWORD_RECOVERY', session('user-1', 'recovery-token'))

    emit('USER_UPDATED', session('user-1', 'recovery-token'))
    expect(store.getAuthSessionSnapshot().isPasswordRecovery).toBe(true)

    emit('USER_UPDATED', session('user-1', 'unrelated-token'))
    expect(store.getAuthSessionSnapshot().isPasswordRecovery).toBe(false)
  })

  it('clears recovery state on sign out', async () => {
    mockGetSession.mockReturnValue(new Promise(() => undefined))
    const store = await import('./auth-session-store')
    emit('PASSWORD_RECOVERY', session('user-1'))

    emit('SIGNED_OUT', null)

    expect(store.getAuthSessionSnapshot()).toMatchObject({
      session: null,
      isPasswordRecovery: false,
    })
  })

  it('clears recovery state when a different user signs in', async () => {
    mockGetSession.mockReturnValue(new Promise(() => undefined))
    const store = await import('./auth-session-store')
    emit('PASSWORD_RECOVERY', session('user-1'))

    emit('SIGNED_IN', session('user-2'))

    expect(store.getAuthSessionSnapshot()).toMatchObject({
      session: expect.objectContaining({ user: expect.objectContaining({ id: 'user-2' }) }),
      isPasswordRecovery: false,
    })
  })

  it('clears recovery state when password reset completes', async () => {
    mockGetSession.mockReturnValue(new Promise(() => undefined))
    const store = await import('./auth-session-store')
    emit('PASSWORD_RECOVERY', session('user-1'))

    store.completePasswordRecovery()

    expect(store.getAuthSessionSnapshot().isPasswordRecovery).toBe(false)
  })

  it('settles loading when the initial session lookup rejects', async () => {
    mockGetSession.mockRejectedValue(new Error('local storage unavailable'))
    const store = await import('./auth-session-store')

    await waitFor(() => {
      expect(store.getAuthSessionSnapshot()).toMatchObject({
        session: null,
        loading: false,
        isPasswordRecovery: false,
      })
    })
  })

  it('loads the initial session when no auth event has arrived', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: session('user-1', 'stored-token') },
      error: null,
    })
    const store = await import('./auth-session-store')

    await waitFor(() => {
      expect(store.getAuthSessionSnapshot()).toMatchObject({
        session: expect.objectContaining({ access_token: 'stored-token' }),
        loading: false,
        isPasswordRecovery: false,
      })
    })
  })
})
