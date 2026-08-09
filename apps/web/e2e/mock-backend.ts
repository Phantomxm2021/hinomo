import { expect, type Page, type Route } from '@playwright/test'

type Venue = { id: string; owner_id: string; name: string; description: string | null; is_default: boolean }
type Space = { id: string; owner_id: string; venue_id: string; name: string; description: string | null }
type SpaceLayout = { space_id: string; owner_id: string; x_percent: number; y_percent: number; width_percent: number; height_percent: number }
type Item = { id: string; box_id: string; name: string; category: string | null; quantity: number; stored_quantity: number; description: string | null }
type Profile = { id: string; display_name: string | null; avatar_object_key: string | null; locale: 'zh-CN' | 'en-US'; onboarding_welcome_seen_at: string | null }
type Box = {
  id: string
  owner_id: string
  public_id: string
  box_code: string
  space_id: string
  name: string
  category: string | null
  location: string | null
  description: string | null
  visibility: 'public' | 'private'
  updated_at: string
}

type BoxPlan = {
  box_count: number
  free_limit: number
  unlimited_boxes: boolean
  can_create: boolean
}

type BoxCheckout = {
  result: 'success' | 'canceled'
  pending: boolean
  releasePlanRequests: Array<() => void>
}

type CreditSummary = {
  credits_available: number
  credits_reserved: number
}

type VenueMember = { venue_id: string; user_id: string; invited_by: string | null; joined_at: string }
type VenueInvite = {
  id: string; venue_id: string; created_by: string; token: string; created_at: string; expires_at: string
  accepted_by: string | null; accepted_at: string | null; revoked_at: string | null
}
type VenueActivity = {
  id: string; venue_id: string; actor_id: string | null; event_code: 'item_created' | 'item_moved' | 'item_quantity_changed' | 'item_deleted' | 'box_moved'
  entity_type: string; entity_id: string; snapshot: Record<string, unknown>; created_at: string
}
type PackingSession = { id: string; box_id: string; owner_id: string; created_by: string; status: 'capturing' }

export type MockState = {
  venues: Venue[]
  spaces: Space[]
  spaceLayouts: SpaceLayout[]
  boxes: Box[]
  items: Item[]
  profiles: Profile[]
  members: VenueMember[]
  invites: VenueInvite[]
  activity: VenueActivity[]
  packingSessions: PackingSession[]
  boxPlan: BoxPlan
  boxCheckout: BoxCheckout
  creditSummary: CreditSummary
}

export const createMockState = ({ boxCount = 0, unlimitedBoxes = false }: {
  boxCount?: number
  unlimitedBoxes?: boolean
} = {}): MockState => ({
  venues: [],
  spaces: [],
  spaceLayouts: [],
  boxes: [],
  items: [],
  profiles: [],
  members: [],
  invites: [],
  activity: [],
  packingSessions: [],
  boxPlan: {
    box_count: boxCount,
    free_limit: 3,
    unlimited_boxes: unlimitedBoxes,
    can_create: unlimitedBoxes || boxCount < 3,
  },
  boxCheckout: { result: 'success', pending: false, releasePlanRequests: [] },
  creditSummary: { credits_available: 0, credits_reserved: 0 },
})

export function completeBoxUnlimitedPurchase(state: MockState) {
  if (!state.boxCheckout.pending) throw new Error('no unlimited-box checkout is awaiting confirmation')
  state.boxCheckout.pending = false
  state.boxPlan.unlimited_boxes = true
  state.boxPlan.can_create = true
  for (const release of state.boxCheckout.releasePlanRequests.splice(0)) release()
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

function authUser(id: string, email: string) {
  const now = new Date().toISOString()
  return {
    id, aud: 'authenticated', role: 'authenticated', email,
    email_confirmed_at: now, confirmed_at: now, last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [], created_at: now, updated_at: now,
  }
}

function eqValue(url: URL, field: string) {
  const value = url.searchParams.get(field)
  return value?.startsWith('eq.') ? value.slice(3) : null
}

export async function installMockBackend(page: Page, state: MockState) {
  let currentUserId: string | null = null
  const now = () => new Date().toISOString()
  const error = (route: Route, code: string, status = 400) => json(route, { code: 'P0001', message: code, details: null, hint: null }, status)
  const venueForSpace = (spaceId: string) => state.spaces.find((space) => space.id === spaceId)?.venue_id
  const venueForBox = (boxId: string) => venueForSpace(state.boxes.find((box) => box.id === boxId)?.space_id ?? '')
  const canAccessVenue = (venueId: string | undefined, userId = currentUserId) => Boolean(
    venueId && userId && (state.venues.some((venue) => venue.id === venueId && venue.owner_id === userId)
      || state.members.some((member) => member.venue_id === venueId && member.user_id === userId)),
  )
  const isVenueOwner = (venueId: string | undefined, userId = currentUserId) => Boolean(
    venueId && userId && state.venues.some((venue) => venue.id === venueId && venue.owner_id === userId),
  )
  const venuePlan = (venueId: string) => {
    const ownerId = state.venues.find((venue) => venue.id === venueId)?.owner_id
    const boxCount = state.boxes.filter((box) => box.owner_id === ownerId).length
    return {
      box_count: boxCount,
      free_limit: state.boxPlan.free_limit,
      unlimited_boxes: state.boxPlan.unlimited_boxes,
      can_create: state.boxPlan.unlimited_boxes || boxCount < state.boxPlan.free_limit,
    }
  }
  const writeActivity = (venueId: string | undefined, eventCode: VenueActivity['event_code'], entityType: string, entityId: string, snapshot: Record<string, unknown>) => {
    if (!venueId) return
    const actor = state.profiles.find((profile) => profile.id === currentUserId)
    state.activity.unshift({
      id: `activity-${state.activity.length + 1}`,
      venue_id: venueId,
      actor_id: currentUserId,
      event_code: eventCode,
      entity_type: entityType,
      entity_id: entityId,
      snapshot: { ...snapshot, actor_display_name: actor?.display_name ?? null },
      created_at: now(),
    })
  }
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/auth/v1/signup' || url.pathname === '/auth/v1/token') {
      const credentials = request.postDataJSON() as { email?: string }
      const email = credentials.email ?? `user-${Date.now()}@example.com`
      currentUserId = email.includes('other')
        ? '22222222-2222-4222-8222-222222222222'
        : '11111111-1111-4111-8111-111111111111'
      if (!state.profiles.some((profile) => profile.id === currentUserId)) {
        state.profiles.push({ id: currentUserId, display_name: email.split('@')[0], avatar_object_key: null, locale: 'zh-CN', onboarding_welcome_seen_at: null })
      }
      if (!state.venues.some((venue) => venue.owner_id === currentUserId && venue.is_default)) {
        state.venues.push({
          id: `venue-default-${currentUserId}`,
          owner_id: currentUserId,
          name: '默认',
          description: null,
          is_default: true,
        })
      }
      const user = authUser(currentUserId, email)
      return json(route, {
        access_token: `token-${currentUserId}`,
        refresh_token: `refresh-${currentUserId}`,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      })
    }
    if (url.pathname === '/auth/v1/user') {
      return currentUserId
        ? json(route, authUser(currentUserId, 'owner@example.com'))
        : json(route, { message: 'not authenticated' }, 401)
    }
    if (url.pathname === '/auth/v1/logout' && method === 'POST') {
      currentUserId = null
      return route.fulfill({ status: 204, body: '' })
    }

    if (url.pathname === '/rest/v1/profiles' && method === 'GET') {
      const profileId = eqValue(url, 'id')
      const profile = state.profiles.find((candidate) => candidate.id === profileId && candidate.id === currentUserId)
      return profile ? json(route, profile) : json(route, null)
    }

    if (url.pathname === '/rest/v1/rpc/update_profile_locale' && method === 'POST' && currentUserId) {
      const { p_locale: locale } = request.postDataJSON() as { p_locale: 'zh-CN' | 'en-US' }
      const profile = state.profiles.find((candidate) => candidate.id === currentUserId)
      if (profile) profile.locale = locale
      return json(route, null)
    }

    if (url.pathname === '/rest/v1/rpc/mark_onboarding_welcome_seen' && method === 'POST' && currentUserId) {
      const profile = state.profiles.find((candidate) => candidate.id === currentUserId)
      if (profile && !profile.onboarding_welcome_seen_at) profile.onboarding_welcome_seen_at = new Date().toISOString()
      return json(route, null)
    }

    if (url.pathname === '/rest/v1/rpc/list_accessible_venues' && method === 'POST' && currentUserId) {
      return json(route, state.venues.filter((venue) => canAccessVenue(venue.id)).map((venue) => ({
        id: venue.id, owner_id: venue.owner_id, name: venue.name, description: venue.description, is_default: venue.is_default,
        role: venue.owner_id === currentUserId ? 'owner' : 'member',
        owner_display_name: state.profiles.find((profile) => profile.id === venue.owner_id)?.display_name ?? null,
        space_count: state.spaces.filter((space) => space.venue_id === venue.id).length,
        member_count: 1 + state.members.filter((member) => member.venue_id === venue.id).length,
        max_members: 5,
      })))
    }

    if (url.pathname === '/rest/v1/rpc/get_venue_access_summary' && method === 'POST' && currentUserId) {
      const { p_venue_id: venueId } = request.postDataJSON() as { p_venue_id: string }
      if (!canAccessVenue(venueId)) return error(route, 'venue_access_denied')
      const owner = isVenueOwner(venueId)
      return json(route, [{
        venue_id: venueId, role: owner ? 'owner' : 'member', can_manage_members: owner, can_delete_venue: owner,
        can_delete_space: owner, can_delete_box: owner, can_change_box_visibility: owner, can_use_ai: true,
        member_count: 1 + state.members.filter((member) => member.venue_id === venueId).length, max_members: 5,
      }])
    }

    if (url.pathname === '/rest/v1/rpc/list_venue_members' && method === 'POST' && currentUserId) {
      const { p_venue_id: venueId } = request.postDataJSON() as { p_venue_id: string }
      if (!canAccessVenue(venueId)) return error(route, 'venue_access_denied')
      const venue = state.venues.find((candidate) => candidate.id === venueId)!
      const rows = [{ user_id: venue.owner_id, role: 'owner', joined_at: now() }, ...state.members.filter((member) => member.venue_id === venueId).map((member) => ({ ...member, role: 'member' }))]
      return json(route, rows.map((member) => {
        const profile = state.profiles.find((candidate) => candidate.id === member.user_id)
        return { ...member, display_name: profile?.display_name ?? null, avatar_url: null, is_current: member.user_id === currentUserId }
      }))
    }

    if (url.pathname === '/rest/v1/rpc/create_venue_invite' && method === 'POST' && currentUserId) {
      const { p_venue_id: venueId } = request.postDataJSON() as { p_venue_id: string }
      if (!isVenueOwner(venueId)) return error(route, 'venue_access_denied')
      const active = state.invites.filter((invite) => invite.venue_id === venueId && !invite.accepted_at && !invite.revoked_at && invite.expires_at > now())
      if (1 + state.members.filter((member) => member.venue_id === venueId).length + active.length >= 5) return error(route, 'venue_member_limit_reached')
      const invite: VenueInvite = { id: `invite-${state.invites.length + 1}`, venue_id: venueId, created_by: currentUserId, token: `venue-invite-${state.invites.length + 1}`, created_at: now(), expires_at: new Date(Date.now() + 86_400_000).toISOString(), accepted_by: null, accepted_at: null, revoked_at: null }
      state.invites.push(invite)
      return json(route, [{ invite_id: invite.id, token: invite.token, expires_at: invite.expires_at }])
    }

    if (url.pathname === '/rest/v1/rpc/inspect_venue_invite' && method === 'POST') {
      const { p_token: token } = request.postDataJSON() as { p_token: string }
      const invite = state.invites.find((candidate) => candidate.token === token)
      if (!invite) return json(route, [{ venue_id: null, venue_name: null, owner_display_name: null, status: 'missing', expires_at: null, current_user_state: currentUserId ? 'eligible' : 'anonymous' }])
      const venue = state.venues.find((candidate) => candidate.id === invite.venue_id)!
      const currentUserState = !currentUserId ? 'anonymous' : isVenueOwner(venue.id) ? 'owner' : canAccessVenue(venue.id) ? 'member' : 'eligible'
      const status = invite.accepted_at ? 'used' : invite.revoked_at ? 'revoked' : invite.expires_at <= now() ? 'expired' : 1 + state.members.filter((member) => member.venue_id === venue.id).length >= 5 ? 'full' : 'active'
      return json(route, [{ venue_id: venue.id, venue_name: venue.name, owner_display_name: state.profiles.find((profile) => profile.id === venue.owner_id)?.display_name ?? null, status, expires_at: invite.expires_at, current_user_state: currentUserState }])
    }

    if (url.pathname === '/rest/v1/rpc/accept_venue_invite' && method === 'POST' && currentUserId) {
      const { p_token: token } = request.postDataJSON() as { p_token: string }
      const invite = state.invites.find((candidate) => candidate.token === token)
      if (!invite) return error(route, 'venue_invite_missing')
      if (canAccessVenue(invite.venue_id)) return json(route, [{ venue_id: invite.venue_id, result: 'already_member' }])
      if (invite.accepted_at) return error(route, 'venue_invite_used')
      if (invite.revoked_at) return error(route, 'venue_invite_revoked')
      if (invite.expires_at <= now()) return error(route, 'venue_invite_expired')
      if (1 + state.members.filter((member) => member.venue_id === invite.venue_id).length >= 5) return error(route, 'venue_member_limit_reached')
      state.members.push({ venue_id: invite.venue_id, user_id: currentUserId, invited_by: invite.created_by, joined_at: now() })
      invite.accepted_by = currentUserId; invite.accepted_at = now()
      return json(route, [{ venue_id: invite.venue_id, result: 'joined' }])
    }

    if (url.pathname === '/rest/v1/rpc/list_venue_invites' && method === 'POST' && currentUserId) {
      const { p_venue_id: venueId } = request.postDataJSON() as { p_venue_id: string }
      if (!isVenueOwner(venueId)) return error(route, 'venue_access_denied')
      return json(route, state.invites.filter((invite) => invite.venue_id === venueId).map((invite) => ({ invite_id: invite.id, created_at: invite.created_at, expires_at: invite.expires_at, status: invite.accepted_at ? 'used' : invite.revoked_at ? 'revoked' : 'active' })))
    }

    if (url.pathname === '/rest/v1/rpc/remove_venue_member' && method === 'POST' && currentUserId) {
      const { p_venue_id: venueId, p_user_id: userId } = request.postDataJSON() as { p_venue_id: string; p_user_id: string }
      if (!isVenueOwner(venueId)) return error(route, 'venue_access_denied')
      state.members = state.members.filter((member) => member.venue_id !== venueId || member.user_id !== userId)
      return json(route, null)
    }

    if (url.pathname === '/rest/v1/rpc/get_venue_box_plan_summary' && method === 'POST' && currentUserId) {
      const { p_venue_id: venueId } = request.postDataJSON() as { p_venue_id: string }
      if (!canAccessVenue(venueId)) return error(route, 'venue_access_denied')
      return json(route, [venuePlan(venueId)])
    }

    if (url.pathname === '/rest/v1/rpc/create_space' && method === 'POST' && currentUserId) {
      const input = request.postDataJSON() as { p_venue_id: string; p_name: string; p_description: string | null }
      if (!canAccessVenue(input.p_venue_id)) return error(route, 'venue_access_denied')
      const ownerId = state.venues.find((venue) => venue.id === input.p_venue_id)?.owner_id
      const space = { id: `space-${state.spaces.length + 1}`, owner_id: ownerId!, venue_id: input.p_venue_id, name: input.p_name, description: input.p_description }
      state.spaces.push(space)
      return json(route, [{ id: space.id }])
    }

    if (url.pathname === '/rest/v1/rpc/get_credit_summary' && method === 'POST' && currentUserId) {
      return json(route, [state.creditSummary])
    }

    if (url.pathname === '/rest/v1/rpc/list_credit_transactions' && method === 'POST' && currentUserId) {
      return json(route, [])
    }

    if (url.pathname === '/rest/v1/rpc/get_box_plan_summary' && method === 'POST' && currentUserId) {
      if (state.boxCheckout.pending) {
        await new Promise<void>((resolve) => state.boxCheckout.releasePlanRequests.push(resolve))
      }
      return json(route, [state.boxPlan])
    }

    if (url.pathname === '/rest/v1/rpc/create_box' && method === 'POST' && currentUserId) {
      const input = request.postDataJSON() as {
        p_space_id: string
        p_name: string
        p_category: string | null
        p_location: string | null
        p_description: string | null
        p_visibility: Box['visibility']
      }
      const venueId = venueForSpace(input.p_space_id)
      if (!canAccessVenue(venueId)) return error(route, 'venue_access_denied')
      const plan = venuePlan(venueId!)
      if (!plan.can_create) {
        return json(route, {
          code: 'P0001',
          message: 'box_limit_reached',
          details: null,
          hint: null,
        }, 400)
      }

      const sequence = state.boxes.length + 1
      const ownerId = state.venues.find((venue) => venue.id === venueId)?.owner_id ?? currentUserId
      const box: Box = {
        id: `box-${sequence}`,
        owner_id: ownerId,
        public_id: `123e4567-e89b-42d3-a456-${String(sequence).padStart(12, '0')}`,
        box_code: `BX-${String(sequence).padStart(5, '0')}`,
        space_id: input.p_space_id,
        name: input.p_name,
        category: input.p_category,
        location: input.p_location,
        description: input.p_description,
        visibility: input.p_visibility,
        updated_at: new Date().toISOString(),
      }
      state.boxes.push(box)
      state.boxPlan.box_count = plan.box_count + 1
      state.boxPlan.can_create = state.boxPlan.unlimited_boxes || state.boxPlan.box_count < state.boxPlan.free_limit
      return json(route, [{ id: box.id, public_id: box.public_id, box_code: box.box_code, name: box.name }])
    }

    if (url.pathname === '/rest/v1/rpc/list_accessible_boxes' && method === 'POST' && currentUserId) {
      const { p_venue_id: requestedVenueId } = request.postDataJSON() as { p_venue_id: string | null }
      if (requestedVenueId && !canAccessVenue(requestedVenueId)) return error(route, 'venue_access_denied')
      return json(route, state.boxes.flatMap((box) => {
        const space = state.spaces.find((candidate) => candidate.id === box.space_id)
        const venue = state.venues.find((candidate) => candidate.id === space?.venue_id)
        if (!space || !venue || !canAccessVenue(venue.id) || (requestedVenueId && venue.id !== requestedVenueId)) return []
        return [{ id: box.id, public_id: box.public_id, box_code: box.box_code, space_id: box.space_id, venue_id: venue.id, name: box.name, location: box.location, visibility: box.visibility, cover_object_key: null, updated_at: box.updated_at, item_count: state.items.filter((item) => item.box_id === box.id).length, space_name: space.name, venue_name: venue.name }]
      }))
    }

    if (url.pathname === '/functions/v1/billing-checkout' && method === 'POST' && currentUserId) {
      const { action } = request.postDataJSON() as { action?: string }
      if (action !== 'boxes_unlimited') return json(route, { error: 'invalid_checkout_action' }, 400)
      state.boxCheckout.pending = state.boxCheckout.result === 'success'
      return json(route, {
        url: `http://127.0.0.1:4173/app/boxes?purchase=${state.boxCheckout.result}`,
      })
    }

    if ((url.pathname === '/rest/v1/venue_members' || url.pathname === '/rest/v1/venue_invites') && method !== 'GET') {
      return json(route, { code: '42501', message: 'new row violates row-level security policy', details: null, hint: null }, 403)
    }

    if (url.pathname === '/rest/v1/venues') {
      if (method === 'GET') {
        return json(route, state.venues.filter((venue) => venue.owner_id === currentUserId).map((venue) => ({
          id: venue.id,
          name: venue.name,
          description: venue.description,
          is_default: venue.is_default,
          spaces: [{ count: state.spaces.filter((space) => space.venue_id === venue.id).length }],
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as { name: string; description: string | null }
        const venue = { ...input, id: `venue-${state.venues.length + 1}`, owner_id: currentUserId, is_default: false }
        state.venues.push(venue)
        return json(route, { id: venue.id }, 201)
      }
      if (method === 'PATCH' && currentUserId) {
        const venueId = eqValue(url, 'id')
        const venue = state.venues.find((candidate) => candidate.id === venueId && candidate.owner_id === currentUserId)
        if (venue) Object.assign(venue, request.postDataJSON())
        return json(route, null, 204)
      }
      if (method === 'DELETE' && currentUserId) {
        const venueId = eqValue(url, 'id')
        if (state.spaces.some((space) => space.venue_id === venueId)) return json(route, { code: '23503', message: 'venue is not empty' }, 409)
        state.venues = state.venues.filter((venue) => venue.id !== venueId || venue.owner_id !== currentUserId)
        return json(route, null, 204)
      }
    }

    if (url.pathname === '/rest/v1/spaces') {
      if (method === 'GET') {
        return json(route, state.spaces.filter((space) => canAccessVenue(space.venue_id)).map((space) => ({
          id: space.id,
          venue_id: space.venue_id,
          name: space.name,
          description: space.description,
          venues: { name: state.venues.find((venue) => venue.id === space.venue_id)?.name ?? '' },
          boxes: state.boxes.filter((box) => box.space_id === space.id).map((box) => ({
            id: box.id,
            items: [{ count: state.items.filter((item) => item.box_id === box.id).length }],
          })),
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as { venue_id: string; name: string; description: string | null }
        const space = { ...input, id: `space-${state.spaces.length + 1}`, owner_id: currentUserId }
        state.spaces.push(space)
        return json(route, { id: space.id }, 201)
      }
      if (method === 'DELETE' && currentUserId) {
        return json(route, { code: '42501', message: 'new row violates row-level security policy', details: null, hint: null }, 403)
      }
    }

    if (url.pathname === '/rest/v1/space_layouts') {
      if (method === 'GET') {
        return json(route, state.spaceLayouts.filter((layout) => layout.owner_id === currentUserId).map((layout) => ({
          space_id: layout.space_id,
          x_percent: layout.x_percent,
          y_percent: layout.y_percent,
          width_percent: layout.width_percent,
          height_percent: layout.height_percent,
        })))
      }
      if (method === 'POST' && currentUserId) {
        const input = request.postDataJSON() as Omit<SpaceLayout, 'owner_id'> & { owner_id?: string }
        const layout = { ...input, owner_id: currentUserId }
        const existingIndex = state.spaceLayouts.findIndex((candidate) => candidate.space_id === input.space_id)
        if (existingIndex >= 0) state.spaceLayouts[existingIndex] = layout
        else state.spaceLayouts.push(layout)
        return json(route, null, 201)
      }
    }

    if (url.pathname === '/rest/v1/boxes') {
      if (method === 'DELETE' && currentUserId) {
        const boxId = eqValue(url, 'id')
        const venueId = venueForBox(boxId ?? '')
        if (!isVenueOwner(venueId)) return json(route, { code: '42501', message: 'new row violates row-level security policy', details: null, hint: null }, 403)
        const previousLength = state.boxes.length
        state.boxes = state.boxes.filter((box) => box.id !== boxId || box.owner_id !== currentUserId)
        if (state.boxes.length < previousLength) {
          state.boxPlan.box_count = Math.max(0, state.boxPlan.box_count - 1)
          state.boxPlan.can_create = state.boxPlan.unlimited_boxes || state.boxPlan.box_count < state.boxPlan.free_limit
        }
        return route.fulfill({ status: 204, body: '' })
      }
      if (method === 'POST' && currentUserId) {
        return json(route, {
          code: '42501',
          message: 'new row violates row-level security policy',
          details: null,
          hint: null,
        }, 403)
      }
      if (method === 'GET') {
        const publicId = eqValue(url, 'public_id')
        const boxId = eqValue(url, 'id')
        if (publicId || boxId) {
          const box = state.boxes.find((candidate) =>
            (publicId ? candidate.public_id === publicId : candidate.id === boxId)
            && (candidate.visibility === 'public' || canAccessVenue(venueForBox(candidate.id))),
          )
          if (!box) return json(route, { code: 'PGRST116', message: 'not found', details: null, hint: null }, 406)
          const space = state.spaces.find((candidate) => candidate.id === box.space_id)!
          return json(route, {
            ...box,
            cover_object_key: null,
            spaces: {
              name: space.name,
              venues: { name: state.venues.find((venue) => venue.id === space.venue_id)?.name ?? '' },
            },
            items: state.items.filter((item) => item.box_id === box.id).map((item) => ({ ...item, image_object_key: null })),
          })
        }
        const ownerId = eqValue(url, 'owner_id')
        return json(route, state.boxes
          .filter((box) => box.visibility === 'public' || canAccessVenue(venueForBox(box.id)))
          .filter((box) => !ownerId || box.owner_id === ownerId)
          .map((box) => {
            const space = state.spaces.find((candidate) => candidate.id === box.space_id && canAccessVenue(candidate.venue_id))
            return {
              ...box,
              cover_object_key: null,
              items: [{ count: state.items.filter((item) => item.box_id === box.id).length }],
              spaces: space ? {
                name: space.name,
                venues: { name: state.venues.find((venue) => venue.id === space.venue_id)?.name ?? '' },
              } : null,
            }
          }))
      }
    }

    if (url.pathname === '/rest/v1/rpc/get_public_box' && method === 'POST') {
      const { p_public_id: publicId } = request.postDataJSON() as { p_public_id?: string }
      const box = state.boxes.find((candidate) => (
        candidate.public_id === publicId && candidate.visibility === 'public'
      ))
      if (!box) return json(route, [])
      const space = state.spaces.find((candidate) => candidate.id === box.space_id)
      const venue = state.venues.find((candidate) => candidate.id === space?.venue_id)
      return json(route, [{
        ...box,
        cover_object_key: null,
        venue_name: venue?.name ?? '',
        space_name: space?.name ?? '',
        items: state.items
          .filter((item) => item.box_id === box.id)
          .map((item) => ({ ...item, image_object_key: null })),
      }])
    }

    if (url.pathname === '/rest/v1/rpc/search_my_inventory' && method === 'POST' && currentUserId) {
      const { p_query: query = '' } = request.postDataJSON() as { p_query?: string }
      const needle = query.toLocaleLowerCase()
      return json(route, state.items.flatMap((item) => {
        const box = state.boxes.find((candidate) => candidate.id === item.box_id)
        const space = state.spaces.find((candidate) => candidate.id === box?.space_id)
        if (!box || !canAccessVenue(venueForBox(box.id)) || !item.name.toLocaleLowerCase().includes(needle)) return []
        return [{
          result_id: item.id,
          source: 'formal',
          item_name: item.name,
          category: item.category,
          quantity: item.quantity,
          quantity_kind: 'exact',
          stored_quantity: item.stored_quantity,
          box_id: box.id,
          box_name: box.name,
          box_public_id: box.public_id,
          box_code: box.box_code,
          location: box.location,
          venue_name: state.venues.find((venue) => venue.id === space?.venue_id)?.name ?? '',
          space_name: space?.name ?? '',
        }]
      }))
    }

    if (url.pathname === '/rest/v1/items' && method === 'POST' && currentUserId) {
      const input = request.postDataJSON() as Omit<Item, 'id'>
      if (!canAccessVenue(venueForBox(input.box_id))) return error(route, 'venue_access_denied')
      const item = { ...input, stored_quantity: input.stored_quantity ?? input.quantity, id: `item-${state.items.length + 1}` }
      state.items.push(item)
      writeActivity(venueForBox(item.box_id), 'item_created', 'item', item.id, { entity_name: item.name })
      return json(route, item, 201)
    }

    if (url.pathname === '/rest/v1/rpc/move_item' && method === 'POST' && currentUserId) {
      const { p_item_id: itemId, p_target_box_id: targetBoxId } = request.postDataJSON() as { p_item_id: string; p_target_box_id: string }
      const item = state.items.find((candidate) => candidate.id === itemId)
      const sourceBox = state.boxes.find((candidate) => candidate.id === item?.box_id)
      const targetBox = state.boxes.find((candidate) => candidate.id === targetBoxId)
      const sourceVenue = sourceBox && venueForBox(sourceBox.id)
      if (!item || !sourceBox || !targetBox || !canAccessVenue(sourceVenue) || !canAccessVenue(venueForBox(targetBox.id))) return error(route, 'venue_access_denied')
      if (!isVenueOwner(sourceVenue) && venueForBox(targetBox.id) !== sourceVenue) return error(route, 'venue_access_denied')
      item.box_id = targetBox.id
      writeActivity(sourceVenue, 'item_moved', 'item', item.id, { entity_name: item.name, from: { name: sourceBox.name }, to: { name: targetBox.name } })
      return json(route, [{ item_id: item.id, box_id: item.box_id, quantity: item.quantity, stored_quantity: item.stored_quantity }])
    }

    if (url.pathname === '/rest/v1/rpc/list_venue_activity' && method === 'POST' && currentUserId) {
      const input = request.postDataJSON() as { p_venue_id: string; p_actor_id?: string | null; p_event_code?: VenueActivity['event_code'] | null }
      if (!canAccessVenue(input.p_venue_id)) return error(route, 'venue_access_denied')
      return json(route, state.activity.filter((entry) => entry.venue_id === input.p_venue_id && (!input.p_actor_id || entry.actor_id === input.p_actor_id) && (!input.p_event_code || entry.event_code === input.p_event_code)).map((entry) => ({
        ...entry,
        actor_display_name: state.profiles.find((profile) => profile.id === entry.actor_id)?.display_name ?? null,
        actor_is_current: entry.actor_id === state.venues.find((venue) => venue.id === entry.venue_id)?.owner_id || state.members.some((member) => member.venue_id === entry.venue_id && member.user_id === entry.actor_id),
      })))
    }

    if (url.pathname === '/rest/v1/rpc/create_packing_session' && method === 'POST' && currentUserId) {
      const { p_box_id: boxId } = request.postDataJSON() as { p_box_id: string }
      const venueId = venueForBox(boxId)
      const box = state.boxes.find((candidate) => candidate.id === boxId)
      if (!box || !canAccessVenue(venueId)) return error(route, 'venue_access_denied')
      const session: PackingSession = { id: `packing-${state.packingSessions.length + 1}`, box_id: boxId, owner_id: box.owner_id, created_by: currentUserId, status: 'capturing' }
      state.packingSessions.push(session)
      return json(route, session)
    }

    return json(route, { message: `Unhandled mock request: ${method} ${url.pathname}` }, 500)
  })
}

export async function register(page: Page, email: string, dismissWelcome = true) {
  await page.goto('/register')
  await page.getByLabel('昵称').fill(email.split('@')[0])
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill('correct-horse-battery-staple')
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check()
  await page.getByRole('button', { name: '注册' }).click()
  await page.waitForURL('**/app')
  if (dismissWelcome) {
    const dialog = page.getByRole('dialog', { name: '开始使用 Nomo' })
    await dialog.waitFor({ state: 'visible', timeout: 3000 }).catch(() => undefined)
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: '关闭开始使用 Nomo' }).click()
    }
  }
}

export async function createSpace(page: Page, name: string) {
  await page.goto('/app/spaces')
  const createVenueButton = page.getByRole('button', { name: '先创建场地' })
  const createSpaceButton = page.getByRole('button', { name: '创建空间', exact: true })
  await expect.poll(async () => (
    await createVenueButton.isVisible().catch(() => false)
    || await createSpaceButton.isEnabled().catch(() => false)
  )).toBe(true)
  if (await createVenueButton.isVisible()) {
    await createVenueButton.click()
    const venueDialog = page.getByRole('dialog', { name: '创建场地' })
    await venueDialog.getByLabel('场地名称').fill('家里')
    await venueDialog.getByRole('button', { name: '创建场地' }).click()
    await venueDialog.waitFor({ state: 'hidden' })
  }
  await createSpaceButton.click()
  const dialog = page.getByRole('dialog', { name: '创建空间' })
  await dialog.getByLabel('空间名称').fill(name)
  await dialog.getByRole('button', { name: '创建空间', exact: true }).click()
  await page.getByRole('heading', { name, exact: true }).waitFor()
}

export async function createBox(page: Page, name: string, visibility: 'public' | 'private') {
  await page.goto('/app/boxes')
  const boxLinks = page.locator('article').getByRole('link', { name: /^打开/ })
  await expect.poll(async () => (
    await boxLinks.count() > 0
    || await page.getByText('还没有箱子', { exact: true }).count() > 0
  )).toBe(true)
  const linksBefore = await boxLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean))
  await page.locator('header').getByRole('button', { name: '创建箱子', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '创建箱子' })
  await expect(page).toHaveURL(/\/app\/boxes\?create=1$/)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true)
  await dialog.getByLabel('空间').selectOption({ label: '家' })
  await dialog.getByLabel('箱子名称').fill(name)
  await dialog.getByLabel('具体位置').fill('衣柜上层')
  const moreSettings = dialog.getByRole('button', { name: '更多设置' })
  if (await moreSettings.isVisible()) await moreSettings.click()
  await dialog.getByLabel('查看权限').selectOption(visibility)
  await dialog.getByRole('button', { name: '创建箱子', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await expect(boxLinks).toHaveCount(linksBefore.length + 1)
  const linksAfter = await boxLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')).filter(Boolean))
  const publicUrl = linksAfter.find((href) => !linksBefore.includes(href))
  expect(publicUrl).toBeTruthy()
  return publicUrl!
}
