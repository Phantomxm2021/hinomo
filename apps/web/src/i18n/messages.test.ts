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

  test('explains that shared-venue members need the owner to unlock more boxes', () => {
    expect(messages['zh-CN'].boxes.contactVenueOwner).toBe('请联系场所所有者解锁')
    expect(messages['en-US'].boxes.contactVenueOwner).toContain('venue owner')
  })

  test('includes localized single-use venue invitation states', () => {
    expect(messages['zh-CN'].venueSharing.inviteLimit).toContain('24 小时')
    expect(messages['en-US'].venueSharing.inviteLimit).toContain('24 hours')
    expect(messages['zh-CN'].venueSharing.revoked).not.toBe(messages['en-US'].venueSharing.revoked)
  })

  test('includes localized family member management copy', () => {
    expect(messages['zh-CN'].venueSharing.createInvite).toBe('创建邀请')
    expect(messages['en-US'].venueSharing.leaveVenue).toBe('Leave venue')
    expect(messages['zh-CN'].venues.sharedBadge).toBe('家庭共享')
  })

  test('includes localized venue activity labels and directional event messages', () => {
    expect(messages['zh-CN'].venueActivity.title).toBe('最近活动')
    expect(messages['en-US'].venueActivity.title).toBe('Recent activity')
    expect(Object.keys(messages['zh-CN'].venueActivity.events)).toEqual([
      'item_created', 'item_moved', 'item_moved_out', 'item_moved_in', 'item_quantity_changed',
      'item_deleted', 'box_moved', 'box_moved_out', 'box_moved_in',
    ])
    expect(Object.values(messages['zh-CN'].venueActivity.eventLabels)).toEqual(['添加物品', '移动物品', '更改数量', '删除物品', '移动箱子'])
    expect(Object.values(messages['en-US'].venueActivity.eventLabels)).toEqual(['Item added', 'Item moved', 'Quantity changed', 'Item deleted', 'Box moved'])
    expect(messages['zh-CN'].venueActivity.departed).toBe('已离开')
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
