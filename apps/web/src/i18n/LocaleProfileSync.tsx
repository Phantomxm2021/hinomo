import { useEffect, useRef } from 'react'
import { useMobileFeedback } from '../components/mobile-feedback'
import { useAuth } from '../features/auth/auth-context'
import { updateLocale } from '../features/profile/profile.api'
import { useI18n } from './I18nProvider'

/**
 * Keeps the signed-in profile's locale aligned with the global UI preference.
 *
 * The browser preference remains the source of truth for the current render;
 * this side effect is deliberately non-blocking and never rolls it back when
 * the profile write fails.
 */
export function LocaleProfileSync() {
  const { session } = useAuth()
  const { locale, t } = useI18n()
  const feedback = useMobileFeedback()
  const syncedKeyRef = useRef<string | null>(null)
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) return

    const syncKey = `${userId}:${locale}`
    if (syncedKeyRef.current === syncKey) return
    syncedKeyRef.current = syncKey

    let active = true
    void updateLocale(locale).catch(() => {
      if (active) feedback.notify(t('settings.languageSaveFailed'))
    })

    return () => {
      active = false
    }
  }, [feedback, locale, t, userId])

  return null
}
