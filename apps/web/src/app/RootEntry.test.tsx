import type { Session } from '@supabase/supabase-js'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../features/auth/auth-context'
import { I18nProvider } from '../i18n/I18nProvider'
import { RootEntry } from './RootEntry'

let languageStorage: Map<string, string>

beforeEach(() => {
  languageStorage = new Map()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => languageStorage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { languageStorage.set(key, value) }),
      clear: vi.fn(() => languageStorage.clear()),
    },
  })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.lang = 'zh-CN'
})

function renderEntry(auth: AuthContextValue) {
  return render(
    <I18nProvider>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/']}>
          <RootEntry />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
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

  const languageSelect = screen.getByRole('combobox', { name: '语言' })
  expect(languageSelect).toHaveValue('zh-CN')
  fireEvent.change(languageSelect, { target: { value: 'en-US' } })

  expect(document.documentElement).toHaveAttribute('lang', 'en-US')
  expect(screen.getByRole('heading', { name: 'Put away. Never lost.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'We put so much away. Then forget it was ever there.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: "Home's order shouldn't live in one person's head." })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Get started' })[0]).toHaveAttribute('href', '/register')
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en-US')
  expect(window.localStorage.getItem('nomo-locale')).toBe('en-US')
})

test('restores the saved landing-page language preference', () => {
  window.localStorage.setItem('nomo-locale', 'en-US')
  renderEntry({ session: null, loading: false, isPasswordRecovery: false })

  expect(screen.getByRole('navigation', { name: 'Landing page navigation' })).toHaveClass(
    'flex', 'max-w-7xl', 'items-center',
  )
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en-US')
  expect(screen.getByRole('heading', { name: 'Put away. Never lost.' })).toBeInTheDocument()
})

test('shows a complete footer without a second language control', () => {
  renderEntry({ session: null, loading: false, isPasswordRecovery: false })

  const footer = screen.getByRole('contentinfo')
  expect(within(footer).getByText('每件东西，都值得有一个找得到的地方。')).toBeInTheDocument()
  expect(within(footer).getByRole('link', { name: '隐私政策' })).toHaveAttribute('href', '/legal/privacy?lang=zh-CN')
  expect(within(footer).getByRole('link', { name: '服务条款' })).toHaveAttribute('href', '/legal/terms?lang=zh-CN')
  expect(within(footer).queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getAllByRole('combobox')).toHaveLength(1)
})
