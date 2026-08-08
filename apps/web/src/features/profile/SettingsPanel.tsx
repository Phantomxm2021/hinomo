import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { useI18n } from '../../i18n/I18nProvider'

type SettingsPanelProps = {
  presentation: 'page' | 'dialog'
}

/** Shared settings list used by both the mobile page and the desktop dialog. */
export function SettingsPanel({ presentation }: SettingsPanelProps) {
  const { t } = useI18n()
  const cardClassName = presentation === 'dialog'
    ? 'overflow-hidden rounded-shell border border-line bg-surface shadow-soft'
    : 'overflow-hidden rounded-card border-0 bg-surface shadow-soft'
  const linkClassName = presentation === 'dialog'
    ? 'group flex min-h-[4.5rem] items-center gap-3 px-5 text-inherit no-underline transition-colors hover:bg-canvas'
    : 'group flex min-h-[4.5rem] items-center gap-3 px-4 text-inherit no-underline transition-colors hover:bg-canvas'

  return (
    <section className={cardClassName} role="group" aria-label={t('settings.items')}>
      <Link className={linkClassName} data-settings-general-link to="/app/me/settings/general">
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
  )
}
