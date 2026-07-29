import type { Database } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'

export type SearchResult = Database['public']['Functions']['search_my_items']['Returns'][number]

export async function searchItems(query: string): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('search_my_items', { p_query: query })
  if (error) throw error
  return data ?? []
}
