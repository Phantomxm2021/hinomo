async function webhookSource(): Promise<string> {
  return await Deno.readTextFile(new URL('./index.ts', import.meta.url))
}

function assertContains(source: string, expected: string, message: string): void {
  if (!source.includes(expected)) throw new Error(message)
}

function testSource(name: string, fn: () => Promise<void>): void {
  Deno.test(name, fn)
}

testSource('paid unlimited-box checkout grants an account entitlement instead of credits', async () => {
  const source = await webhookSource()

  assertContains(source, 'userId !== metadataUserId', 'Webhook must reject mismatched Checkout user identities')
  assertContains(source, 'checkoutAction === BOXES_UNLIMITED_ACTION', 'Webhook must branch on unlimited boxes')
  assertContains(source, "session.mode === 'payment'", 'Entitlements require payment Checkout mode')
  assertContains(source, "session.payment_status === 'paid'", 'Entitlements require paid Checkout status')
  assertContains(source, "entitlementCode !== 'boxes_unlimited_lifetime'", 'Webhook must validate controlled metadata')
  assertContains(source, "database.rpc('grant_account_entitlement'", 'Box payments must grant an entitlement')
  assertContains(source, "database.rpc('grant_credits'", 'Credit purchases must keep their existing grant path')
})

testSource('duplicate active box purchase completes with an observable result', async () => {
  const source = await webhookSource()

  assertContains(source, 'duplicate_active', 'Webhook must inspect the entitlement grant result')
  assertContains(source, "'duplicate_paid_entitlement'", 'Duplicate active purchases need a stable result code')
})

testSource('full box refund revokes its entitlement while partial refund stays observable', async () => {
  const source = await webhookSource()

  assertContains(source, 'checkoutAction === BOXES_UNLIMITED_ACTION', 'Refund handling must identify box purchases')
  assertContains(source, "database.rpc('revoke_account_entitlement'", 'Full box refunds must revoke entitlement')
  assertContains(source, "p_source_provider: 'stripe'", 'Refund revocation must target the Stripe source')
  assertContains(source, "p_source_reference: `checkout:${checkout.id}`", 'Refund revocation must target its Checkout')
  assertContains(source, "'partial_refund_manual_review'", 'Partial refunds must leave an observable review result')
  assertContains(source, "database.rpc('revoke_unused_credits'", 'Credit refunds must keep their existing path')
  const partialRefundCheck = source.indexOf('charge.amount_refunded < charge.amount')
  const fullyRefundedCheck = source.indexOf('!charge.refunded')
  if (partialRefundCheck < 0 || fullyRefundedCheck < 0 || partialRefundCheck > fullyRefundedCheck) {
    throw new Error('Partial refunds must be observed before the fully-refunded flag short-circuit')
  }
})
