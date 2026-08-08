import { expect, test } from 'vitest'
import { messages } from '../i18n/messages'

test('task 8 feature copy has complete Chinese and English translations', () => {
  const keys = [
    ['scanner.secureContext', 'This page is not HTTPS, so the camera is unavailable'],
    ['packing.title', 'AI packing'],
    ['venues.title', 'Venue management'],
    ['credits.title', 'AI credits'],
    ['profile.accountDetails', 'Account details'],
    ['common.ok', 'OK'],
  ] as const

  for (const [key, expectedEnglish] of keys) {
    const get = (tree: unknown) => key.split('.').reduce<unknown>((value, segment) => (
      value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined
    ), tree)

    expect(get(messages['zh-CN'])).toEqual(expect.any(String))
    expect(get(messages['en-US'])).toBe(expectedEnglish)
  }
})
