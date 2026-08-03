import {
  appUrl,
  authenticatedUser,
  corsHeaders,
  ensureStripeCustomer,
  isAllowedAppOrigin,
  json,
  requiredStripePriceId,
  safeBillingError,
  stripeClient,
} from '../_shared/billing.ts'

type CheckoutAction = 'credits_20' | 'credits_100' | 'credits_500'

const actions: Record<CheckoutAction, { env: string; credits: number }> = {
  credits_20: { env: 'STRIPE_CREDIT_20_PRICE_ID', credits: 20 },
  credits_100: { env: 'STRIPE_CREDIT_100_PRICE_ID', credits: 100 },
  credits_500: { env: 'STRIPE_CREDIT_500_PRICE_ID', credits: 500 },
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    if (!isAllowedAppOrigin(request)) return new Response(null, { status: 403 })
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  try {
    const user = await authenticatedUser(request)
    const body = await request.json() as { action?: CheckoutAction }
    const action = body.action ? actions[body.action] : undefined
    if (!action) return json(request, { error: 'invalid_checkout_action' }, 400)

    const customer = await ensureStripeCustomer(user)
    const metadata: Record<string, string> = { supabase_user_id: user.id, checkout_action: body.action! }
    metadata.credit_amount = String(action.credits)
    const session = await stripeClient().checkout.sessions.create({
      mode: 'payment',
      customer,
      client_reference_id: user.id,
      line_items: [{ price: requiredStripePriceId(action.env), quantity: 1 }],
      success_url: appUrl('/app/me/credits?checkout=success'),
      cancel_url: appUrl('/app/me/credits?checkout=canceled'),
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata,
    })
    if (!session.url) throw new Error('checkout_url_missing')
    return json(request, { url: session.url })
  } catch (error) {
    const code = safeBillingError(error)
    return json(request, { error: code }, code === 'unauthorized' ? 401 : 503)
  }
})
