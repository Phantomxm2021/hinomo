import type { Locale } from '../../i18n/locale'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useI18n } from '../../i18n/I18nProvider'

type GeneralSettingsPanelProps = {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  presentation: 'page' | 'dialog'
}

/** Shared general-settings content used by both the mobile page and desktop dialog. */
export function GeneralSettingsPanel({ locale, onLocaleChange, presentation }: GeneralSettingsPanelProps) {
  const { t } = useI18n()
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
    </div>
  )
}
