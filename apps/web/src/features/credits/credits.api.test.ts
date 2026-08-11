import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { startCheckout } from './credits.api'

const { mockInvoke, captureGrowthEvent } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  captureGrowthEvent: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: mockInvoke } },
}))
vi.mock('../../lib/analytics', () => ({ captureGrowthEvent }))

beforeEach(() => {
  mockInvoke.mockReset()
  captureGrowthEvent.mockReset()
})

afterEach(() => vi.unstubAllGlobals())

test('records a credit checkout start after receiving a valid redirect URL and before navigation', async () => {
  const assign = vi.fn()
  vi.stubGlobal('window', { location: { assign } })
  mockInvoke.mockResolvedValue({ data: { url: 'https://checkout.example/credits' }, error: null })

  void startCheckout('credits_20')
  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.example/credits'))

  expect(captureGrowthEvent).toHaveBeenCalledWith('checkout_started', { product: 'credits_20' })
  expect(captureGrowthEvent.mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0])
})

test('does not record a credit checkout start when billing returns no redirect URL', async () => {
  mockInvoke.mockResolvedValue({ data: { error: 'billing_unavailable' }, error: null })

  await expect(startCheckout('credits_20')).rejects.toThrow('billing_unavailable')

  expect(captureGrowthEvent).not.toHaveBeenCalled()
})
