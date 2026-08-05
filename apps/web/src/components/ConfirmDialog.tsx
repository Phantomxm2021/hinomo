import { useCallback, useEffect, useId, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { SYSTEM_DIALOG_Z_INDEX } from './overlay-layers'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
  error?: string
  returnFocusRef?: RefObject<HTMLElement | null>
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认删除',
  busy = false,
  error,
  returnFocusRef,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const descriptionId = `${dialogId}-description`
  const dialogRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const implicitReturnFocusRef = useRef<HTMLElement | null>(null)
  const restoreFocus = useCallback(() => {
    const explicitTarget = returnFocusRef?.current
    if (explicitTarget?.isConnected) {
      explicitTarget.focus()
      return
    }

    const implicitTarget = implicitReturnFocusRef.current
    if (implicitTarget?.isConnected) implicitTarget.focus()
  }, [returnFocusRef])

  useEffect(() => {
    if (!open) return

    const activeElement = document.activeElement
    implicitReturnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
      ? activeElement
      : null
    cancelRef.current?.focus()
    return restoreFocus
  }, [open, restoreFocus])

  useEffect(() => {
    if (!open) return

    if (busy) dialogRef.current?.focus()
    else if (document.activeElement === dialogRef.current) confirmRef.current?.focus()
  }, [busy, open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!busy) onCancel()
        return
      }
      if (event.key !== 'Tab') return

      const controls = [cancelRef.current, confirmRef.current]
        .filter((control): control is HTMLButtonElement => Boolean(control && !control.disabled))
      if (controls.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = controls[0]
      const last = controls.at(-1)!
      const activeElement = document.activeElement
      if (!controls.includes(activeElement as HTMLButtonElement)) {
        event.preventDefault()
        if (event.shiftKey) last.focus()
        else first.focus()
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel, open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 isolate grid place-items-center bg-black/45 p-5 backdrop-blur-sm" data-overlay-layer="dialog" style={{ zIndex: SYSTEM_DIALOG_Z_INDEX }} role="presentation">
      <section
        ref={dialogRef}
        className="w-full max-w-sm rounded-shell border border-line bg-surface p-6 shadow-float"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-modal="true"
        role="alertdialog"
        tabIndex={-1}
      >
        <h2 className="mb-2 text-section-title font-bold text-ink" id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {error ? (
          <p className="mt-3 rounded-control border border-danger/25 bg-danger/5 p-3 text-sm font-bold text-danger" role="alert">{error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2.5">
          <button ref={cancelRef} className="min-h-11 rounded-control border border-line bg-canvas px-4 py-2 font-bold text-ink" type="button" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button ref={confirmRef} className="min-h-11 rounded-control border border-danger bg-danger px-4 py-2 font-bold text-white" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? '处理中…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
