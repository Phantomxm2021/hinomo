import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useAuth } from '../auth/auth-context'
import { useI18n } from '../../i18n/I18nProvider'

export function GeneralSettingsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { locale, setLocale, t } = useI18n()
  const feedback = useMobileFeedback()
  const previousLocaleRef = useRef(locale)
  const user = session?.user

  useEffect(() => {
    if (previousLocaleRef.current === locale) return
    previousLocaleRef.current = locale
    feedback.notify(t('settings.languageSaved'))
  }, [feedback, locale, t])

  if (!user) return null

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5" aria-labelledby="general-settings-title">
      <nav className="mobile-detail-nav sticky top-0 z-20 -mx-4 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label={t('settings.navigation')}>
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('settings.backToSettings')} onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">{t('settings.general')}</span>
        <span />
      </nav>

      <header className="hidden items-center gap-3 py-3 lg:flex">
        <Link className="grid size-10 place-items-center rounded-full text-ink no-underline hover:bg-surface" to="/app/me/settings" aria-label={t('settings.backToSettings')}>
          <AppIcon className="rotate-180" name="chevron-right" size={20} />
        </Link>
        <h1 className="m-0 text-page-title font-extrabold" id="general-settings-title">{t('settings.general')}</h1>
      </header>

      <div className="grid gap-2">
        <h2 className="m-0 px-4 text-meta font-medium text-muted">{t('settings.languageRegion')}</h2>
        <section className="overflow-hidden rounded-card border-0 bg-surface shadow-soft lg:rounded-shell lg:border lg:border-line" role="group" aria-label={t('settings.languageRegion')}>
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 text-body font-semibold text-ink lg:px-5">
            <span>{t('settings.language')}</span>
            <LanguageSwitcher locale={locale} onChange={setLocale} />
          </div>
        </section>
      </div>
    </section>
  )
}
