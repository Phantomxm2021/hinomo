import type { Session } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test } from 'vitest'
import { AuthContext, type AuthContextValue } from '../features/auth/auth-context'
import { RootEntry } from './RootEntry'

afterEach(() => {
  cleanup()
  document.documentElement.lang = 'zh-CN'
})

function renderEntry(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <RootEntry />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

test('shows the product story immediately while the session initializes', () => {
  renderEntry({ session: null, loading: true, isPasswordRecovery: false })
  expect(screen.getByRole('heading', { name: '收起来。也找得回来。' })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: '免费开始' }).length).toBeGreaterThan(0)
})

test('gives an anonymous visitor paths to register and login', () => {
  renderEntry({ session: null, loading: false, isPasswordRecovery: false })
  expect(screen.getAllByRole('link', { name: '登录' })[0]).toHaveAttribute('href', '/login')
  expect(screen.getAllByRole('link', { name: '免费开始' })[0]).toHaveAttribute('href', '/register')
})

test('gives an authenticated visitor a direct path to the app', () => {
  renderEntry({
    session: { user: { id: 'owner-1' } } as Session,
    loading: false,
    isPasswordRecovery: false,
  })
  expect(screen.getAllByRole('link', { name: '进入 Nomo' })[0]).toHaveAttribute('href', '/app')
  expect(screen.queryByRole('link', { name: '登录' })).not.toBeInTheDocument()
})

test('switches the complete landing-page experience between Chinese and English', () => {
  renderEntry({ session: null, loading: false, isPasswordRecovery: false })

  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))

  expect(document.documentElement).toHaveAttribute('lang', 'en')
  expect(screen.getByRole('heading', { name: 'Put away. Never lost.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'We put so much away. Then forget it was ever there.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: "Home's order shouldn't live in one person's head." })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Get started' })[0]).toHaveAttribute('href', '/register')
  expect(screen.getByRole('button', { name: '切换到中文' })).toBeInTheDocument()
})
