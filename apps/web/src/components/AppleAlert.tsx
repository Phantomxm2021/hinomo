import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nProvider'
import { SYSTEM_ALERT_Z_INDEX } from './overlay-layers'

export type AppleAlertProps = {
  open: boolean
  title: string
  message?: string
  primaryLabel?: string
  onPrimary?: () => void | Promise<void>
  cancelLabel?: string
  onCancel?: () => void | Promise<void>
  primaryDisabled?: boolean
  primaryBusy?: boolean
  onActionError?: (error: unknown) => void
  onClose: () => void
}

function getFocusableButtons(container: HTMLElement | null) {
  return container ? Array.from(container.querySelectorAll<HTMLButtonElement>('button:not([disabled])')) : []
}

export function AppleAlert({ open, title, message, primaryLabel, onPrimary, cancelLabel, onCancel, primaryDisabled = false, primaryBusy = false, onActionError, onClose }: AppleAlertProps) {
  const { t } = useI18n()
  const titleId = useId()
  const messageId = useId()
  const dialogRef = useRef<HTMLElement | null>(null)
  const primaryRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const actionPendingRef = useRef(false)
  const [actionPending, setActionPending] = useState(false)
  const resolvedPrimaryLabel = primaryLabel ?? t('common.ok')

  const focusFirstEnabledControl = useCallback(() => {
    const buttons = getFocusableButtons(dialogRef.current)
    if (!primaryDisabled) {
      primaryRef.current?.focus()
      if (document.activeElement === primaryRef.current) return
    }
    buttons[0]?.focus()
  }, [primaryDisabled])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    focusFirstEnabledControl()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (actionPendingRef.current) return
        event.preventDefault()
        onCancel?.()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const buttons = getFocusableButtons(dialogRef.current)
      if (buttons.length === 0) return
      const first = buttons[0]
      const last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [focusFirstEnabledControl, onCancel, onClose, open])

  useEffect(() => {
    if (open && primaryDisabled) focusFirstEnabledControl()
  }, [focusFirstEnabledControl, open, primaryDisabled])

  if (!open) return null

  const reportActionError = (error: unknown) => {
    try {
      onActionError?.(error)
    } catch {
      // A feedback callback must never create an unhandled rejection.
    }
  }

  const runAction = (action?: () => void | Promise<void>) => {
    if (actionPendingRef.current) return
    actionPendingRef.current = true
    setActionPending(true)

    let result: void | Promise<void>
    try {
      result = action?.()
    } catch (error) {
      reportActionError(error)
      actionPendingRef.current = false
      setActionPending(false)
      return
    }

    if (!result || typeof result !== 'object' || typeof result.then !== 'function') {
      actionPendingRef.current = false
      setActionPending(false)
      onClose()
      return
    }

    void Promise.resolve(result)
      .then(() => onClose())
      .catch(reportActionError)
      .finally(() => {
        actionPendingRef.current = false
        setActionPending(false)
      })
  }

  return createPortal(
    <div className="fixed inset-0 isolate grid place-items-center bg-ink/30 px-5 backdrop-blur-[3px]" data-overlay-layer="alert" style={{ zIndex: SYSTEM_ALERT_Z_INDEX }} role="presentation">
      <section ref={dialogRef} className="w-full max-w-[22rem] overflow-hidden rounded-[1.25rem] border border-white/45 bg-surface/95 text-center shadow-[0_24px_70px_rgb(48_39_30_/_24%)] backdrop-blur-xl" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={message ? messageId : undefined}>
        <div className="px-6 pt-6 pb-5">
          <h2 className="m-0 text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink" id={titleId}>{title}</h2>
          {message ? <p className="mt-1.5 mb-0 text-[0.8125rem] leading-5 text-muted" id={messageId}>{message}</p> : null}
        </div>
        <div className={`grid border-t border-line/80 ${cancelLabel ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {cancelLabel ? <button className="min-h-12 border-r border-line/80 bg-transparent px-3 text-[1.0625rem] text-brand disabled:opacity-45" type="button" disabled={actionPending} onClick={() => runAction(onCancel)}>{cancelLabel}</button> : null}
          <button ref={primaryRef} className="min-h-12 bg-transparent px-3 text-[1.0625rem] font-semibold text-brand disabled:opacity-45" type="button" disabled={primaryDisabled || actionPending} aria-busy={(primaryBusy || actionPending) || undefined} onClick={() => runAction(onPrimary)}>{resolvedPrimaryLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
