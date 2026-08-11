async function checkoutSource(): Promise<string> {
  return await Deno.readTextFile(new URL('./index.ts', import.meta.url))
}

function assertContains(source: string, expected: string, message: string): void {
  if (!source.includes(expected)) throw new Error(message)
}

function testSource(name: string, fn: () => Promise<void>): void {
  Deno.test(name, fn)
}

testSource('unlimited boxes uses the server-side Stripe price allowlist', async () => {
  const source = await checkoutSource()

  assertContains(source, "'boxes_unlimited'", 'Checkout action must allow boxes_unlimited')
  assertContains(
    source,
    "env: 'STRIPE_BOXES_UNLIMITED_PRICE_ID'",
    'Unlimited boxes must resolve its Price ID from the server environment',
  )
  assertContains(source, "mode: 'payment'", 'Unlimited boxes must use one-time payment mode')
  assertContains(
    source,
    'requiredStripePriceId(action.env)',
    'Checkout line items must use the allowlisted server-side Price ID',
  )
  assertContains(
    source,
    'Object.hasOwn(actions, checkoutAction)',
    'Checkout must reject inherited object keys as invalid actions',
  )
  if (/body\.(?:price|priceId|price_id)/.test(source)) {
    throw new Error('Checkout must never accept a client-provided Stripe Price ID')
  }
})

testSource('unlimited boxes carries controlled metadata and returns to the boxes page', async () => {
  const source = await checkoutSource()

  assertContains(source, 'checkout_action:', 'Checkout metadata must identify the controlled action')
  assertContains(source, 'metadata.entitlement_code', 'Checkout metadata must identify the entitlement')
  assertContains(source, "metadata.offer_code = 'founding_lifetime_v1'", 'Founder checkout must carry a controlled offer code')
  assertContains(source, 'supabase_user_id:', 'Checkout metadata must identify the authenticated user')
  assertContains(source, "/app/boxes?purchase=success&session_id={CHECKOUT_SESSION_ID}", 'Successful box purchases must return to boxes with support correlation')
  assertContains(source, "/app/boxes?purchase=canceled&session_id={CHECKOUT_SESSION_ID}", 'Canceled box purchases must return to boxes with support correlation')
  assertContains(source, 'allow_promotion_codes: !boxPurchase', 'Box purchases must not permit 100% promotions')
})

testSource('owned unlimited-box entitlement is rejected before creating Checkout', async () => {
  const source = await checkoutSource()

  assertContains(source, ".from('account_entitlements')", 'Checkout must query the local entitlement ledger')
  assertContains(source, ".eq('user_id', user.id)", 'Entitlement lookup must be scoped to the authenticated user')
  assertContains(
    source,
    ".eq('entitlement_code', 'boxes_unlimited_lifetime')",
    'Entitlement lookup must target unlimited boxes',
  )
  assertContains(source, ".eq('status', 'active')", 'Only active entitlements must block checkout')
  assertContains(source, "{ error: 'entitlement_already_owned' }, 409", 'Owned entitlement must return stable HTTP 409')
})

testSource('standard Checkout disables Managed Payments and enables Alipay and WeChat Pay', async () => {
  const source = await checkoutSource()

  assertContains(source, 'managed_payments: { enabled: false }', 'Checkout must opt out of Managed Payments')
  assertContains(
    source,
    "payment_method_types: ['card', 'alipay', 'wechat_pay']",
    'Checkout must explicitly allow card, Alipay, and WeChat Pay',
  )
})

testSource('standard Checkout configures WeChat Pay for web clients', async () => {
  const source = await checkoutSource()

  assertContains(
    source,
    "wechat_pay: { client: 'web' }",
    'Checkout must configure WeChat Pay for browser payments',
  )
})
