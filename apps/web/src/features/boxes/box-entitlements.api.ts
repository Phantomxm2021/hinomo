import type { Database } from '../../lib/database.types'
import { captureGrowthEvent } from '../../lib/analytics'
import { supabase } from '../../lib/supabase'

export type BoxPlanSummary = Database['public']['Functions']['get_box_plan_summary']['Returns'][number]

const emptySummary: BoxPlanSummary = {
  box_count: 0,
  free_limit: 3,
  unlimited_boxes: false,
  can_create: true,
}

export async function getBoxPlanSummary(): Promise<BoxPlanSummary> {
  const { data, error } = await supabase.rpc('get_box_plan_summary')
  if (error) throw error
  return data?.[0] ?? emptySummary
}

export async function getVenueBoxPlanSummary(venueId: string): Promise<BoxPlanSummary> {
  const { data, error } = await supabase.rpc('get_venue_box_plan_summary', { p_venue_id: venueId })
  if (error) throw error
  return data?.[0] ?? emptySummary
}

export async function startBoxUnlimitedCheckout(): Promise<never> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('billing-checkout', {
    method: 'POST',
    body: { action: 'boxes_unlimited' },
  })
  if (error) {
    const code = await readFunctionErrorCode(error)
    throw new Error(code ?? data?.error ?? 'billing_unavailable')
  }
  if (!data?.url) throw new Error(data?.error ?? 'billing_unavailable')
  captureGrowthEvent('checkout_started', { product: 'founding_lifetime' })
  window.location.assign(data.url)
  return new Promise<never>(() => undefined)
}

async function readFunctionErrorCode(error: unknown): Promise<string | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) return null
  const context = (error as { context?: unknown }).context
  if (!context || typeof context !== 'object' || !('json' in context)) return null

  try {
    const response = context as Response
    const payload = await response.clone().json() as unknown
    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
      return payload.error
    }
  } catch {
    // Non-JSON function errors use the stable billing fallback below.
  }
  return null
}

export function isBoxLimitReached(error: unknown): boolean {
  if (typeof error === 'string') return error === 'box_limit_reached'
  if (!error || typeof error !== 'object') return false

  const { details, message } = error as { details?: unknown; message?: unknown }
  return message === 'box_limit_reached'
    || (typeof details === 'string' && details.includes('box_limit_reached'))
}
