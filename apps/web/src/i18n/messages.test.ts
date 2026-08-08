import { describe, expect, test } from 'vitest'
import { parseLocale } from './locale'
import { messages } from './messages'

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (!value || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, value)
}

describe('message catalog', () => {
  test('uses neutral copy while a box purchase is still being confirmed', () => {
    expect(messages['zh-CN'].boxes.purchaseDelayed).toBe('付款状态仍在确认中，请稍后再检查。')
    expect(messages['en-US'].boxes.purchaseDelayed).toBe('Payment status is still being confirmed. Please check again later.')
  })

  test('keeps Simplified Chinese and English leaf keys in sync', () => {
    const chineseKeys = leafPaths(messages['zh-CN']).sort()
    const englishKeys = leafPaths(messages['en-US']).sort()

    expect(englishKeys).toEqual(chineseKeys)
  })

  test('contains a non-empty string for every translated leaf', () => {
    for (const locale of ['zh-CN', 'en-US'] as const) {
      for (const path of leafPaths(messages[locale])) {
        const message = readPath(messages[locale], path)
        expect(typeof message, `${locale}.${path}`).toBe('string')
        expect((message as string).trim(), `${locale}.${path}`).not.toBe('')
      }
    }
  })

  test('falls back to Simplified Chinese for unknown locale values', () => {
    expect(parseLocale('fr-FR')).toBe('zh-CN')
    expect(parseLocale('')).toBe('zh-CN')
    expect(parseLocale(null)).toBe('zh-CN')
  })
})
