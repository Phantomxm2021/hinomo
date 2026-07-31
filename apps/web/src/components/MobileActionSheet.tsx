import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export type MobileSheetAction = {
  label: string
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

export function MobileActionSheet({ open, title, message, actions, cancelLabel = '取消', onClose }: {
  open: boolean
  title: string
  message?: string
  actions: MobileSheetAction[]
  cancelLabel?: string
  onClose: () => void
}) {
  const firstActionRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstActionRef.current?.focus()
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
    <div className="fixed inset-0 z-[110] flex items-end bg-ink/25 px-2 pb-[max(0.5rem,var(--safe-area-bottom))] backdrop-blur-[2px] lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="w-full" role="dialog" aria-modal="true" aria-labelledby="mobile-sheet-title" aria-describedby={message ? 'mobile-sheet-message' : undefined}>
        <div className="overflow-hidden rounded-[0.875rem] bg-surface/95 text-center shadow-float backdrop-blur-xl">
          <div className="px-5 pt-4 pb-3">
            <h2 className="m-0 text-[0.8125rem] font-semibold text-muted" id="mobile-sheet-title">{title}</h2>
            {message ? <p className="mt-1 mb-0 text-xs leading-4 text-muted" id="mobile-sheet-message">{message}</p> : null}
          </div>
          {actions.map((action, index) => (
            <button
              ref={index === 0 ? firstActionRef : undefined}
              className={`block min-h-14 w-full border-t border-line/80 bg-transparent px-4 text-[1.25rem] ${action.destructive ? 'text-danger' : 'text-brand'} disabled:opacity-45`}
              type="button"
              disabled={action.disabled}
              key={action.label}
              onClick={() => { action.onSelect(); onClose() }}
            >{action.label}</button>
          ))}
        </div>
        <button className="mt-2 min-h-14 w-full rounded-[0.875rem] bg-surface text-[1.25rem] font-semibold text-brand shadow-float" type="button" onClick={onClose}>{cancelLabel}</button>
      </section>
    </div>,
    document.body,
  )
}
