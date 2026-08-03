import { supabase } from '../../lib/supabase'

export type SpaceSummary = {
  id: string
  venue_id: string
  venue_name: string
  name: string
  description: string | null
  box_count: number
  item_count: number
}

export type SpaceInput = {
  venue_id: string
  name: string
  description: string | null
}

export type SpaceLayout = {
  space_id: string
  x: number
  y: number
  width: number
  height: number
}

export type SpacePosition = Omit<SpaceLayout, 'space_id'>

const LAYOUT_STORAGE_UNAVAILABLE = 'LAYOUT_STORAGE_UNAVAILABLE'

function isVenueRelationshipUnavailable(error: { code?: string } | null) {
  return error?.code === 'PGRST200' || error?.code === 'PGRST205' || error?.code === '42703'
}

type SpaceListRow = {
  id: string
  venue_id?: string
  name: string
  description: string | null
  venues?: { name: string } | null
  boxes: Array<{ id: string; items: Array<{ count: number }> }>
}

function mapSpaceRows(rows: SpaceListRow[]): SpaceSummary[] {
  return rows.map((space) => {
    const boxes = space.boxes ?? []
    return {
      id: space.id,
      venue_id: space.venue_id ?? '',
      venue_name: space.venues?.name ?? '',
      name: space.name,
      description: space.description,
      box_count: boxes.length,
      item_count: boxes.reduce((count, box) => count + (box.items[0]?.count ?? 0), 0),
    }
  })
}

export function isLayoutStorageUnavailable(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === LAYOUT_STORAGE_UNAVAILABLE,
  )
}

export async function listSpaces(): Promise<SpaceSummary[]> {
  const modern = await supabase
    .from('spaces')
    .select('id, venue_id, name, description, venues(name), boxes(id, items(count))')
    .order('name')

  if (!modern.error) return mapSpaceRows(modern.data ?? [])
  if (!isVenueRelationshipUnavailable(modern.error)) throw modern.error

  const legacy = await supabase
    .from('spaces')
    .select('id, name, description, boxes(id, items(count))')
    .order('name')
  if (legacy.error) throw legacy.error
  return mapSpaceRows(legacy.data ?? [])
}

export async function createSpace(input: SpaceInput) {
  const { data: sessionData } = await supabase.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) throw new Error('authentication is required')

  const { data, error } = await supabase
    .from('spaces')
    .insert({ ...input, owner_id: ownerId })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function createSpaces(inputs: SpaceInput[]) {
  if (inputs.length === 0) return []
  const { data: sessionData } = await supabase.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) throw new Error('authentication is required')

  const { data, error } = await supabase
    .from('spaces')
    .insert(inputs.map((input) => ({ ...input, owner_id: ownerId })))
    .select('id')

  if (error) throw error
  return data ?? []
}

export async function deleteSpace(spaceId: string) {
  const { error } = await supabase.from('spaces').delete().eq('id', spaceId)
  if (error) throw error
}

export async function updateSpace(spaceId: string, input: SpaceInput) {
  const { error } = await supabase.from('spaces').update(input).eq('id', spaceId)
  if (error) throw error
}

export async function listSpaceLayouts(): Promise<SpaceLayout[]> {
  const { data, error } = await supabase
    .from('space_layouts')
    .select('space_id, x_percent, y_percent, width_percent, height_percent')

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw Object.assign(new Error('space layout storage is not installed'), {
        code: LAYOUT_STORAGE_UNAVAILABLE,
      })
    }
    throw error
  }

  return (data ?? []).map((layout) => ({
    space_id: layout.space_id,
    x: layout.x_percent,
    y: layout.y_percent,
    width: layout.width_percent,
    height: layout.height_percent,
  }))
}

export async function saveSpaceLayout(spaceId: string, position: SpacePosition) {
  const { data: sessionData } = await supabase.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) throw new Error('authentication is required')

  const { error } = await supabase.from('space_layouts').upsert({
    space_id: spaceId,
    owner_id: ownerId,
    x_percent: position.x,
    y_percent: position.y,
    width_percent: position.width,
    height_percent: position.height,
  })
  if (error) throw error
}
