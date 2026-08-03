import Stripe from 'npm:stripe@18.5.0'
import { required, serviceDatabase, stripeClient } from '../_shared/billing.ts'

async function handleEvent(event: Stripe.Event): Promise<void> {
  const database = serviceDatabase()
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id || session.metadata?.supabase_user_id
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    if (!userId || !customerId) throw new Error('checkout_identity_missing')
    const { error } = await database.rpc('upsert_billing_customer', {
      p_user_id: userId, p_stripe_customer_id: customerId,
    })
    if (error) throw error
    if (session.mode === 'payment' && session.payment_status === 'paid') {
      const credits = Number(session.metadata?.credit_amount)
      if (![20, 100, 500].includes(credits)) throw new Error('credit_pack_invalid')
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
    return
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    if (!charge.refunded || charge.amount_refunded < charge.amount) return
    const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
    if (!paymentIntentId) return
    const sessions = await stripeClient().checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 })
    const checkout = sessions.data[0]
    if (!checkout || checkout.mode !== 'payment') return
    const { error } = await database.rpc('revoke_unused_credits', {
      p_kind: 'purchased',
      p_source_reference: `checkout:${checkout.id}`,
      p_description: '退款后收回未使用额度',
    })
    if (error) throw error
  }
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
    await handleEvent(event)
    await database.from('stripe_webhook_events').update({
      status: 'completed', processed_at: new Date().toISOString(), last_error_code: null,
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
