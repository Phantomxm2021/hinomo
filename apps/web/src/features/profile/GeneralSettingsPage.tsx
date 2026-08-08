import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { ResponsiveEditorDialog } from '../../components/ResponsiveEditorDialog'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { useMediaQuery } from '../../lib/use-media-query'
import { useAuth } from '../auth/auth-context'
import { GeneralSettingsPanel } from './GeneralSettingsPanel'

export function GeneralSettingsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const { locale, setLocale, t } = useI18n()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const feedback = useMobileFeedback()
  const previousLocaleRef = useRef(locale)
  const user = session?.user

  useEffect(() => {
    if (previousLocaleRef.current === locale) return
    previousLocaleRef.current = locale
    feedback.notify(t('settings.languageSaved'))
  }, [feedback, locale, t])

  if (!user) return null

  const panel = <GeneralSettingsPanel locale={locale} onLocaleChange={setLocale} presentation={isDesktop ? 'dialog' : 'page'} />

  if (isDesktop) {
    return (
      <ResponsiveEditorDialog open title={t('settings.general')} busy={false} onClose={() => navigate(-1)} returnFocusSelector="[data-settings-general-link]" maxWidthClassName="max-w-xl">
        {panel}
      </ResponsiveEditorDialog>
    )
  }

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5" aria-labelledby="general-settings-title">
      <nav className="mobile-detail-nav sticky top-0 z-20 -mx-4 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label={t('settings.navigation')}>
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('settings.backToSettings')} onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink" id="general-settings-title">{t('settings.general')}</span>
        <span />
      </nav>

      {panel}
    </section>
  )
}
