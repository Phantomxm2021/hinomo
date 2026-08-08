import {
  appUrl,
  authenticatedUser,
  corsHeaders,
  ensureStripeCustomer,
  isAllowedAppOrigin,
  json,
  requiredStripePriceId,
  safeBillingError,
  serviceDatabase,
  stripeClient,
} from '../_shared/billing.ts'

type CheckoutAction = 'credits_20' | 'credits_100' | 'credits_500' | 'boxes_unlimited'
type CheckoutConfig =
  | { env: string; credits: number }
  | { env: string; entitlementCode: 'boxes_unlimited_lifetime' }

const actions: Record<CheckoutAction, CheckoutConfig> = {
  credits_20: { env: 'STRIPE_CREDIT_20_PRICE_ID', credits: 20 },
  credits_100: { env: 'STRIPE_CREDIT_100_PRICE_ID', credits: 100 },
  credits_500: { env: 'STRIPE_CREDIT_500_PRICE_ID', credits: 500 },
  boxes_unlimited: {
    env: 'STRIPE_BOXES_UNLIMITED_PRICE_ID',
    entitlementCode: 'boxes_unlimited_lifetime',
  },
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    if (!isAllowedAppOrigin(request)) return new Response(null, { status: 403 })
    return new Response(null, { status: 204, headers: corsHeaders(request) })
  }
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  try {
    const user = await authenticatedUser(request)
    const body = await request.json() as { action?: string }
    const checkoutAction = body.action
    const action = checkoutAction && Object.hasOwn(actions, checkoutAction)
      ? actions[checkoutAction as CheckoutAction]
      : undefined
    if (!action || !checkoutAction) return json(request, { error: 'invalid_checkout_action' }, 400)

    if ('entitlementCode' in action) {
      const { data: existingEntitlement, error: entitlementError } = await serviceDatabase()
        .from('account_entitlements')
        .select('id')
        .eq('user_id', user.id)
        .eq('entitlement_code', 'boxes_unlimited_lifetime')
        .eq('status', 'active')
        .maybeSingle()
      if (entitlementError) throw entitlementError
      if (existingEntitlement) return json(request, { error: 'entitlement_already_owned' }, 409)
    }

    const customer = await ensureStripeCustomer(user)
    const metadata: Record<string, string> = {
      supabase_user_id: user.id,
      checkout_action: checkoutAction,
    }
    if ('entitlementCode' in action) metadata.entitlement_code = action.entitlementCode
    else metadata.credit_amount = String(action.credits)
    const boxPurchase = checkoutAction === 'boxes_unlimited'
    const session = await stripeClient().checkout.sessions.create({
      mode: 'payment',
      customer,
      client_reference_id: user.id,
      line_items: [{ price: requiredStripePriceId(action.env), quantity: 1 }],
      success_url: appUrl(boxPurchase
        ? '/app/boxes?purchase=success&session_id={CHECKOUT_SESSION_ID}'
        : '/app/me/credits?checkout=success'),
      cancel_url: appUrl(boxPurchase
        ? '/app/boxes?purchase=canceled&session_id={CHECKOUT_SESSION_ID}'
        : '/app/me/credits?checkout=canceled'),
      allow_promotion_codes: !boxPurchase,
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
