type Translate = (key: string) => string

const AUTH_ERROR_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'auth.errors.invalidCredentials'],
  [/email not confirmed/i, 'auth.errors.emailNotConfirmed'],
  [/user already registered/i, 'auth.errors.emailAlreadyRegistered'],
  [/password.*weak|weak.*password/i, 'auth.errors.passwordWeak'],
  [/same password|different from the old password/i, 'auth.errors.samePassword'],
  [/rate limit|too many requests/i, 'auth.errors.rateLimit'],
]

const fallbackMessages: Record<string, string> = {
  'auth.errors.invalidCredentials': '邮箱或密码不正确',
  'auth.errors.emailNotConfirmed': '请先完成邮箱验证',
  'auth.errors.emailAlreadyRegistered': '该邮箱已注册',
  'auth.errors.passwordWeak': '密码强度不足，请换一个密码',
  'auth.errors.samePassword': '新密码不能与原密码相同',
  'auth.errors.rateLimit': '操作过于频繁，请稍后重试',
  'auth.errors.requestFailed': '操作失败，请稍后重试',
}

export function getAuthErrorMessage(error: unknown, translate?: Translate) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '')
  const key = AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(rawMessage))?.[1] ?? 'auth.errors.requestFailed'
  return translate?.(key) ?? fallbackMessages[key] ?? fallbackMessages['auth.errors.requestFailed']
}
