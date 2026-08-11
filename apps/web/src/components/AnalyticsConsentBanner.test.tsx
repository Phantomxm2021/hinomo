import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AnalyticsConsentBanner } from './AnalyticsConsentBanner'

function installStorage() {
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
}

beforeEach(() => {
  installStorage()
  localStorage.clear()
})
afterEach(cleanup)

test('asks for optional, content-free analytics consent and saves the decision', async () => {
  const user = userEvent.setup()
  render(<AnalyticsConsentBanner />)

  expect(screen.getByText(/analytics are optional and never include your stored content/i)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Allow analytics' }))

  expect(localStorage.getItem('nomo-analytics-consent')).toBe('accepted')
  expect(screen.queryByRole('button', { name: 'Allow analytics' })).not.toBeInTheDocument()
})

test('does not render once a choice has already been made', () => {
  localStorage.setItem('nomo-analytics-consent', 'declined')
  render(<AnalyticsConsentBanner />)

  expect(screen.queryByRole('button', { name: 'No thanks' })).not.toBeInTheDocument()
})
