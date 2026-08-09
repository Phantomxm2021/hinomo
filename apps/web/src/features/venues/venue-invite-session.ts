export const INVITE_SESSION_KEY = 'nomo-pending-venue-invite'

function readFragmentToken() {
  if (typeof window === 'undefined' || !window.location.hash) return null
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  return token || null
}

export function readInviteToken() {
  if (typeof window === 'undefined') return null
  const token = readFragmentToken()
  if (token) {
    window.sessionStorage.setItem(INVITE_SESSION_KEY, token)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    return token
  }
  return window.sessionStorage.getItem(INVITE_SESSION_KEY)
}

export function clearInviteToken() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(INVITE_SESSION_KEY)
}
