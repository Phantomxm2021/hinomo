import { supabase } from '../../lib/supabase'

export type VenueSummary = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  space_count: number
}

export type VenueInput = {
  name: string
  description: string | null
}

export const VENUES_SCHEMA_UNAVAILABLE = 'VENUES_SCHEMA_UNAVAILABLE'

function mapVenueError(error: { code?: string; message?: string }) {
  if (error.code === 'PGRST200' || error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703') {
    return Object.assign(new Error('venues schema is not installed'), {
      code: VENUES_SCHEMA_UNAVAILABLE,
    })
  }
  return error
}

export function isVenuesSchemaUnavailable(error: unknown) {
  return Boolean(
    error && typeof error === 'object' && 'code' in error
    && error.code === VENUES_SCHEMA_UNAVAILABLE,
  )
}

async function requireOwnerId() {
  const { data } = await supabase.auth.getSession()
  const ownerId = data.session?.user.id
  if (!ownerId) throw new Error('authentication is required')
  return ownerId
}

export async function listVenues(): Promise<VenueSummary[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('id, name, description, is_default, spaces(count)')
    .order('is_default', { ascending: false })
    .order('name')

  if (error) throw mapVenueError(error)
  return (data ?? []).map((venue) => ({
    id: venue.id,
    name: venue.name,
    description: venue.description,
    is_default: venue.is_default,
    space_count: venue.spaces[0]?.count ?? 0,
  }))
}

export async function createVenue(input: VenueInput) {
  const ownerId = await requireOwnerId()
  const { data, error } = await supabase
    .from('venues')
    .insert({ ...input, owner_id: ownerId })
    .select('id')
    .single()
  if (error) throw mapVenueError(error)
  return data
}

export async function updateVenue(venueId: string, input: VenueInput) {
  const { data, error } = await supabase
    .from('venues')
    .update(input)
    .eq('id', venueId)
    .select('id')
  if (error) throw mapVenueError(error)
  if (!data?.length) throw new Error('venue update was not applied')
}

export async function deleteVenue(venueId: string) {
  const { error } = await supabase.from('venues').delete().eq('id', venueId)
  if (error) throw mapVenueError(error)
}
