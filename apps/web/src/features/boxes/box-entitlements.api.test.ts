import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getBoxPlanSummary, startBoxUnlimitedCheckout } from './box-entitlements.api'

const { mockInvoke, mockRpc } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    rpc: mockRpc,
  },
}))

beforeEach(() => {
  mockInvoke.mockReset()
  mockRpc.mockReset()
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

  expect(mockInvoke).toHaveBeenCalledWith('billing-checkout', {
    method: 'POST',
    body: { action: 'boxes_unlimited' },
  })
})

test('surfaces the billing service error when checkout is unavailable', async () => {
  mockInvoke.mockResolvedValue({ data: { error: 'billing_unavailable' }, error: null })

  await expect(startBoxUnlimitedCheckout()).rejects.toThrow('billing_unavailable')
})

test('maps checkout function errors to the stable billing fallback', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: new Error('network unavailable') })

  await expect(startBoxUnlimitedCheckout()).rejects.toThrow('billing_unavailable')
})
