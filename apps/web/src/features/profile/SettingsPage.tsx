import { Link, useNavigate } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'

export function SettingsPage() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <section className="mx-auto grid w-full max-w-2xl gap-5" aria-labelledby="settings-title">
      <nav className="mobile-detail-nav sticky top-0 z-20 -mx-4 grid min-h-14 grid-cols-[6rem_minmax(0,1fr)_6rem] items-end border-b border-line/70 bg-canvas/90 px-4 pt-[max(0.5rem,var(--safe-area-top))] pb-2 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5 lg:hidden" aria-label={t('settings.navigation')}>
        <div className="flex justify-start">
          <button className="inline-flex size-11 items-center justify-center rounded-full text-ink active:bg-placeholder/70 active:opacity-70" type="button" aria-label={t('settings.backToMe')} onClick={() => navigate(-1)}>
            <AppIcon className="rotate-180" name="chevron-right" size={22} />
          </button>
        </div>
        <span className="truncate pb-2 text-center text-[1.0625rem] leading-none font-bold text-ink">{t('settings.title')}</span>
        <span />
      </nav>

      <header className="hidden items-center gap-3 py-3 lg:flex">
        <Link className="grid size-10 place-items-center rounded-full text-ink no-underline hover:bg-surface" to="/app/me" aria-label={t('settings.backToMe')}>
          <AppIcon className="rotate-180" name="chevron-right" size={20} />
        </Link>
        <h1 className="m-0 text-page-title font-extrabold" id="settings-title">{t('settings.title')}</h1>
      </header>

      <section className="overflow-hidden rounded-card border-0 bg-surface shadow-soft lg:rounded-shell lg:border lg:border-line" role="group" aria-label={t('settings.items')}>
        <Link className="group flex min-h-[4.5rem] items-center gap-3 px-4 text-inherit no-underline transition-colors hover:bg-canvas lg:px-5" to="/app/me/settings/general">
          <span className="grid size-8 shrink-0 place-items-center rounded-[0.6rem] bg-muted text-white shadow-sm">
            <AppIcon name="settings" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-body font-semibold text-ink">{t('settings.general')}</strong>
            <span className="mt-0.5 block truncate text-meta text-muted">{t('settings.languageRegion')}</span>
          </span>
          <AppIcon name="chevron-right" className="shrink-0 text-muted/70 transition-transform group-hover:translate-x-0.5" size={18} />
        </Link>
      </section>
    </section>
  )
}
