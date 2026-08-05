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

function getTopmostSystemOverlay() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-overlay-layer]'))
    .filter((overlay) => {
      if (overlay.hidden || overlay.getAttribute('aria-hidden') === 'true') return false
      const style = window.getComputedStyle(overlay)
      return style.display !== 'none' && style.visibility !== 'hidden'
    })
    .reduce<HTMLElement | null>((topmost, overlay) => {
      if (!topmost) return overlay
      const topmostZIndex = Number.parseInt(window.getComputedStyle(topmost).zIndex, 10) || 0
      const overlayZIndex = Number.parseInt(window.getComputedStyle(overlay).zIndex, 10) || 0
      return overlayZIndex > topmostZIndex ? overlay : topmost
    }, null)
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
  const initialFocusSelectorRef = useRef(initialFocusSelector)
  const returnFocusRefRef = useRef(returnFocusRef)
  closeRef.current = close
  initialFocusSelectorRef.current = initialFocusSelector
  returnFocusRefRef.current = returnFocusRef
  const restoreFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const target = returnFocusRefRef.current?.current
      if (target && typeof target.focus === 'function') target.focus()
    })
  }, [])

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
      const target = dialogRef.current?.querySelector<HTMLElement>(initialFocusSelectorRef.current)
      const activeElement = document.activeElement
      const firstControl = getControls(dialogRef.current)[0]
      if (target && dialogRef.current?.contains(activeElement) && activeElement !== firstControl) return
      if (!target && dialogRef.current?.contains(activeElement)) return
      const fallback = target ?? getControls(dialogRef.current)[0] ?? dialogRef.current
      fallback?.focus()
    }
    const focusFrame = window.requestAnimationFrame(focusInitialControl)
    const focusObserver = new MutationObserver(focusInitialControl)
    if (dialogRef.current) focusObserver.observe(dialogRef.current, { childList: true, subtree: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const activeSystemOverlay = getTopmostSystemOverlay()
      if (activeSystemOverlay && !activeSystemOverlay.contains(dialogRef.current)) return
      closeRef.current()
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
      restoreFocus()
    }
  }, [open, restoreFocus])

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
        tabIndex={-1}
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
