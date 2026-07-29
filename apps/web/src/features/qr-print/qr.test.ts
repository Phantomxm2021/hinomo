import { expect, test } from 'vitest'
import { boxQrUrl } from './qr'

test('builds a stable public QR URL', () => {
  expect(
    boxQrUrl(
      'https://nomo.example/',
      '123e4567-e89b-12d3-a456-426614174000',
    ),
  ).toBe(
    'https://nomo.example/b/123e4567-e89b-12d3-a456-426614174000',
  )
})
