import Stripe from 'npm:stripe@18.5.0'
import { required, serviceDatabase, stripeClient } from '../_shared/billing.ts'

const BOXES_UNLIMITED_ACTION = 'boxes_unlimited'
const BOXES_UNLIMITED_ENTITLEMENT = 'boxes_unlimited_lifetime'
const FOUNDING_LIFETIME_OFFER = 'founding_lifetime_v1'
const creditActions = {
  credits_20: 20,
  credits_100: 100,
  credits_500: 500,
} as const

type EventResultCode =
  | 'duplicate_paid_entitlement'
  | 'refunded_paid_entitlement'
  | 'partial_refund_manual_review'
  | 'async_payment_failed'
  | null

function creditAmount(checkoutAction: string | undefined): number | undefined {
  if (!checkoutAction || !(checkoutAction in creditActions)) return undefined
  return creditActions[checkoutAction as keyof typeof creditActions]
}

type ServiceDatabase = ReturnType<typeof serviceDatabase>

async function validateCheckoutSessionIdentity(
  database: ServiceDatabase,
  session: Stripe.Checkout.Session,
): Promise<string> {
  const userId = session.client_reference_id
  const metadataUserId = session.metadata?.supabase_user_id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!userId || !metadataUserId || userId !== metadataUserId || !customerId) {
    throw new Error('checkout_identity_missing')
  }
  const { error } = await database.rpc('upsert_billing_customer', {
    p_user_id: userId, p_stripe_customer_id: customerId,
  })
  if (error) throw error
  return userId
}

async function fulfillCheckoutSession(
  database: ServiceDatabase,
  session: Stripe.Checkout.Session,
): Promise<EventResultCode> {
  const userId = await validateCheckoutSessionIdentity(database, session)
  if (session.mode === 'payment' && session.payment_status === 'paid') {
    const checkoutAction = session.metadata?.checkout_action
    const entitlementCode = session.metadata?.entitlement_code
    const offerCode = session.metadata?.offer_code
    if (checkoutAction === BOXES_UNLIMITED_ACTION) {
      if (entitlementCode !== 'boxes_unlimited_lifetime' || offerCode !== 'founding_lifetime_v1') {
        throw new Error('entitlement_metadata_invalid')
      }
      const { data: grant, error: grantError } = await database.rpc('grant_account_entitlement', {
        p_user_id: userId,
        p_entitlement_code: BOXES_UNLIMITED_ENTITLEMENT,
        p_source_provider: 'stripe',
        p_source_reference: `checkout:${session.id}`,
        p_granted_at: session.created ? new Date(session.created * 1000).toISOString() : null,
      })
      if (grantError) throw grantError
      const entitlementGrant = grant?.[0]
      if (!entitlementGrant) throw new Error('entitlement_grant_empty')
      if (!entitlementGrant.entitlement_id) return 'refunded_paid_entitlement'
      const { error: bonusError } = await database.rpc('grant_credits', {
        p_user_id: userId,
        p_kind: 'promotional',
        p_credit_amount: 20,
        p_effective_at: new Date().toISOString(),
        p_expires_at: null,
        p_source_reference: `founding-lifetime-bonus:${session.id}`,
        p_description: 'Founding Lifetime bonus',
      })
      if (bonusError) throw bonusError
      if (entitlementGrant.duplicate_active) return 'duplicate_paid_entitlement'
      return null
    }

    const credits = creditAmount(checkoutAction)
    if (!credits || Number(session.metadata?.credit_amount) !== credits) throw new Error('credit_pack_invalid')
    const { error: grantError } = await database.rpc('grant_credits', {
      p_user_id: userId,
      p_kind: 'purchased',
      p_credit_amount: credits,
      p_effective_at: new Date().toISOString(),
      p_expires_at: null,
      p_source_reference: `checkout:${session.id}`,
      p_description: `购买 ${credits} credits`,
    })
    if (grantError) throw grantError
  }
  return null
}

async function handleEvent(event: Stripe.Event): Promise<EventResultCode> {
  const database = serviceDatabase()
  if (event.type === 'checkout.session.async_payment_failed') {
    await validateCheckoutSessionIdentity(database, event.data.object as Stripe.Checkout.Session)
    return 'async_payment_failed'
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    return fulfillCheckoutSession(database, event.data.object as Stripe.Checkout.Session)
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    if (charge.amount_refunded < charge.amount) return 'partial_refund_manual_review'
    if (!charge.refunded) return null
    const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
    if (!paymentIntentId) return null
    const sessions = await stripeClient().checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 })
    const checkout = sessions.data[0]
    if (!checkout || checkout.mode !== 'payment') return null
    const checkoutAction = checkout.metadata?.checkout_action
    let error: unknown
    if (checkoutAction === BOXES_UNLIMITED_ACTION) {
      if (
        checkout.metadata?.entitlement_code !== BOXES_UNLIMITED_ENTITLEMENT
        || checkout.metadata?.offer_code !== FOUNDING_LIFETIME_OFFER
      ) {
        throw new Error('entitlement_metadata_invalid')
      }
      const result = await database.rpc('revoke_account_entitlement', {
        p_source_provider: 'stripe',
        p_source_reference: `checkout:${checkout.id}`,
      })
      if (result.error) throw result.error
      const bonusResult = await database.rpc('revoke_unused_credits', {
        p_kind: 'promotional',
        p_source_reference: `founding-lifetime-bonus:${checkout.id}`,
        p_description: '退款后收回创始人赠送额度',
      })
      error = bonusResult.error
    } else {
      const credits = creditAmount(checkoutAction)
      if (!credits || Number(checkout.metadata?.credit_amount) !== credits) throw new Error('credit_pack_invalid')
      const result = await database.rpc('revoke_unused_credits', {
        p_kind: 'purchased',
        p_source_reference: `checkout:${checkout.id}`,
        p_description: '退款后收回未使用额度',
      })
      error = result.error
    }
    if (error) throw error
    return null
  }

  return null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'method_not_allowed' }, { status: 405 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return Response.json({ error: 'signature_missing' }, { status: 400 })
  let event: Stripe.Event
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      await request.text(), signature, required('STRIPE_WEBHOOK_SECRET'),
    )
  } catch {
    return Response.json({ error: 'signature_invalid' }, { status: 400 })
  }

  const database = serviceDatabase()
  const { data: existing } = await database.from('stripe_webhook_events')
    .select('status').eq('stripe_event_id', event.id).maybeSingle()
  if (existing?.status === 'completed') return Response.json({ received: true })
  await database.from('stripe_webhook_events').upsert({
    stripe_event_id: event.id, event_type: event.type, status: 'processing', last_error_code: null,
  }, { onConflict: 'stripe_event_id' })
  try {
    const resultCode = await handleEvent(event)
    await database.from('stripe_webhook_events').update({
      status: 'completed', processed_at: new Date().toISOString(), last_error_code: resultCode,
    }).eq('stripe_event_id', event.id)
    return Response.json({ received: true })
  } catch (error) {
    const code = (error instanceof Error ? error.message : 'webhook_failed')
      .toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 120)
    await database.from('stripe_webhook_events').update({ status: 'failed', last_error_code: code })
      .eq('stripe_event_id', event.id)
    console.error('stripe_webhook_failed', { eventId: event.id, type: event.type, code })
    return Response.json({ error: 'webhook_failed' }, { status: 500 })
  }
})
