import type { User } from '@supabase/supabase-js'

export function userDisplayName(user: User) {
  return user.user_metadata?.display_name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'Nomo 用户'
}
