import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { AuthContext } from '../auth/auth-context'
import { LandingPage } from './LandingPage'

afterEach(cleanup)

it('renders the global English locale without the Chinese hero title', () => {
  const values = new Map([['nomo-locale', 'en-US']])
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })

  render(
    <I18nProvider>
      <AuthContext.Provider value={{ session: null, loading: false, isPasswordRecovery: false }}>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
  )

  expect(screen.getByRole('heading', { name: 'Put away. Never lost.' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '收起来。也找得回来。' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'mailto:support@hinomo.space')
  expect(document.documentElement.lang).toBe('en-US')
})
