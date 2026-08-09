import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptVenueInvite,
  createVenueInvite,
  getVenueAccessSummary,
  inspectVenueInvite,
  isVenueAccessDenied,
  isVenueInviteError,
  leaveVenue,
  listVenueInvites,
  listVenueMembers,
  removeVenueMember,
  revokeVenueInvite,
} from './venue-sharing.api'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mockRpc } }))

describe('venue sharing api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: [], error: null })
  })

  it('maps the access summary returned by the RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        venue_id: 'venue-1', role: 'owner', can_manage_members: true, can_delete_venue: true,
        can_delete_space: true, can_delete_box: true, can_change_box_visibility: true,
        can_use_ai: true, member_count: 2, max_members: 5,
      }],
      error: null,
    })

    await expect(getVenueAccessSummary('venue-1')).resolves.toEqual({
      venue_id: 'venue-1', role: 'owner', can_manage_members: true, can_delete_venue: true,
      can_delete_space: true, can_delete_box: true, can_change_box_visibility: true,
      can_use_ai: true, member_count: 2, max_members: 5,
    })
    expect(mockRpc).toHaveBeenCalledWith('get_venue_access_summary', { p_venue_id: 'venue-1' })
  })

  it('does not manufacture owner access when the summary has no row', async () => {
    await expect(getVenueAccessSummary('venue-1')).rejects.toThrow('venue access summary was not returned')
  })

  it('calls each member and invite RPC with the typed parameter names', async () => {
    mockRpc.mockImplementation((name: string) => {
      const rows = {
        list_venue_members: [{ user_id: 'user-2', role: 'member', display_name: 'Member', avatar_url: null, joined_at: '2026-08-09T00:00:00Z', is_current: false }],
        create_venue_invite: [{ invite_id: 'invite-1', token: 'secret', expires_at: '2026-08-10T00:00:00Z' }],
        inspect_venue_invite: [{ venue_id: 'venue-1', venue_name: 'Home', owner_display_name: 'Owner', status: 'active', expires_at: '2026-08-10T00:00:00Z', current_user_state: 'eligible' }],
        accept_venue_invite: [{ venue_id: 'venue-1', result: 'joined' }],
        list_venue_invites: [{ invite_id: 'invite-1', created_at: '2026-08-09T00:00:00Z', expires_at: '2026-08-10T00:00:00Z', status: 'active' }],
      } as Record<string, unknown>
      return Promise.resolve({ data: rows[name] ?? [], error: null })
    })

    await expect(listVenueMembers('venue-1')).resolves.toHaveLength(1)
    await expect(createVenueInvite('venue-1')).resolves.toMatchObject({ token: 'secret' })
    await expect(inspectVenueInvite('secret')).resolves.toMatchObject({ venue_name: 'Home' })
    await expect(acceptVenueInvite('secret')).resolves.toEqual({ venue_id: 'venue-1', result: 'joined' })
    await expect(listVenueInvites('venue-1')).resolves.toHaveLength(1)
    await expect(revokeVenueInvite('invite-1')).resolves.toBeUndefined()
    await expect(removeVenueMember('venue-1', 'user-2')).resolves.toBeUndefined()
    await expect(leaveVenue('venue-1')).resolves.toBeUndefined()

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'list_venue_members', { p_venue_id: 'venue-1' })
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'create_venue_invite', { p_venue_id: 'venue-1' })
    expect(mockRpc).toHaveBeenNthCalledWith(3, 'inspect_venue_invite', { p_token: 'secret' })
    expect(mockRpc).toHaveBeenNthCalledWith(4, 'accept_venue_invite', { p_token: 'secret' })
    expect(mockRpc).toHaveBeenNthCalledWith(5, 'list_venue_invites', { p_venue_id: 'venue-1' })
    expect(mockRpc).toHaveBeenNthCalledWith(6, 'revoke_venue_invite', { p_invite_id: 'invite-1' })
    expect(mockRpc).toHaveBeenNthCalledWith(7, 'remove_venue_member', { p_venue_id: 'venue-1', p_user_id: 'user-2' })
    expect(mockRpc).toHaveBeenNthCalledWith(8, 'leave_venue', { p_venue_id: 'venue-1' })
  })

  it.each([
    'venue_invite_expired', 'venue_invite_used', 'venue_invite_revoked', 'venue_member_limit_reached',
    'venue_access_denied', 'venue_owner_required', 'venue_invite_missing', 'venue_owner_cannot_join',
    'venue_owner_cannot_remove', 'venue_member_not_found', 'venue_owner_cannot_leave',
  ] as const)('preserves %s as a stable invite error code', async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } })

    await expect(createVenueInvite('venue-1')).rejects.toMatchObject({ code })
    await createVenueInvite('venue-1').catch((error: unknown) => expect(isVenueInviteError(error, code)).toBe(true))
  })

  it('recognizes revocation errors from both mapped and direct RPC responses', () => {
    expect(isVenueAccessDenied({ code: 'venue_access_denied' })).toBe(true)
    expect(isVenueAccessDenied({ details: 'venue_access_denied' })).toBe(true)
    expect(isVenueAccessDenied(new Error('network unavailable'))).toBe(false)
  })
})
