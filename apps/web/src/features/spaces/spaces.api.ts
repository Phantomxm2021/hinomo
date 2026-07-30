import { supabase } from '../../lib/supabase'

export type SpaceSummary = {
  id: string
  name: string
  description: string | null
  box_count: number
  item_count: number
}

export type SpaceInput = {
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

export async function listSpaces(): Promise<SpaceSummary[]> {
  const { data, error } = await supabase
    .from('spaces')
    .select('id, name, description, boxes(id, items(count))')
    .order('name')

  if (error) throw error

  return (data ?? []).map((space) => {
    const boxes = space.boxes ?? []

    return {
      id: space.id,
      name: space.name,
      description: space.description,
      box_count: boxes.length,
      item_count: boxes.reduce(
        (count, box) => count + (box.items[0]?.count ?? 0),
        0,
      ),
    }
  })
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
    if (error.code === '42P01' || error.code === 'PGRST205') return []
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
