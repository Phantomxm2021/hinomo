import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'

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

function AuthProbe() {
  const { session, loading, isPasswordRecovery } = useAuth()
  return (
    <p>
      {loading ? '正在加载' : session ? '已登录' : '未登录'}
      {isPasswordRecovery ? '，密码恢复' : ''}
    </p>
  )
}

describe('AuthProvider', () => {
  let emitAuthChange: (
    event: AuthChangeEvent,
    session: Session | null,
  ) => void

  beforeEach(() => {
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
    mockUnsubscribe.mockReset()
    mockOnAuthStateChange.mockImplementation((callback) => {
      emitAuthChange = callback
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
  })
  afterEach(cleanup)

  it('loads the stored session before exposing auth state', async () => {
    let resolveSession: (value: unknown) => void = () => undefined
    mockGetSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('正在加载')).toBeInTheDocument()
    await act(async () => {
      resolveSession({
        data: { session: { access_token: 'stored-token' } },
        error: null,
      })
    })

    expect(await screen.findByText('已登录')).toBeInTheDocument()
  })

  it('tracks password recovery events and unsubscribes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    const view = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('未登录')).toBeInTheDocument()

    act(() => {
      emitAuthChange(
        'PASSWORD_RECOVERY',
        { access_token: 'recovery-token' } as Session,
      )
    })
    expect(screen.getByText('已登录，密码恢复')).toBeInTheDocument()

    view.unmount()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })
})
