import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

export type CreditSummary = Database['public']['Functions']['get_credit_summary']['Returns'][number]
export type CreditTransaction = Database['public']['Functions']['list_credit_transactions']['Returns'][number]
export type CheckoutAction = 'credits_20' | 'credits_100' | 'credits_500'

const emptySummary: CreditSummary = {
  credits_available: 0,
  credits_reserved: 0,
}

export async function getCreditSummary(): Promise<CreditSummary> {
  const { data, error } = await supabase.rpc('get_credit_summary')
  if (error) throw error
  return data?.[0] ?? emptySummary
}

export async function listCreditTransactions(limit = 20): Promise<CreditTransaction[]> {
  const { data, error } = await supabase.rpc('list_credit_transactions', { p_limit: limit })
  if (error) throw error
  return data ?? []
}

async function billingRedirect(body: object): Promise<never> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>('billing-checkout', {
    method: 'POST',
    body: body ?? {},
  })
  if (error || !data?.url) throw new Error(data?.error ?? 'billing_unavailable')
  window.location.assign(data.url)
  return new Promise<never>(() => undefined)
}

export function startCheckout(action: CheckoutAction): Promise<never> {
  return billingRedirect({ action })
}

export function packingBillingError(error: unknown): 'insufficient_credits' | null {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
  if (message.includes('insufficient_credits')) return 'insufficient_credits'
  return null
}
