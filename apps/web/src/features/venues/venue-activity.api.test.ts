import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activityMessage, listVenueActivity, type VenueActivityEntry } from './venue-activity.api'
import { messages } from '../../i18n/messages'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mockRpc } }))

const entry: VenueActivityEntry = {
  id: 'activity-1', actor_id: 'member-1', actor_display_name: 'Lin', actor_is_current: false,
  event_code: 'item_moved', entity_type: 'item', entity_id: 'item-1',
  snapshot: { entity_name: 'Lantern', from: { name: 'Hall' }, to: { name: 'Garage' }, ignored: 'never render this' },
  created_at: '2026-08-09T12:00:00.000Z',
}

function translator(locale: 'zh-CN' | 'en-US') {
  return (key: string, params?: Record<string, string | number | boolean>) => {
    const template = key.split('.').reduce<unknown>((value, part) => (
      value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined
    ), messages[locale])
    if (typeof template !== 'string') return key
    return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (placeholder, name: string) => (
      params?.[name] === undefined ? placeholder : String(params[name])
    ))
  }
}

describe('venue activity api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: [entry], error: null })
  })

  it('requests the first fifty activity rows with null filters and cursor', async () => {
    await expect(listVenueActivity({ venueId: 'venue-1' })).resolves.toEqual([entry])
    expect(mockRpc).toHaveBeenCalledWith('list_venue_activity', {
      p_venue_id: 'venue-1', p_actor_id: null, p_event_code: null,
      p_before_created_at: null, p_before_id: null, p_limit: 50,
    })
  })

  it('sends selected filters and the tuple cursor from the preceding final row', async () => {
    await listVenueActivity({
      venueId: 'venue-1', actorId: 'member-1', eventCode: 'item_moved',
      cursor: { createdAt: entry.created_at, id: entry.id },
    })
    expect(mockRpc).toHaveBeenCalledWith('list_venue_activity', {
      p_venue_id: 'venue-1', p_actor_id: 'member-1', p_event_code: 'item_moved',
      p_before_created_at: '2026-08-09T12:00:00.000Z', p_before_id: 'activity-1', p_limit: 50,
    })
  })

  it('formats only whitelisted snapshot values and uses deleted fallbacks', () => {
    const t = (key: string, params?: Record<string, string | number | boolean>) => `${key}:${JSON.stringify(params)}`
    expect(activityMessage(entry, t)).toContain('Lantern')
    expect(activityMessage(entry, t)).toContain('Hall')
    expect(activityMessage(entry, t)).not.toContain('never render this')
    expect(activityMessage({ ...entry, event_code: 'item_deleted', snapshot: { secret: 'nope' } }, t)).toContain('venueActivity.deletedItem')
    expect(activityMessage({ ...entry, event_code: 'box_moved', snapshot: { entity_name: 'Archive', from: {}, to: {} } }, t)).toContain('venueActivity.deletedBox')
  })

  it.each([
    ['zh-CN', 'Lin 将 Lantern 从 Hall 移出此场地', 'Lin 将 Lantern 移入此场地的 Garage'],
    ['en-US', 'Lin moved Lantern out of this venue from Hall', 'Lin moved Lantern into this venue to Garage'],
  ] as const)('formats cross-venue item direction in %s without a deleted endpoint', (locale, outMessage, inMessage) => {
    const t = translator(locale)
    expect(activityMessage({ ...entry, snapshot: { entity_name: 'Lantern', from: { name: 'Hall' }, direction: 'out' } }, t)).toBe(outMessage)
    expect(activityMessage({ ...entry, snapshot: { entity_name: 'Lantern', to: { name: 'Garage' }, direction: 'in' } }, t)).toBe(inMessage)
  })

  it.each([
    ['zh-CN', 'Lin 将箱子 Archive 从 Hall 移出此场地', 'Lin 将箱子 Archive 移入此场地的 Garage'],
    ['en-US', 'Lin moved box Archive out of this venue from Hall', 'Lin moved box Archive into this venue to Garage'],
  ] as const)('formats cross-venue box direction in %s without a deleted endpoint', (locale, outMessage, inMessage) => {
    const t = translator(locale)
    const boxEntry = { ...entry, event_code: 'box_moved' as const }
    expect(activityMessage({ ...boxEntry, snapshot: { entity_name: 'Archive', from: { name: 'Hall' }, direction: 'out' } }, t)).toBe(outMessage)
    expect(activityMessage({ ...boxEntry, snapshot: { entity_name: 'Archive', to: { name: 'Garage' }, direction: 'in' } }, t)).toBe(inMessage)
  })
})
