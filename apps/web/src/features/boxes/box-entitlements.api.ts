import type { Database } from '../../lib/database.types'
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

export async function startBoxUnlimitedCheckout(): Promise<never> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('billing-checkout', {
    method: 'POST',
    body: { action: 'boxes_unlimited' },
  })
  if (error || !data?.url) throw new Error(data?.error ?? 'billing_unavailable')
  window.location.assign(data.url)
  return new Promise<never>(() => undefined)
}

export function isBoxLimitReached(error: unknown): boolean {
  if (typeof error === 'string') return error === 'box_limit_reached'
  if (!error || typeof error !== 'object') return false

  const { details, message } = error as { details?: unknown; message?: unknown }
  return message === 'box_limit_reached'
    || (typeof details === 'string' && details.includes('box_limit_reached'))
}
