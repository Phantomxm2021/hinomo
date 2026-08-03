import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.57.4'
import Stripe from 'npm:stripe@18.5.0'

export function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`missing_${name.toLowerCase()}`)
  return value
}

export function requiredStripePriceId(name: string): string {
  const value = required(name)
  if (!value.startsWith('price_')) {
    throw new Error(`invalid_${name.toLowerCase()}_expected_price_id`)
  }
  return value
}

export function stripeClient(): Stripe {
  return new Stripe(required('STRIPE_SECRET_KEY'), { maxNetworkRetries: 1 })
}

export function serviceDatabase(): SupabaseClient {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function authenticatedUser(request: Request): Promise<User> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.toLowerCase().startsWith('bearer ')) throw new Error('unauthorized')
  const database = serviceDatabase()
  const { data, error } = await database.auth.getUser(authorization.slice(7))
  if (error || !data.user) throw new Error('unauthorized')
  return data.user
}

export function appUrl(path: string): string {
  const origin = required('PUBLIC_APP_ORIGIN').replace(/\/$/, '')
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

function normalizedOrigin(value: string): string {
  return value.trim().replace(/\/$/, '')
}

export function allowedAppOrigins(): Set<string> {
  const primary = normalizedOrigin(required('PUBLIC_APP_ORIGIN'))
  const additional = (Deno.env.get('PUBLIC_APP_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map(normalizedOrigin)
    .filter(Boolean)
  return new Set([primary, ...additional])
}

export function isAllowedAppOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  return Boolean(origin && allowedAppOrigins().has(normalizedOrigin(origin)))
}

export function corsHeaders(request: Request): HeadersInit {
  const primary = normalizedOrigin(required('PUBLIC_APP_ORIGIN'))
  const origin = normalizedOrigin(request.headers.get('origin') ?? '')
  return {
    'Access-Control-Allow-Origin': allowedAppOrigins().has(origin) ? origin : primary,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) })
}

export function safeBillingError(error: unknown): string {
  const value = error instanceof Error ? error.message : 'billing_error'
  if (value === 'unauthorized') return value
  console.error('billing_error', { code: value.replace(/[^a-z0-9_]+/gi, '_').slice(0, 120) })
  return 'billing_unavailable'
}

export async function ensureStripeCustomer(user: User): Promise<string> {
  const database = serviceDatabase()
  const { data, error } = await database.from('billing_customers')
    .select('stripe_customer_id').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (data?.stripe_customer_id) return data.stripe_customer_id as string

  const customer = await stripeClient().customers.create({
    email: user.email,
    metadata: { supabase_user_id: user.id },
  }, { idempotencyKey: `nomo-customer-${user.id}` })
  const { error: syncError } = await database.rpc('upsert_billing_customer', {
    p_user_id: user.id,
    p_stripe_customer_id: customer.id,
  })
  if (syncError) throw syncError
  return customer.id
}
