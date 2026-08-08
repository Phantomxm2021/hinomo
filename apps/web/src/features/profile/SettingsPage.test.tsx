import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { SettingsPage } from './SettingsPage'

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
})

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
})

test('keeps the settings destination as a mobile page', () => {
  render(<I18nProvider><MemoryRouter><SettingsPage /></MemoryRouter></I18nProvider>)

  expect(screen.getByRole('navigation', { name: '设置导航' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /通用.*语言与地区/ })).toHaveAttribute('href', '/app/me/settings/general')
  expect(screen.queryByLabelText('语言')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('renders desktop settings as a centered dialog and closes back to the previous route', async () => {
  mockViewport(true)
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/app/me', '/app/me/settings']} initialIndex={1}>
        <Routes>
          <Route path="/app/me/settings" element={<SettingsPage />} />
          <Route path="/app/me" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )

  const dialog = await screen.findByRole('dialog', { name: '设置' })
  expect(dialog).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: '设置导航' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /通用.*语言与地区/ })).toHaveAttribute('href', '/app/me/settings/general')
  expect(screen.getByRole('link', { name: /通用.*语言与地区/ })).toHaveAttribute('data-settings-general-link')

  await user.click(screen.getByRole('button', { name: '关闭设置' }))
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/app/me'))
  expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
})
