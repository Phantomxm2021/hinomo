import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CreditsPage } from './CreditsPage'

const mocks = vi.hoisted(() => ({
  summary: vi.fn(), transactions: vi.fn(), checkout: vi.fn(),
}))
vi.mock('./credits.api', () => ({
  getCreditSummary: mocks.summary,
  listCreditTransactions: mocks.transactions,
  startCheckout: mocks.checkout,
}))

function renderPage() {
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CreditsPage /></QueryClientProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transactions.mockResolvedValue([])
  mocks.checkout.mockReturnValue(new Promise(() => undefined))
})
afterEach(cleanup)

test('offers one-time credit packs without a subscription', async () => {
  mocks.summary.mockResolvedValue({ credits_available: 0, credits_reserved: 0 })
  renderPage()
  const user = userEvent.setup()

  expect(await screen.findByText('不自动续费')).toBeInTheDocument()
  expect(screen.getByText('HK$12')).toBeInTheDocument()
  expect(screen.getByText('HK$42')).toBeInTheDocument()
  expect(screen.getByText('HK$148')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /购买 20 credits/ }))
  expect(mocks.checkout).toHaveBeenCalledWith('credits_20')
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

  expect(await screen.findByRole('heading', { name: 'AI Credits' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回我的' })).not.toBeInTheDocument()
})
