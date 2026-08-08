type Translate = (key: string) => string

export type AuthErrorKey =
  | 'auth.errors.invalidCredentials'
  | 'auth.errors.emailNotConfirmed'
  | 'auth.errors.emailAlreadyRegistered'
  | 'auth.errors.passwordWeak'
  | 'auth.errors.samePassword'
  | 'auth.errors.rateLimit'
  | 'auth.errors.requestFailed'

const AUTH_ERROR_MESSAGES: Array<[RegExp, AuthErrorKey]> = [
  [/invalid login credentials/i, 'auth.errors.invalidCredentials'],
  [/email not confirmed/i, 'auth.errors.emailNotConfirmed'],
  [/user already registered/i, 'auth.errors.emailAlreadyRegistered'],
  [/password.*weak|weak.*password/i, 'auth.errors.passwordWeak'],
  [/same password|different from the old password/i, 'auth.errors.samePassword'],
  [/rate limit|too many requests/i, 'auth.errors.rateLimit'],
]

export function getAuthErrorKey(error: unknown): AuthErrorKey {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '')
  return AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(rawMessage))?.[1] ?? 'auth.errors.requestFailed'
}

export function getAuthErrorMessage(error: unknown, translate?: Translate) {
  const key = getAuthErrorKey(error)
  return translate?.(key) ?? key
}
