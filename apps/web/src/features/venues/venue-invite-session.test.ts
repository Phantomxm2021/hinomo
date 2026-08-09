import { afterEach, expect, test, vi } from 'vitest'
import { clearInviteToken, INVITE_SESSION_KEY, readInviteToken } from './venue-invite-session'

afterEach(() => {
  window.history.replaceState(null, '', '/join/venue')
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

test('moves a fragment invite token into this tab session and removes the fragment immediately', () => {
  const replaceState = vi.spyOn(window.history, 'replaceState')
  const localStorageSetItem = vi.fn()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { setItem: localStorageSetItem } })
  window.history.replaceState(null, '', '/join/venue#token=raw-invite-token')
  replaceState.mockClear()

  expect(readInviteToken()).toBe('raw-invite-token')
  expect(window.sessionStorage.getItem(INVITE_SESSION_KEY)).toBe('raw-invite-token')
  expect(window.location.hash).toBe('')
  expect(replaceState).toHaveBeenCalledWith(null, '', '/join/venue')
  expect(localStorageSetItem).not.toHaveBeenCalled()
})

test('keeps using the tab-scoped token after the fragment has been removed and can clear it', () => {
  window.sessionStorage.setItem(INVITE_SESSION_KEY, 'pending-token')

  expect(readInviteToken()).toBe('pending-token')
  clearInviteToken()
  expect(window.sessionStorage.getItem(INVITE_SESSION_KEY)).toBeNull()
})
