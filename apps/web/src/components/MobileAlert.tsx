import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type MobileAlertProps = {
  open: boolean
  title: string
  message?: string
  primaryLabel?: string
  onPrimary?: () => void
  cancelLabel?: string
  onClose: () => void
}

export function MobileAlert({ open, title, message, primaryLabel = '好', onPrimary, cancelLabel, onClose }: MobileAlertProps) {
  const primaryRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    primaryRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center bg-ink/30 px-8 backdrop-blur-[2px] lg:hidden" role="presentation">
      <section className="w-full max-w-[17rem] overflow-hidden rounded-[1.25rem] bg-surface/95 text-center shadow-float backdrop-blur-xl" role="alertdialog" aria-modal="true" aria-labelledby="mobile-alert-title" aria-describedby={message ? 'mobile-alert-message' : undefined}>
        <div className="px-5 pt-5 pb-4">
          <h2 className="m-0 text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink" id="mobile-alert-title">{title}</h2>
          {message ? <p className="mt-1.5 mb-0 text-[0.8125rem] leading-5 text-muted" id="mobile-alert-message">{message}</p> : null}
        </div>
        <div className={`grid border-t border-line/80 ${cancelLabel ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {cancelLabel ? <button className="min-h-12 border-r border-line/80 bg-transparent px-3 text-[1.0625rem] text-brand" type="button" onClick={onClose}>{cancelLabel}</button> : null}
          <button ref={primaryRef} className="min-h-12 bg-transparent px-3 text-[1.0625rem] font-semibold text-brand" type="button" onClick={() => { onPrimary?.(); onClose() }}>{primaryLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
