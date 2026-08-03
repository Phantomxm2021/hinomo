import { z } from 'zod'

export const env = z
  .object({
    VITE_SUPABASE_URL: z.string().url(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
    VITE_PUBLIC_APP_ORIGIN: z.string().url(),
  })
  .parse(import.meta.env)

const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])

export function resolvePublicAppOrigin(configuredOrigin: string, runtimeOrigin?: string) {
  const configured = new URL(configuredOrigin)
  if (!runtimeOrigin || !localHosts.has(configured.hostname)) return configured.origin

  const runtime = new URL(runtimeOrigin)
  const runtimeIsWebOrigin = runtime.protocol === 'http:' || runtime.protocol === 'https:'
  if (runtimeIsWebOrigin && !localHosts.has(runtime.hostname)) return runtime.origin
  return configured.origin
}

export function publicAppOrigin() {
  return resolvePublicAppOrigin(
    env.VITE_PUBLIC_APP_ORIGIN,
    typeof window === 'undefined' ? undefined : window.location.origin,
  )
}
