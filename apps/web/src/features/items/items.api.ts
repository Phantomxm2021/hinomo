import { supabase } from '../../lib/supabase'

export type ItemRecord = {
  id: string
  name: string
  category: string | null
  quantity: number
  description: string | null
  image_object_key?: string | null
}

export type ItemInput = {
  box_id: string
  name: string
  category: string | null
  quantity: number
  description: string | null
  image_object_key?: string | null
}

export type ItemUpdateInput = Omit<ItemInput, 'box_id'>

export async function createItem(input: ItemInput) {
  const { data, error } = await supabase.from('items').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateItem(itemId: string, input: ItemUpdateInput) {
  const { error } = await supabase.from('items').update(input).eq('id', itemId)
  if (error) throw error
}

export async function deleteItem(itemId: string) {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw error
}
