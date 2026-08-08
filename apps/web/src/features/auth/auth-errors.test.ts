import { describe, expect, it } from 'vitest'
import { getAuthErrorKey, getAuthErrorMessage } from './auth-errors'

describe('auth error localization keys', () => {
  it('returns a stable key for known and unknown auth errors', () => {
    expect(getAuthErrorKey(new Error('Invalid login credentials'))).toBe('auth.errors.invalidCredentials')
    expect(getAuthErrorKey(new Error('unexpected provider failure'))).toBe('auth.errors.requestFailed')
  })

  it('does not fall back to a hardcoded locale when no translator is provided', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'))).toBe('auth.errors.invalidCredentials')
  })
})
