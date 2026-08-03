import type { ReactNode } from 'react'

export function AuthPageFrame({ title, subtitle, children }: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <main className="auth-page text-body" lang="zh-CN">
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

export function AuthSubmitButton({ pending, label, pendingLabel }: {
  pending: boolean
  label: string
  pendingLabel: string
}) {
  return (
    <button type="submit" disabled={pending}>
      <span>{pending ? pendingLabel : label}</span>
      <span aria-hidden="true">→</span>
    </button>
  )
}

export function AuthOptions({ children }: { children: ReactNode }) {
  return <nav aria-label="认证选项">{children}</nav>
}
