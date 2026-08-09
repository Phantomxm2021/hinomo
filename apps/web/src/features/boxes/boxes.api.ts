import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { ItemRecord } from '../items/items.api'

export type BoxInput = {
  space_id: string
  name: string
  category: string | null
  location: string | null
  description: string | null
  visibility: Database['public']['Enums']['box_visibility']
}

export type CreatedBox = {
  id: string
  public_id: string
  box_code: string
  name: string
}

export type BoxSummary = CreatedBox & {
  space_id: string
  venue_id?: string
  location: string | null
  visibility: Database['public']['Enums']['box_visibility']
  space_name: string
  venue_name: string
  cover_object_key: string | null
  item_count: number
  updated_at: string
}

export type EditableBox = CreatedBox & BoxInput

export type PublicBox = EditableBox & {
  owner_id: string
  space_name: string
  venue_name: string
  cover_object_key: string | null
  updated_at: string
  venue_id?: string
  items: ItemRecord[]
}

type PublicBoxRpcRow = Database['public']['Functions']['get_public_box']['Returns'][number]

function mapPublicBox(row: Omit<PublicBox, 'items'> & { items: unknown }): PublicBox {
  return {
    ...row,
    items: Array.isArray(row.items) ? row.items as ItemRecord[] : [],
  }
}

function mapAccessibleBox(data: {
  id: string
  owner_id: string
  public_id: string
  box_code: string
  space_id: string
  name: string
  category: string | null
  location: string | null
  description: string | null
  visibility: Database['public']['Enums']['box_visibility']
  cover_object_key: string | null
  updated_at: string
  spaces: { venue_id?: string; name: string; venues?: { name: string } | null } | null
  items: ItemRecord[]
}): PublicBox {
  return mapPublicBox({
    id: data.id,
    owner_id: data.owner_id,
    public_id: data.public_id,
    box_code: data.box_code,
    space_id: data.space_id,
    name: data.name,
    category: data.category,
    location: data.location,
    description: data.description,
    visibility: data.visibility,
    cover_object_key: data.cover_object_key,
    updated_at: data.updated_at,
    ...(data.spaces?.venue_id ? { venue_id: data.spaces.venue_id } : {}),
    venue_name: data.spaces?.venues?.name ?? '',
    space_name: data.spaces?.name ?? '',
    items: data.items,
  })
}

async function getAccessibleBoxByPublicId(publicId: string): Promise<PublicBox | null> {
  const modern = await supabase
    .from('boxes')
    .select('id, owner_id, public_id, box_code, space_id, name, category, location, description, visibility, cover_object_key, updated_at, spaces(venue_id, name, venues(name)), items(id, name, category, quantity, stored_quantity, description, image_object_key)')
    .eq('public_id', publicId)
    .single()

  if (!modern.error) return mapAccessibleBox(modern.data)
  if (modern.error.code === 'PGRST116') return null
  throw modern.error
}

export async function getBoxByPublicId(publicId: string): Promise<PublicBox | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.user.id) {
    const accessible = await getAccessibleBoxByPublicId(publicId)
    if (accessible) return accessible
  }

  const { data, error } = await supabase.rpc('get_public_box', { p_public_id: publicId })
  if (error) throw error
  const row = data?.[0] as PublicBoxRpcRow | undefined
  return row ? mapPublicBox(row) : null
}

export async function getBox(boxId: string): Promise<EditableBox> {
  const { data, error } = await supabase
    .from('boxes')
    .select('id, public_id, box_code, space_id, name, category, location, description, visibility')
    .eq('id', boxId)
    .single()

  if (error) throw error
  return data
}

export async function listBoxes(): Promise<BoxSummary[]> {
  return listBoxesByVenue()
}

export async function listBoxesForVenue(venueId: string): Promise<BoxSummary[]> {
  return listBoxesByVenue(venueId)
}

async function listBoxesByVenue(venueId?: string): Promise<BoxSummary[]> {
  const { data, error } = await supabase.rpc('list_accessible_boxes', { p_venue_id: venueId ?? null })
  if (error) throw error
  return (data ?? []).map((box) => ({
    ...box,
    item_count: box.item_count,
  }))
}

export async function createBox(input: BoxInput): Promise<CreatedBox> {
  const { data: sessionData } = await supabase.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) throw new Error('authentication is required')

  const { data, error } = await supabase.rpc('create_box', {
    p_space_id: input.space_id,
    p_name: input.name,
    p_category: input.category,
    p_location: input.location,
    p_description: input.description,
    p_visibility: input.visibility,
  })

  if (error) throw error
  const created = data?.[0]
  if (!created) throw new Error('box_creation_empty')
  return created
}

export async function deleteBox(boxId: string) {
  const { error } = await supabase.from('boxes').delete().eq('id', boxId)
  if (error) throw error
}

export async function updateBox(boxId: string, input: BoxInput) {
  const { error } = await supabase.rpc('update_box', {
    p_box_id: boxId,
    p_space_id: input.space_id,
    p_name: input.name,
    p_category: input.category,
    p_location: input.location,
    p_description: input.description,
    p_visibility: input.visibility,
  })
  if (error) throw error
}
