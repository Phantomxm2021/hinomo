import type { ReactNode } from 'react'
import { AppIcon, type AppIconName } from './AppIcon'
import { Skeleton, SkeletonGroup } from './Skeleton'
import { useI18n } from '../i18n/I18nProvider'

type PageStateProps =
  | { state: 'loading'; label: string }
  | { state: 'empty'; title: string; description?: string; icon?: AppIconName; action?: ReactNode }
  | { state: 'error'; message: string; onRetry: () => void; retryLabel?: string }

export function PageState(props: PageStateProps) {
  const { t } = useI18n()
  if (props.state === 'loading') {
    return (
      <SkeletonGroup className="min-h-40 rounded-card border border-line bg-surface/70 p-6" label={props.label}>
        <div className="grid gap-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </SkeletonGroup>
    )
  }

  if (props.state === 'empty') {
    return (
      <div className="grid min-h-44 place-content-center justify-items-center gap-3 px-6 py-10 text-center" data-page-state="empty">
        <span className="grid size-12 place-items-center rounded-[1rem] bg-placeholder/45 text-muted/65" aria-hidden="true">
          <AppIcon name={props.icon ?? 'box'} size={22} />
        </span>
        <div className="grid max-w-sm gap-1">
          <h2 className="m-0 text-card-title font-semibold tracking-[-0.02em] text-ink">{props.title}</h2>
          {props.description ? <p className="m-0 text-meta leading-relaxed text-muted">{props.description}</p> : null}
        </div>
        {props.action ? (
          <div className="mt-1 [&_a]:inline-flex [&_a]:min-h-10 [&_a]:items-center [&_a]:rounded-full [&_a]:border [&_a]:border-line [&_a]:bg-surface [&_a]:px-4 [&_a]:py-2 [&_a]:text-sm [&_a]:font-semibold [&_a]:text-ink [&_a]:no-underline [&_a]:shadow-soft [&_button]:inline-flex [&_button]:min-h-10 [&_button]:items-center [&_button]:rounded-full [&_button]:border [&_button]:border-line [&_button]:bg-surface [&_button]:px-4 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-ink [&_button]:shadow-soft">
            {props.action}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section className="grid min-h-44 place-content-center justify-items-center gap-3 rounded-card border border-danger/20 bg-danger/5 px-6 py-10 text-center" data-page-state="error" role="alert">
      <span className="grid size-12 place-items-center rounded-[1rem] bg-danger/10 text-danger" aria-hidden="true">
        <AppIcon name="close" size={22} />
      </span>
      <h2 className="m-0 max-w-sm text-card-title font-semibold tracking-[-0.02em] text-ink">{props.message}</h2>
      <button className="mt-1 inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-soft" type="button" onClick={props.onRetry}>
        {props.retryLabel ?? t('common.retry')}
      </button>
    </section>
  )
}
