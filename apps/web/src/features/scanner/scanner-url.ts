import { env } from '../../lib/env'

const boxPathPattern = /^\/b\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseNomoBoxPath(value: string) {
  try {
    const appOrigin = new URL(env.VITE_PUBLIC_APP_ORIGIN).origin
    const target = new URL(value.trim(), appOrigin)
    if (target.origin !== appOrigin || !boxPathPattern.test(target.pathname)) return null
    return target.pathname
  } catch {
    return null
  }
}
