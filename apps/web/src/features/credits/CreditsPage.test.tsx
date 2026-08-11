import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CreditsPage } from './CreditsPage'

const mocks = vi.hoisted(() => ({
  summary: vi.fn(), transactions: vi.fn(), checkout: vi.fn(), unlimitedCheckout: vi.fn(),
}))
const analytics = vi.hoisted(() => ({ captureGrowthEvent: vi.fn() }))
vi.mock('./credits.api', () => ({
  getCreditSummary: mocks.summary,
  listCreditTransactions: mocks.transactions,
  startCheckout: mocks.checkout,
}))
vi.mock('../boxes/box-entitlements.api', () => ({
  startBoxUnlimitedCheckout: mocks.unlimitedCheckout,
}))
vi.mock('../../lib/analytics', () => analytics)

function renderPage(initialEntry = '/app/me/credits') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CreditsPage /></QueryClientProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transactions.mockResolvedValue([])
  mocks.checkout.mockResolvedValue(undefined)
  mocks.unlimitedCheckout.mockResolvedValue(undefined)
  analytics.captureGrowthEvent.mockReset()
})
afterEach(cleanup)

test('offers the USD one-time credit packs without a subscription', async () => {
  mocks.summary.mockResolvedValue({ credits_available: 0, credits_reserved: 0 })
  renderPage()
  const user = userEvent.setup()

  expect(await screen.findByText('不自动续费')).toBeInTheDocument()
  expect(screen.getByText('US$2.99')).toBeInTheDocument()
  expect(screen.getByText('US$9.99')).toBeInTheDocument()
  expect(screen.getByText('US$34.99')).toBeInTheDocument()
  expect(screen.getByText('无限箱子')).toBeInTheDocument()
  expect(screen.getByText('US$9 一次付费')).toBeInTheDocument()
  expect(screen.getByText('不限箱子，永久解锁')).toBeInTheDocument()
  expect(screen.getByText('一次付费 · 不自动续费')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /购买 20 credits/ }))
  expect(mocks.checkout).toHaveBeenCalledWith('credits_20')
  await user.click(screen.getByRole('button', { name: /解锁无限箱子/ }))
  expect(mocks.unlimitedCheckout).toHaveBeenCalledTimes(1)
  expect(mocks.unlimitedCheckout.mock.calls[0]?.[0]).toBeUndefined()
})

test('records credit purchase completion only on the Checkout return', async () => {
  mocks.summary.mockResolvedValue({ credits_available: 20, credits_reserved: 0 })
  renderPage('/app/me/credits?checkout=success&checkout_product=credits_20')

  await vi.waitFor(() => expect(analytics.captureGrowthEvent).toHaveBeenCalledWith('purchase_completed', {
    product: 'credits_20',
    confirmation: 'checkout_return',
  }))
})

test('shows available and reserved credits without subscription controls', async () => {
  mocks.summary.mockResolvedValue({ credits_available: 82, credits_reserved: 3 })
  renderPage()

  expect(await screen.findByText('82')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /购买 100 credits/ })).toBeInTheDocument()
  expect(screen.getByText(/3 处理中/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /管理订阅/ })).not.toBeInTheDocument()
})

test('does not send desktop users back to the mobile-only profile page', async () => {
  mocks.summary.mockResolvedValue({ credits_available: 20, credits_reserved: 0 })
  renderPage()

  expect(await screen.findByRole('heading', { name: 'AI 点数' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回我的' })).not.toBeInTheDocument()
})
