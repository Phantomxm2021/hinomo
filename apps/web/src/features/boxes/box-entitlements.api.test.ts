import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getBoxPlanSummary, getVenueBoxPlanSummary, startBoxUnlimitedCheckout } from './box-entitlements.api'

const { mockInvoke, mockRpc } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockRpc: vi.fn(),
}))
const analytics = vi.hoisted(() => ({ captureGrowthEvent: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    rpc: mockRpc,
  },
}))
vi.mock('../../lib/analytics', () => analytics)

beforeEach(() => {
  mockInvoke.mockReset()
  mockRpc.mockReset()
  analytics.captureGrowthEvent.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('loads the signed-in box plan summary through its RPC', async () => {
  mockRpc.mockResolvedValue({
    data: [{ box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false }],
    error: null,
  })

  await expect(getBoxPlanSummary()).resolves.toEqual({
    box_count: 3,
    free_limit: 3,
    unlimited_boxes: false,
    can_create: false,
  })
  expect(mockRpc).toHaveBeenCalledWith('get_box_plan_summary')
})

test('loads a venue owner plan summary through the venue RPC', async () => {
  mockRpc.mockResolvedValue({
    data: [{ box_count: 3, free_limit: 3, unlimited_boxes: false, can_create: false }],
    error: null,
  })

  await expect(getVenueBoxPlanSummary('venue-1')).resolves.toMatchObject({ box_count: 3, can_create: false })
  expect(mockRpc).toHaveBeenCalledWith('get_venue_box_plan_summary', { p_venue_id: 'venue-1' })
})

test('uses an empty plan only when the summary RPC has no rows', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null })

  await expect(getBoxPlanSummary()).resolves.toEqual({
    box_count: 0,
    free_limit: 3,
    unlimited_boxes: false,
    can_create: true,
  })
})

test('propagates box-plan summary RPC errors', async () => {
  const error = new Error('plan unavailable')
  mockRpc.mockResolvedValue({ data: null, error })

  await expect(getBoxPlanSummary()).rejects.toBe(error)
})

test('redirects to the unlimited-box checkout returned by billing', async () => {
  const assign = vi.fn()
  vi.stubGlobal('window', { location: { assign } })
  mockInvoke.mockResolvedValue({ data: { url: 'https://checkout.example/boxes' }, error: null })

  void startBoxUnlimitedCheckout()
  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.example/boxes'))

  expect(analytics.captureGrowthEvent).toHaveBeenCalledWith('checkout_started', { product: 'founding_lifetime' })
  expect(analytics.captureGrowthEvent.mock.invocationCallOrder[0]).toBeLessThan(assign.mock.invocationCallOrder[0])

  expect(mockInvoke).toHaveBeenCalledWith('billing-checkout', {
    method: 'POST',
    body: { action: 'boxes_unlimited' },
  })
})

test('does not record a founder checkout start when billing returns no redirect URL', async () => {
  mockInvoke.mockResolvedValue({ data: { error: 'billing_unavailable' }, error: null })

  await expect(startBoxUnlimitedCheckout()).rejects.toThrow('billing_unavailable')

  expect(analytics.captureGrowthEvent).not.toHaveBeenCalled()
})

test('surfaces the billing service error when checkout is unavailable', async () => {
  mockInvoke.mockResolvedValue({ data: { error: 'billing_unavailable' }, error: null })

  await expect(startBoxUnlimitedCheckout()).rejects.toThrow('billing_unavailable')
})

test('maps checkout function errors to the stable billing fallback', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: new Error('network unavailable') })

  await expect(startBoxUnlimitedCheckout()).rejects.toThrow('billing_unavailable')
})

test('preserves the stable error code from a non-2xx function response', async () => {
  const context = new Response(JSON.stringify({ error: 'entitlement_already_owned' }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  })
  mockInvoke.mockResolvedValue({
    data: null,
    error: { name: 'FunctionsHttpError', context },
  })

  await expect(startBoxUnlimitedCheckout()).rejects.toThrow('entitlement_already_owned')
})
