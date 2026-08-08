Deno.test('Managed Payments Checkout does not send unsupported payment_method_types', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url))

  if (source.includes('payment_method_types:')) {
    throw new Error('Managed Payments Checkout must omit payment_method_types')
  }
})
