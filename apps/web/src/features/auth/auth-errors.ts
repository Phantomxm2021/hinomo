const AUTH_ERROR_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, '邮箱或密码不正确'],
  [/email not confirmed/i, '请先完成邮箱验证'],
  [/user already registered/i, '该邮箱已注册'],
  [/password.*weak|weak.*password/i, '密码强度不足，请换一个密码'],
  [/same password|different from the old password/i, '新密码不能与原密码相同'],
  [/rate limit|too many requests/i, '操作过于频繁，请稍后重试'],
]

export function getAuthErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '')
  return (
    AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(rawMessage))?.[1] ??
    '操作失败，请稍后重试'
  )
}
