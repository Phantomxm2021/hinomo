import { useI18n } from '../i18n/I18nProvider'
import { isLocale, type Locale } from '../i18n/locale'

export type LanguageSwitcherProps = {
  locale: Locale
  onChange: (locale: Locale) => void
  compact?: boolean
}

/** A controlled, context-agnostic language control for public and app surfaces. */
export function LanguageSwitcher({ locale, onChange, compact = false }: LanguageSwitcherProps) {
  const { t } = useI18n()

  return (
    <label className={`language-switcher inline-flex items-center gap-2 text-meta font-semibold text-muted ${compact ? 'language-switcher-compact' : ''}`}>
      <span className="sr-only">{t('languageSwitcher.label')}</span>
      <select
        aria-label={t('languageSwitcher.label')}
        className={`rounded-full border border-line bg-surface text-meta font-bold text-ink outline-none transition focus-visible:ring-2 focus-visible:ring-brand/40 ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2'}`}
        value={locale}
        onChange={(event) => {
          const nextLocale = event.target.value
          if (isLocale(nextLocale)) onChange(nextLocale)
        }}
      >
        <option value="zh-CN">{t('languageSwitcher.chinese')}</option>
        <option value="en-US">{t('languageSwitcher.english')}</option>
      </select>
    </label>
  )
}
