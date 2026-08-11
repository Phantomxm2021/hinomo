import { supabase } from '../../lib/supabase'
import { captureGrowthEvent, firstGrowthOccurrence } from '../../lib/analytics'

export type ItemRecord = {
  id: string
  name: string
  category: string | null
  quantity: number
  stored_quantity?: number
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

export async function createItem(input: ItemInput, onboarding = false) {
  const { data, error } = await supabase.from('items').insert(input).select().single()
  if (error) throw error
  captureGrowthEvent('first_item_created', { onboarding, method: 'manual', first: firstGrowthOccurrence('first_item_created') })
  return data
}

export async function updateItem(itemId: string, input: ItemUpdateInput) {
  const { data, error } = await supabase.from('items').update(input).eq('id', itemId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw Object.assign(new Error('item is not accessible'), { code: '42501' })
}

export async function deleteItem(itemId: string) {
  const { data, error } = await supabase.from('items').delete().eq('id', itemId).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw Object.assign(new Error('item is not accessible'), { code: '42501' })
}
