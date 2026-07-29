import type { Session } from '@supabase/supabase-js'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { AuthContext, type AuthContextValue } from '../features/auth/auth-context'
import { RootEntry } from './RootEntry'

afterEach(cleanup)

function renderEntry(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RootEntry />} />
          <Route path="/login" element={<h1>登录</h1>} />
          <Route path="/app" element={<h1>工作台</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

test('shows a branded loading state while the session initializes', () => {
  renderEntry({ session: null, loading: true, isPasswordRecovery: false })
  expect(screen.getByRole('status')).toHaveTextContent('正在进入 Nomo…')
})

test('sends an anonymous visitor to login', () => {
  renderEntry({ session: null, loading: false, isPasswordRecovery: false })
  expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument()
})

test('sends an authenticated visitor to the workbench', () => {
  renderEntry({
    session: { user: { id: 'owner-1' } } as Session,
    loading: false,
    isPasswordRecovery: false,
  })
  expect(screen.getByRole('heading', { name: '工作台' })).toBeInTheDocument()
})
