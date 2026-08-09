import { createClient } from '@supabase/supabase-js'

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`missing ${name}`)
  return value
}

const url = required('SUPABASE_URL')
const parsedUrl = new URL(url)
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
  throw new Error('SUPABASE_URL must target localhost or 127.0.0.1')
}

const anonKey = required('SUPABASE_ANON_KEY')
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const fixturePrefix = `venue-sharing-race-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const password = `${fixturePrefix}-password`
const fixtureIds = []

function scenario(name, detail) {
  process.stdout.write(`${name}: ${detail}\n`)
}

function codeFor(error) {
  if (!error || typeof error !== 'object') return 'unknown_error'
  return typeof error.message === 'string' ? error.message : typeof error.code === 'string' ? error.code : 'unknown_error'
}

async function createFixture(index) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${fixturePrefix}-${index}@example.test`, password, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`fixture-create: ${codeFor(error)}`)
  fixtureIds.push(data.user.id)
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: signInError } = await client.auth.signInWithPassword({ email: `${fixturePrefix}-${index}@example.test`, password })
  if (signInError) throw new Error(`fixture-sign-in: ${codeFor(signInError)}`)
  return client
}

async function rpcRow(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw Object.assign(new Error(codeFor(error)), { code: codeFor(error) })
  const row = data?.[0]
  if (!row) throw new Error(`${name}: empty_result`)
  return row
}

async function joinWithFreshInvite(owner, member, venueId) {
  const invite = await rpcRow(owner, 'create_venue_invite', { p_venue_id: venueId })
  const result = await rpcRow(member, 'accept_venue_invite', { p_token: invite.token })
  if (result.result !== 'joined') throw new Error(`sequential-join: ${result.result}`)
}

try {
  const owner = await createFixture('owner')
  const members = await Promise.all([1, 2, 3, 4, 5].map(createFixture))
  const venue = await rpcRow(owner, 'list_accessible_venues', {})

  await joinWithFreshInvite(owner, members[0], venue.id)
  await joinWithFreshInvite(owner, members[1], venue.id)
  await joinWithFreshInvite(owner, members[2], venue.id)

  const finalSeatInvite = await rpcRow(owner, 'create_venue_invite', { p_venue_id: venue.id })
  const blocked = await owner.rpc('create_venue_invite', { p_venue_id: venue.id })
  if (codeFor(blocked.error) !== 'venue_member_limit_reached') {
    throw new Error(`last-seat-reservation: ${codeFor(blocked.error)}`)
  }
  scenario('last-seat-reservation', 'second invite rejected')

  const race = await Promise.allSettled([
    rpcRow(members[3], 'accept_venue_invite', { p_token: finalSeatInvite.token }),
    rpcRow(members[4], 'accept_venue_invite', { p_token: finalSeatInvite.token }),
  ])
  const joined = race.filter((entry) => entry.status === 'fulfilled' && entry.value.result === 'joined').length
  const used = race.filter((entry) => entry.status === 'rejected' && codeFor(entry.reason) === 'venue_invite_used').length
  if (joined !== 1 || used !== 1) throw new Error(`last-seat-race: ${joined} joined, ${used} venue_invite_used`)
  const finalMembers = await rpcRow(owner, 'get_venue_access_summary', { p_venue_id: venue.id })
  if (finalMembers.member_count !== 5) throw new Error(`last-seat-race: member_count ${finalMembers.member_count}`)
  scenario('last-seat-race', '1 joined, 1 venue_invite_used')
} finally {
  await Promise.all(fixtureIds.map(async (id) => {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) process.stderr.write(`fixture-cleanup: ${codeFor(error)}\n`)
  }))
}
