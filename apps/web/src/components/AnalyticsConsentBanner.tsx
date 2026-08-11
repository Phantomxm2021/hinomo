import { useSyncExternalStore } from 'react'
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from '../lib/analytics'
import { useI18n } from '../i18n/I18nProvider'

export function AnalyticsConsentBanner() {
  const { t } = useI18n()
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getAnalyticsConsent)

  if (consent !== 'unset') return null

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-card border border-line bg-surface p-4 shadow-soft" aria-label={t('analytics.consentLabel')}>
      <p className="m-0 text-body font-semibold text-ink">{t('analytics.description')}</p>
      <div className="mt-3 flex justify-end gap-2">
        <button className="rounded-full px-4 py-2 text-meta font-semibold text-muted" type="button" onClick={() => setAnalyticsConsent('declined')}>{t('analytics.decline')}</button>
        <button className="rounded-full bg-brand px-4 py-2 text-meta font-bold text-white" type="button" onClick={() => setAnalyticsConsent('accepted')}>{t('analytics.allow')}</button>
      </div>
    </aside>
  )
}
