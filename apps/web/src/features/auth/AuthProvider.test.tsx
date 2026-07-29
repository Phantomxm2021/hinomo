import type { Session } from '@supabase/supabase-js'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'

const { liveSnapshot, mockSubscribeAuthSession } = vi.hoisted(() => ({
  liveSnapshot: {
    session: {
      access_token: 'live-token',
      user: { id: 'live-user' },
    } as Session,
    loading: false,
    isPasswordRecovery: true,
  },
  mockSubscribeAuthSession: vi.fn(() => () => undefined),
}))

vi.mock('./auth-session-store', () => ({
  getAuthSessionSnapshot: () => liveSnapshot,
  subscribeAuthSession: mockSubscribeAuthSession,
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
  beforeEach(() => mockSubscribeAuthSession.mockClear())
  afterEach(cleanup)

  it('exposes the module-level auth store snapshot', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('已登录，密码恢复')).toBeInTheDocument()
    expect(mockSubscribeAuthSession).toHaveBeenCalledOnce()
  })

  it('uses the controlled test state without subscribing to the live store', () => {
    render(
      <AuthProvider session={null} isPasswordRecovery={false}>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('未登录')).toBeInTheDocument()
    expect(mockSubscribeAuthSession).not.toHaveBeenCalled()
  })
})
