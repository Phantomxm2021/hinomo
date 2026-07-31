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
  location: string | null
  visibility: Database['public']['Enums']['box_visibility']
  space_name: string
  cover_object_key: string | null
  item_count: number
  updated_at: string
}

export type EditableBox = CreatedBox & BoxInput

export type PublicBox = EditableBox & {
  owner_id: string
  space_name: string
  cover_object_key: string | null
  updated_at: string
  items: ItemRecord[]
}

export async function getBoxByPublicId(publicId: string): Promise<PublicBox | null> {
  const { data, error } = await supabase
    .from('boxes')
    .select('id, owner_id, public_id, box_code, space_id, name, category, location, description, visibility, cover_object_key, updated_at, spaces(name), items(id, name, category, quantity, description, image_object_key)')
    .eq('public_id', publicId)
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return {
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
    space_name: data.spaces.name,
    items: data.items,
  }
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
  const { data: sessionData } = await supabase.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) throw new Error('authentication is required')

  const { data, error } = await supabase
    .from('boxes')
    .select('id, public_id, box_code, space_id, name, location, visibility, cover_object_key, updated_at, items(count), spaces(name)')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((box) => ({
    id: box.id,
    public_id: box.public_id,
    box_code: box.box_code,
    space_id: box.space_id,
    name: box.name,
    location: box.location,
    visibility: box.visibility,
    space_name: box.spaces?.name ?? '',
    cover_object_key: box.cover_object_key,
    item_count: box.items[0]?.count ?? 0,
    updated_at: box.updated_at,
  }))
}

export async function createBox(input: BoxInput): Promise<CreatedBox> {
  const { data: sessionData } = await supabase.auth.getSession()
  const ownerId = sessionData.session?.user.id
  if (!ownerId) throw new Error('authentication is required')

  const { data, error } = await supabase
    .from('boxes')
    .insert({ ...input, owner_id: ownerId })
    .select('id, public_id, box_code, name')
    .single()

  if (error) throw error
  return data
}

export async function deleteBox(boxId: string) {
  const { error } = await supabase.from('boxes').delete().eq('id', boxId)
  if (error) throw error
}

export async function updateBox(boxId: string, input: BoxInput) {
  const { error } = await supabase.from('boxes').update(input).eq('id', boxId)
  if (error) throw error
}
