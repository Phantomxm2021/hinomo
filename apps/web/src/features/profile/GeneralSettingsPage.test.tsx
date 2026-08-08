import type { Session } from '@supabase/supabase-js'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { I18nProvider } from '../../i18n/I18nProvider'
import { GeneralSettingsPage } from './GeneralSettingsPage'

beforeEach(() => {
  const values = new Map<string, string>()
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
})
afterEach(cleanup)

function renderPage() {
  render(
    <I18nProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{
          session: { user: { id: 'user-1', email: 'lin@example.com' } } as unknown as Session,
          loading: false,
          isPasswordRecovery: false,
        }}>
          <GeneralSettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  )
}

test('keeps language inside General and switches the global locale', async () => {
  const user = userEvent.setup()
  renderPage()

  const language = await screen.findByLabelText('语言')
  expect(language).toHaveValue('zh-CN')
  expect(screen.getByRole('group', { name: '语言与地区' })).toHaveClass('rounded-card', 'bg-surface', 'overflow-hidden')
  await user.selectOptions(language, 'en-US')

  expect(localStorage.getItem('nomo-locale')).toBe('en-US')
})

test('switches the global locale and persists it immediately', async () => {
  const user = userEvent.setup()
  renderPage()

  const language = await screen.findByLabelText('语言')
  await user.selectOptions(language, 'en-US')

  expect(localStorage.getItem('nomo-locale')).toBe('en-US')
  expect(await screen.findByRole('heading', { name: 'General' })).toBeInTheDocument()
  expect(screen.getByLabelText('Language')).toHaveValue('en-US')
})
