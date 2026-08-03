import { expect, test } from 'vitest'
import { resolvePublicAppOrigin } from './env'

test('uses the runtime production origin when a local origin was baked into the build', () => {
  expect(resolvePublicAppOrigin('http://localhost:5173', 'https://hinomo.space')).toBe('https://hinomo.space')
  expect(resolvePublicAppOrigin('http://127.0.0.1:5173', 'https://hinomo.pages.dev')).toBe('https://hinomo.pages.dev')
})

test('keeps an explicitly configured production origin', () => {
  expect(resolvePublicAppOrigin('https://hinomo.space/', 'https://hinomo.pages.dev')).toBe('https://hinomo.space')
})

test('keeps the configured local origin during local development', () => {
  expect(resolvePublicAppOrigin('http://localhost:5173', 'http://127.0.0.1:4173')).toBe('http://localhost:5173')
})
