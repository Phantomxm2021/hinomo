import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { BOX_ENTITLEMENT_DIALOG_Z_INDEX } from '../../components/overlay-layers'
import { useI18n } from '../../i18n/I18nProvider'

export type BoxLimitPaywallProps = {
  open: boolean
  busy: boolean
  onClose: () => void
  onPurchase: () => void
}

function getControls(dialog: HTMLElement | null) {
  if (!dialog) return []
  return Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not(:disabled):not([data-paywall-focus-sentinel]), a[href]',
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
      return overlayZIndex >= topmostZIndex ? overlay : topmost
    }, null)
}

export function BoxLimitPaywall({ open, busy, onClose, onPurchase }: BoxLimitPaywallProps) {
  const { t } = useI18n()
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const close = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])
  const closeCallbackRef = useRef(close)
  const titleId = useId()
  const descriptionId = useId()
  closeCallbackRef.current = close

  useEffect(() => {
    if (!open) return

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const appShell = document.querySelector<HTMLElement>('[data-app-shell]')
    const previousAriaHidden = appShell?.getAttribute('aria-hidden') ?? null
    const hadInert = appShell?.hasAttribute('inert') ?? false
    const previousOverflow = document.body.style.overflow
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = 'hidden'

    const focusClose = () => (closeRef.current?.disabled ? dialogRef.current : closeRef.current)?.focus()
    const focusFrame = window.requestAnimationFrame(focusClose)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const topmostOverlay = getTopmostSystemOverlay()
      if (topmostOverlay && topmostOverlay !== overlayRef.current) return
      closeCallbackRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      if (appShell) {
        if (!hadInert) appShell.removeAttribute('inert')
        if (previousAriaHidden === null) appShell.removeAttribute('aria-hidden')
        else appShell.setAttribute('aria-hidden', previousAriaHidden)
      }
      document.body.style.overflow = previousOverflow
      const previousActiveElement = previousActiveElementRef.current
      window.requestAnimationFrame(() => previousActiveElement?.isConnected && previousActiveElement.focus())
      previousActiveElementRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open || !busy) return
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus())
    return () => window.cancelAnimationFrame(focusFrame)
  }, [busy, open])

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] motion-reduce:transition-none lg:items-center lg:p-6"
      data-overlay-layer="box-limit-paywall"
      data-testid="box-limit-paywall-backdrop"
      role="presentation"
      style={{ zIndex: BOX_ENTITLEMENT_DIALOG_Z_INDEX }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-t-[1.75rem] bg-canvas px-5 pt-3 pb-[max(1.25rem,var(--safe-area-bottom))] shadow-float motion-reduce:transition-none lg:rounded-[1.75rem] lg:p-7"
        role="dialog"
        aria-busy={busy}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || getControls(dialogRef.current).length) return
          event.preventDefault()
          dialogRef.current?.focus()
        }}
      >
        <span className="pointer-events-none fixed size-px overflow-hidden opacity-0" data-paywall-focus-sentinel tabIndex={0} onFocus={() => (getControls(dialogRef.current).at(-1) ?? dialogRef.current)?.focus()} />
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-line lg:hidden" aria-hidden="true" />
        <div className="flex justify-end">
          <button ref={closeRef} className="grid size-11 place-items-center rounded-full bg-placeholder/70 text-muted disabled:opacity-50" type="button" aria-label={t('boxes.paywallClose')} disabled={busy} onClick={close}>
            <AppIcon name="close" />
          </button>
        </div>
        <div className="grid justify-items-center px-3 pb-2 text-center">
          <div className="mb-5 grid size-20 place-items-center rounded-[1.45rem] bg-brand text-white shadow-soft"><AppIcon name="lock" size={36} /></div>
          <p className="mb-2 text-xs font-extrabold tracking-[0.16em] text-brand">{t('boxes.planFree').toUpperCase()}</p>
          <h2 className="m-0 text-[1.6rem] leading-tight font-extrabold text-ink" id={titleId}>{t('boxes.paywallTitle')}</h2>
          <p className="mt-3 max-w-sm text-[0.95rem] leading-6 text-muted" id={descriptionId}>{t('boxes.paywallDescription')}</p>
        </div>
        <div className="mt-5 rounded-[1rem] bg-placeholder/60 px-4 py-3 text-sm leading-6 text-muted">
          <p className="m-0 font-semibold text-ink">{t('boxes.paywallCredits')}</p>
          <p className="m-0">{t('boxes.paywallLegal')}</p>
        </div>
        <button className="mt-5 min-h-13 w-full rounded-[0.95rem] bg-brand px-6 text-base font-extrabold text-white shadow-soft active:scale-[0.99] disabled:opacity-50" type="button" disabled={busy} onClick={onPurchase}>
          {t(busy ? 'boxes.paywallPurchasing' : 'boxes.paywallPurchase')}
        </button>
        <span className="pointer-events-none fixed size-px overflow-hidden opacity-0" data-paywall-focus-sentinel tabIndex={0} onFocus={() => (getControls(dialogRef.current)[0] ?? dialogRef.current)?.focus()} />
      </section>
    </div>,
    document.body,
  )
}
