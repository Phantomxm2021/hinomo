import type { Session } from '@supabase/supabase-js'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthContext } from '../auth/auth-context'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { GeneralSettingsPage } from './GeneralSettingsPage'

const originalMatchMedia = window.matchMedia

function mockViewport(isDesktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: isDesktop,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

beforeEach(() => {
  mockViewport(false)
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
afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
})

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

test('announces the saved locale in the selected language', async () => {
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <MobileFeedbackProvider>
        <MemoryRouter>
          <AuthContext.Provider value={{
            session: { user: { id: 'user-1', email: 'lin@example.com' } } as unknown as Session,
            loading: false,
            isPasswordRecovery: false,
          }}>
            <GeneralSettingsPage />
          </AuthContext.Provider>
        </MemoryRouter>
      </MobileFeedbackProvider>
    </I18nProvider>,
  )

  await user.selectOptions(await screen.findByLabelText('语言'), 'en-US')
  expect(await screen.findByRole('status', { name: 'Settings saved' })).toBeInTheDocument()

  await user.selectOptions(await screen.findByLabelText('Language'), 'zh-CN')
  expect(await screen.findByRole('status', { name: '设置已保存' })).toBeInTheDocument()
})

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
  expect(await screen.findByText('General')).toBeInTheDocument()
  expect(screen.getByLabelText('Language')).toHaveValue('en-US')
})

test('keeps General as a mobile page with its language selector', () => {
  renderPage()

  expect(screen.getByRole('navigation', { name: '设置导航' })).toBeInTheDocument()
  expect(screen.getByLabelText('语言')).toBeInTheDocument()
  expect(screen.getByLabelText('Analytics')).toHaveValue('declined')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('lets a user change their analytics decision', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.selectOptions(screen.getByLabelText('Analytics'), 'accepted')

  expect(localStorage.getItem('nomo-analytics-consent')).toBe('accepted')
})

test('renders desktop General as a modal with one language selector and closes back', async () => {
  mockViewport(true)
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/app/me/settings', '/app/me/settings/general']} initialIndex={1}>
        <Routes>
          <Route path="/app/me/settings/general" element={
            <AuthContext.Provider value={{
              session: { user: { id: 'user-1', email: 'lin@example.com' } } as unknown as Session,
              loading: false,
              isPasswordRecovery: false,
            }}>
              <GeneralSettingsPage />
            </AuthContext.Provider>
          } />
          <Route path="/app/me/settings" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )

  const dialog = await screen.findByRole('dialog', { name: '通用' })
  expect(dialog).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: '设置导航' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('combobox', { name: '语言' })).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: '关闭通用' }))
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/app/me/settings'))
})
