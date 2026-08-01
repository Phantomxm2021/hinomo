import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

export type ItemMovement = Database['public']['Tables']['item_movements']['Row']
export type ItemMovementHistory = ItemMovement & {
  from_box: { name: string } | null
  to_box: { name: string } | null
}
export type ItemMovementResult = Database['public']['Functions']['take_out_item']['Returns'][number]

function requireMovementResult(data: ItemMovementResult[] | null) {
  const result = data?.[0]
  if (!result) throw new Error('item movement did not return an updated item')
  return result
}

export async function takeOutItem(input: {
  itemId: string
  quantity: number
  handlerLabel?: string | null
  note?: string | null
}) {
  const { data, error } = await supabase.rpc('take_out_item', {
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_handler_label: input.handlerLabel ?? null,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return requireMovementResult(data)
}

export async function returnItem(input: {
  itemId: string
  quantity: number
  note?: string | null
}) {
  const { data, error } = await supabase.rpc('return_item', {
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return requireMovementResult(data)
}

export async function moveItem(input: {
  itemId: string
  targetBoxId: string
  note?: string | null
}) {
  const { data, error } = await supabase.rpc('move_item', {
    p_item_id: input.itemId,
    p_target_box_id: input.targetBoxId,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return requireMovementResult(data)
}

export async function listItemMovements(itemId: string): Promise<ItemMovementHistory[]> {
  const { data, error } = await supabase
    .from('item_movements')
    .select('*, from_box:boxes!item_movements_from_box_id_fkey(name), to_box:boxes!item_movements_to_box_id_fkey(name)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ItemMovementHistory[]
}
