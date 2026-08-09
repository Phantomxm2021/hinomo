function hasUnsafeControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1F || code === 0x7F
  })
}

export function safeReturnTo(value: unknown) {
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || hasUnsafeControlCharacter(value)
    || typeof window === 'undefined'
  ) return '/app'

  try {
    const target = new URL(value, window.location.origin)
    if (target.origin !== window.location.origin) return '/app'
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return '/app'
  }
}
