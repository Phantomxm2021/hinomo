import { expect, test } from 'vitest'
import { sha256Hex, sha256HexFallback } from './sha256'

const encoder = new TextEncoder()

test.each([
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
])('computes the standard SHA-256 vector for %j without Web Crypto', (input, expected) => {
  expect(sha256HexFallback(encoder.encode(input))).toBe(expected)
})

test('falls back when crypto.subtle is unavailable on a LAN HTTP iPhone page', async () => {
  await expect(sha256Hex(encoder.encode('abc'), undefined))
    .resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
