import type { Locale } from '../../i18n/locale'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useI18n } from '../../i18n/I18nProvider'

type GeneralSettingsPanelProps = {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

/** Shared general-settings content used by both the mobile page and desktop dialog. */
export function GeneralSettingsPanel({ locale, onLocaleChange }: GeneralSettingsPanelProps) {
  const { t } = useI18n()

  return (
    <div className="grid gap-2">
      <h2 className="m-0 px-4 text-meta font-medium text-muted">{t('settings.languageRegion')}</h2>
      <section className="overflow-hidden rounded-card border-0 bg-surface shadow-soft lg:rounded-shell lg:border lg:border-line" role="group" aria-label={t('settings.languageRegion')}>
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 text-body font-semibold text-ink lg:px-5">
          <span>{t('settings.language')}</span>
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
        </div>
      </section>
    </div>
  )
}
