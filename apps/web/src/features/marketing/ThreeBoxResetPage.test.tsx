import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { AuthContext } from '../auth/auth-context'
import { ThreeBoxResetPage } from './ThreeBoxResetPage'

const analytics = vi.hoisted(() => {
  let consent: 'unset' | 'accepted' = 'unset'
  const listeners = new Set<() => void>()
  return {
    captureGrowthEvent: vi.fn(),
    firstGrowthOccurrence: vi.fn(() => true),
    getAnalyticsConsent: () => consent,
    subscribeAnalyticsConsent: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    accept: () => {
      consent = 'accepted'
      listeners.forEach((listener) => listener())
    },
    reset: () => { consent = 'unset'; listeners.clear() },
  }
})

vi.mock('../../lib/analytics', () => analytics)

afterEach(() => {
  cleanup()
  analytics.reset()
  vi.clearAllMocks()
})

it('renders the English three-box reset conversion path', () => {
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
          <ThreeBoxResetPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
  )

  expect(screen.getByRole('heading', { name: 'Pack once. Find anything later.' })).toBeVisible()
  expect(screen.getByText('The 3-Box Reset')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Organize 3 boxes free' }))
    .toHaveAttribute('href', '/register?campaign=three_box_reset')
  expect(screen.getByText(/10 AI Credits/)).toBeVisible()
  expect(screen.getByText(/No card required/)).toBeVisible()
  expect(screen.getByText(/US\$9/)).toBeVisible()
  expect(screen.getByText(/one-time/)).toBeVisible()
  expect(screen.getByText(/20 non-expiring bonus AI Credits/)).toBeVisible()
  expect(screen.getByText(/Add Nomo to your Home Screen/)).toBeVisible()

  const freeOffer = screen.getByTestId('three-box-free-offer')
  const founderOffer = screen.getByTestId('founding-lifetime-offer')
  expect(within(freeOffer).getByRole('heading')).toHaveClass('text-white')
  expect(within(founderOffer).getByRole('heading')).toHaveClass('text-white')

  const demo = screen.getByTestId('three-box-demo')
  const workflow = screen.getByTestId('three-box-workflow')
  expect(demo.compareDocumentPosition(founderOffer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(workflow.compareDocumentPosition(founderOffer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Support' }))
    .toHaveAttribute('href', 'mailto:support@hinomo.space')
})

it('records the current visit only once after analytics consent is accepted', () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  })

  render(
    <I18nProvider>
      <AuthContext.Provider value={{ session: null, loading: false, isPasswordRecovery: false }}>
        <MemoryRouter><ThreeBoxResetPage /></MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
  )

  expect(analytics.captureGrowthEvent).not.toHaveBeenCalled()
  act(() => analytics.accept())
  expect(analytics.firstGrowthOccurrence).toHaveBeenCalledWith('landing_view')
  expect(analytics.captureGrowthEvent).toHaveBeenCalledWith('landing_view', {
    campaign: 'three_box_reset', language: 'en-US', device: 'desktop', first: true,
  })

  fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'zh-CN' } })
  expect(screen.getByText('不限箱子，20 个永不过期的赠送 AI Credits。不订阅，不自动续费。')).toBeVisible()
  expect(analytics.captureGrowthEvent).toHaveBeenCalledTimes(1)
})
