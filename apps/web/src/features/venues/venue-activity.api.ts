import { supabase } from '../../lib/supabase'

export type VenueActivityEvent = 'item_created' | 'item_moved' | 'item_quantity_changed' | 'item_deleted' | 'box_moved'

export type VenueActivityCursor = {
  createdAt: string
  id: string
}

export type VenueActivityEntry = {
  id: string
  actor_id: string | null
  actor_display_name: string | null
  actor_is_current: boolean
  event_code: VenueActivityEvent
  entity_type: string
  entity_id: string
  snapshot: unknown
  created_at: string
}

type Translate = (key: string, params?: Record<string, string | number | boolean>) => string

function snapshotRecord(snapshot: unknown): Record<string, unknown> {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown>
    : {}
}

function snapshotName(snapshot: unknown, fallback: string, key = 'entity_name'): string {
  const value = snapshotRecord(snapshot)[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const name = (value as Record<string, unknown>).name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return fallback
}

export async function listVenueActivity(input: {
  venueId: string
  actorId?: string | null
  eventCode?: VenueActivityEvent | null
  cursor?: VenueActivityCursor | null
}): Promise<VenueActivityEntry[]> {
  const { data, error } = await supabase.rpc('list_venue_activity', {
    p_venue_id: input.venueId,
    p_actor_id: input.actorId ?? null,
    p_event_code: input.eventCode ?? null,
    p_before_created_at: input.cursor?.createdAt ?? null,
    p_before_id: input.cursor?.id ?? null,
    p_limit: 50,
  })
  if (error) throw error
  return (data ?? []) as VenueActivityEntry[]
}

export function activityMessage(entry: VenueActivityEntry, t: Translate): string {
  const actor = entry.actor_display_name?.trim() || t('venueActivity.unknownActor')
  const snapshot = snapshotRecord(entry.snapshot)
  const direction = snapshot.direction
  const item = snapshotName(entry.snapshot, t('venueActivity.deletedItem'))
  const from = snapshotName(entry.snapshot, t('venueActivity.deletedBox'), 'from')
  const to = snapshotName(entry.snapshot, t('venueActivity.deletedBox'), 'to')

  switch (entry.event_code) {
    case 'item_created': return t('venueActivity.events.item_created', { actor, item })
    case 'item_moved':
      if (direction === 'out') return t('venueActivity.events.item_moved_out', { actor, item, from })
      if (direction === 'in') return t('venueActivity.events.item_moved_in', { actor, item, to })
      return t('venueActivity.events.item_moved', { actor, item, from, to })
    case 'item_quantity_changed': {
      const before = snapshot.quantity_before
      const after = snapshot.quantity_after
      return t('venueActivity.events.item_quantity_changed', {
        actor, item, before: typeof before === 'number' || typeof before === 'string' ? before : '—',
        after: typeof after === 'number' || typeof after === 'string' ? after : '—',
      })
    }
    case 'item_deleted': return t('venueActivity.events.item_deleted', { actor, item })
    case 'box_moved':
      if (direction === 'out') return t('venueActivity.events.box_moved_out', { actor, box: item, from })
      if (direction === 'in') return t('venueActivity.events.box_moved_in', { actor, box: item, to })
      return t('venueActivity.events.box_moved', { actor, box: item, from, to })
  }
}
