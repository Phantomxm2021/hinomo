import { supabase } from '../../lib/supabase'
import type { VenueRole } from './venue-sharing.api'

export type VenueSummary = {
  id: string
  owner_id: string
  name: string
  description: string | null
  is_default: boolean
  role: VenueRole
  owner_display_name: string | null
  space_count: number
  member_count: number
  max_members: number
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
  const { data, error } = await supabase.rpc('list_accessible_venues')

  if (error) throw mapVenueError(error)
  return (data ?? []).map((venue) => ({
    id: venue.id,
    owner_id: venue.owner_id,
    name: venue.name,
    description: venue.description,
    is_default: venue.is_default,
    role: venue.role === 'owner' ? 'owner' : 'member',
    owner_display_name: venue.owner_display_name,
    space_count: venue.space_count,
    member_count: venue.member_count,
    max_members: venue.max_members,
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
