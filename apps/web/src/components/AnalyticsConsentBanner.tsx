import { useSyncExternalStore } from 'react'
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  subscribeAnalyticsConsent,
} from '../lib/analytics'

export function AnalyticsConsentBanner() {
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getAnalyticsConsent)

  if (consent !== 'unset') return null

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-card border border-line bg-surface p-4 shadow-soft" aria-label="Analytics consent">
      <p className="m-0 text-body font-semibold text-ink">Analytics are optional and never include your stored content.</p>
      <div className="mt-3 flex justify-end gap-2">
        <button className="rounded-full px-4 py-2 text-meta font-semibold text-muted" type="button" onClick={() => setAnalyticsConsent('declined')}>No thanks</button>
        <button className="rounded-full bg-brand px-4 py-2 text-meta font-bold text-white" type="button" onClick={() => setAnalyticsConsent('accepted')}>Allow analytics</button>
      </div>
    </aside>
  )
}
