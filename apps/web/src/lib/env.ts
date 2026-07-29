import { z } from 'zod'

export const env = z
  .object({
    VITE_SUPABASE_URL: z.string().url(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
    VITE_PUBLIC_APP_ORIGIN: z.string().url(),
  })
  .parse(import.meta.env)
