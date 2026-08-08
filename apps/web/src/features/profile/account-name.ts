import type { User } from '@supabase/supabase-js'

export function userDisplayName(user: User, fallback = 'Nomo user') {
  return user.user_metadata?.display_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || fallback
}
