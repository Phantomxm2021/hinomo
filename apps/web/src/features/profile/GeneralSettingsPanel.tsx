import type { Locale } from '../../i18n/locale'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useI18n } from '../../i18n/I18nProvider'
import { getAnalyticsConsent, setAnalyticsConsent, subscribeAnalyticsConsent } from '../../lib/analytics'
import { useSyncExternalStore } from 'react'

type GeneralSettingsPanelProps = {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  presentation: 'page' | 'dialog'
}

/** Shared general-settings content used by both the mobile page and desktop dialog. */
export function GeneralSettingsPanel({ locale, onLocaleChange, presentation }: GeneralSettingsPanelProps) {
  const { t } = useI18n()
  const analyticsConsent = useSyncExternalStore(subscribeAnalyticsConsent, getAnalyticsConsent, getAnalyticsConsent)
  const headingClassName = presentation === 'dialog' ? 'm-0 text-meta font-medium text-muted' : 'm-0 px-4 text-meta font-medium text-muted'
  const cardClassName = presentation === 'dialog'
    ? 'overflow-hidden rounded-shell border border-line bg-surface shadow-soft'
    : 'overflow-hidden rounded-card border-0 bg-surface shadow-soft'
  const rowClassName = presentation === 'dialog'
    ? 'flex min-h-16 items-center justify-between gap-4 px-5 text-body font-semibold text-ink'
    : 'flex min-h-16 items-center justify-between gap-4 px-4 text-body font-semibold text-ink'

  return (
    <div className="grid gap-2">
      <h2 className={headingClassName}>{t('settings.languageRegion')}</h2>
      <section className={cardClassName} role="group" aria-label={t('settings.languageRegion')}>
        <div className={rowClassName}>
          <span>{t('settings.language')}</span>
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
        </div>
      </section>
      <h2 className={headingClassName}>{t('analytics.title')}</h2>
      <section className={cardClassName} role="group" aria-label={t('analytics.settingsLabel')}>
        <div className={rowClassName}>
          <span>{t('analytics.contentFree')}</span>
          <select
            aria-label={t('analytics.title')}
            className="rounded-full border border-line bg-surface px-3 py-2 text-meta font-bold text-ink outline-none transition focus-visible:ring-2 focus-visible:ring-brand/40"
            value={analyticsConsent === 'accepted' ? 'accepted' : 'declined'}
            onChange={(event) => setAnalyticsConsent(event.target.value as 'accepted' | 'declined')}
          >
            <option value="accepted">{t('analytics.allowed')}</option>
            <option value="declined">{t('analytics.notAllowed')}</option>
          </select>
        </div>
      </section>
    </div>
  )
}
