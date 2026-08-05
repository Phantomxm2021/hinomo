import { type ReactNode, type RefObject, useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from './AppIcon'

export type ResponsiveEditorDialogProps = {
  open: boolean
  title: string
  busy: boolean
  onClose: () => void
  children: ReactNode
  initialFocusSelector?: string
  maxWidthClassName?: string
  returnFocusRef?: RefObject<HTMLElement | null>
}

function getControls(dialog: HTMLElement | null) {
  if (!dialog) return []
  return Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not(:disabled):not([data-editor-focus-sentinel]), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
  ))
}

export function ResponsiveEditorDialog({
  open,
  title,
  busy,
  onClose,
  children,
  initialFocusSelector = 'select:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
  maxWidthClassName = 'max-w-lg',
  returnFocusRef,
}: ResponsiveEditorDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const close = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])
  const closeRef = useRef(close)
  closeRef.current = close

  useEffect(() => {
    if (!open) return

    const appShell = document.querySelector<HTMLElement>('[data-app-shell]')
    const previousAriaHidden = appShell?.getAttribute('aria-hidden') ?? null
    const hadInert = appShell?.hasAttribute('inert') ?? false
    const previousOverflow = document.body.style.overflow
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = 'hidden'

    const focusInitialControl = () => {
      if (dialogRef.current?.contains(document.activeElement)) return
      const target = dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector)
      target?.focus()
    }
    const focusFrame = window.requestAnimationFrame(focusInitialControl)
    const focusObserver = new MutationObserver(focusInitialControl)
    if (dialogRef.current) focusObserver.observe(dialogRef.current, { childList: true, subtree: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      focusObserver.disconnect()
      document.removeEventListener('keydown', onKeyDown)
      if (appShell) {
        if (!hadInert) appShell.removeAttribute('inert')
        if (previousAriaHidden === null) appShell.removeAttribute('aria-hidden')
        else appShell.setAttribute('aria-hidden', previousAriaHidden)
      }
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => returnFocusRef?.current?.focus())
    }
  }, [initialFocusSelector, open, returnFocusRef])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] lg:items-center lg:p-3"
      data-testid="editor-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        ref={dialogRef}
        className={`relative max-h-[calc(100dvh-max(0.75rem,var(--safe-area-top)))] w-full ${maxWidthClassName} overflow-y-auto rounded-t-[1.5rem] border-x-0 border-t border-b-0 border-line bg-canvas p-5 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-float lg:max-h-[calc(100dvh-1.5rem)] lg:rounded-shell lg:border lg:p-6`}
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby={titleId}
      >
        <span className="pointer-events-none fixed size-px overflow-hidden opacity-0" data-editor-focus-sentinel tabIndex={0} onFocus={() => getControls(dialogRef.current).at(-1)?.focus()} />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-section-title font-bold" id={titleId}>{title}</h2>
          <button className="grid size-11 flex-none place-items-center rounded-control border border-line bg-surface text-ink" type="button" aria-label={`关闭${title}`} disabled={busy} onClick={close}>
            <AppIcon name="close" />
          </button>
        </div>
        {children}
        <span className="pointer-events-none fixed size-px overflow-hidden opacity-0" data-editor-focus-sentinel tabIndex={0} onFocus={() => getControls(dialogRef.current)[0]?.focus()} />
      </section>
    </div>,
    document.body,
  )
}
