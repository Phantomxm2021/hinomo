import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/I18nProvider'

export function AuthPageFrame({ title, subtitle, children }: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const { locale } = useI18n()
  return (
    <main className="auth-page text-body" lang={locale}>
      <h1 className="text-page-title font-extrabold">{title}</h1>
      <p className="auth-page-subtitle text-body text-muted">{subtitle}</p>
      {children}
    </main>
  )
}

export function AuthField({ id, label, error, children }: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  const errorId = `${id}-error`
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}

export function AuthSubmitButton({ disabled, pending, label, pendingLabel }: {
  disabled: boolean
  pending: boolean
  label: string
  pendingLabel: string
}) {
  return (
    <button type="submit" disabled={disabled || pending}>
      <span>{pending ? pendingLabel : label}</span>
      <span aria-hidden="true">→</span>
    </button>
  )
}

export function AuthOptions({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return <nav aria-label={t('auth.options.label')}>{children}</nav>
}
