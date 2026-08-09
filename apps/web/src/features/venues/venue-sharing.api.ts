import { supabase } from '../../lib/supabase'

export type VenueRole = 'owner' | 'member'

export type VenueAccessSummary = {
  venue_id: string
  role: VenueRole
  can_manage_members: boolean
  can_delete_venue: boolean
  can_delete_space: boolean
  can_delete_box: boolean
  can_change_box_visibility: boolean
  can_use_ai: boolean
  member_count: number
  max_members: number
}

export type VenueMember = {
  user_id: string
  role: VenueRole
  display_name: string | null
  avatar_url: string | null
  joined_at: string
  is_current: boolean
}

export type VenueInviteSummary = {
  invite_id: string
  created_at: string
  expires_at: string
  status: string
}

export type VenueInvitePreview = {
  venue_id: string | null
  venue_name: string | null
  owner_display_name: string | null
  status: string
  expires_at: string | null
  current_user_state: string
}

export type VenueInviteErrorCode =
  | 'venue_invite_expired'
  | 'venue_invite_used'
  | 'venue_invite_revoked'
  | 'venue_member_limit_reached'
  | 'venue_access_denied'
  | 'venue_owner_required'
  | 'venue_invite_missing'
  | 'venue_owner_cannot_join'
  | 'venue_owner_cannot_remove'
  | 'venue_member_not_found'
  | 'venue_owner_cannot_leave'

const venueInviteErrorCodes = new Set<VenueInviteErrorCode>([
  'venue_invite_expired',
  'venue_invite_used',
  'venue_invite_revoked',
  'venue_member_limit_reached',
  'venue_access_denied',
  'venue_owner_required',
  'venue_invite_missing',
  'venue_owner_cannot_join',
  'venue_owner_cannot_remove',
  'venue_member_not_found',
  'venue_owner_cannot_leave',
])

type VenueInviteError = Error & { code: VenueInviteErrorCode }

function mapVenueInviteError(error: { message?: string; details?: string }) {
  const code = [error.message, error.details].find((value): value is VenueInviteErrorCode =>
    typeof value === 'string' && venueInviteErrorCodes.has(value as VenueInviteErrorCode),
  )
  if (!code) return error
  return Object.assign(new Error(code), { code, cause: error }) as VenueInviteError
}

function requireRow<T>(data: T[] | null, message: string): T {
  const row = data?.[0]
  if (!row) throw new Error(message)
  return row
}

function venueRole(role: string): VenueRole {
  if (role === 'owner' || role === 'member') return role
  throw new Error('venue role was invalid')
}

export function isVenueInviteError(error: unknown, code?: VenueInviteErrorCode): error is VenueInviteError {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  const errorCode = (error as { code?: unknown }).code
  return venueInviteErrorCodes.has(errorCode as VenueInviteErrorCode)
    && (!code || errorCode === code)
}

export function isVenueAccessDenied(error: unknown): boolean {
  const seen = new Set<object>()
  let candidate: unknown = error

  while (candidate && typeof candidate === 'object' && !seen.has(candidate)) {
    seen.add(candidate)
    const record = candidate as { code?: unknown; message?: unknown; details?: unknown; cause?: unknown }
    if (record.code === '42501') return true
    if ([record.code, record.message, record.details].some((value) => (
      typeof value === 'string' && value.includes('venue_access_denied')
    ))) return true
    candidate = record.cause
  }

  return false
}

export const revokedVenueQueryKeys = [
  ['venues'], ['venue-access'], ['venue-members'], ['venue-invites'], ['spaces'], ['boxes'], ['box'], ['box-id'],
  ['items'], ['search-items'], ['item-movements'], ['venue-activity'], ['box-plan'],
  ['packing-session-active'], ['packing-sessions'], ['packing-photos'], ['packing-detected-items'],
  ['packing-evidence-photo'], ['packing-item-promotion'], ['packing-media-url'],
] as const

export async function getVenueAccessSummary(venueId: string): Promise<VenueAccessSummary> {
  const { data, error } = await supabase.rpc('get_venue_access_summary', { p_venue_id: venueId })
  if (error) throw mapVenueInviteError(error)
  const row = requireRow(data, 'venue access summary was not returned')
  return { ...row, role: venueRole(row.role) }
}

export async function listVenueMembers(venueId: string): Promise<VenueMember[]> {
  const { data, error } = await supabase.rpc('list_venue_members', { p_venue_id: venueId })
  if (error) throw mapVenueInviteError(error)
  return (data ?? []).map((member) => ({ ...member, role: venueRole(member.role) }))
}

export async function createVenueInvite(venueId: string) {
  const { data, error } = await supabase.rpc('create_venue_invite', { p_venue_id: venueId })
  if (error) throw mapVenueInviteError(error)
  return requireRow(data, 'venue invite was not created')
}

export async function inspectVenueInvite(token: string): Promise<VenueInvitePreview> {
  const { data, error } = await supabase.rpc('inspect_venue_invite', { p_token: token })
  if (error) throw mapVenueInviteError(error)
  return requireRow(data, 'venue invite preview was not returned')
}

export async function acceptVenueInvite(token: string) {
  const { data, error } = await supabase.rpc('accept_venue_invite', { p_token: token })
  if (error) throw mapVenueInviteError(error)
  return requireRow(data, 'venue invite was not accepted')
}

export async function listVenueInvites(venueId: string): Promise<VenueInviteSummary[]> {
  const { data, error } = await supabase.rpc('list_venue_invites', { p_venue_id: venueId })
  if (error) throw mapVenueInviteError(error)
  return data ?? []
}

export async function revokeVenueInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_venue_invite', { p_invite_id: inviteId })
  if (error) throw mapVenueInviteError(error)
}

export async function removeVenueMember(venueId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_venue_member', { p_venue_id: venueId, p_user_id: userId })
  if (error) throw mapVenueInviteError(error)
}

export async function leaveVenue(venueId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_venue', { p_venue_id: venueId })
  if (error) throw mapVenueInviteError(error)
}
