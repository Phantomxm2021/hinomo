import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../components/AppIcon'
import { BoxForm } from './BoxForm'
import type { CreatedBox } from './boxes.api'

function controls(dialog: HTMLElement | null) {
  if (!dialog) return []
  return Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
  ))
}

export function CreateBoxModal({
  open,
  onClose,
  onCreated,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onCreated: (box: CreatedBox) => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    if (!busy) onClose()
  }, [busy, onClose])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close, open])

  useEffect(() => {
    if (!open) return
    const appShell = document.querySelector<HTMLElement>('[data-app-shell]')
    const previousAriaHidden = appShell?.getAttribute('aria-hidden') ?? null
    const hadInert = appShell?.hasAttribute('inert') ?? false
    const previousOverflow = document.body.style.overflow
    appShell?.setAttribute('inert', '')
    appShell?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = 'hidden'

    const focusFrame = window.requestAnimationFrame(() => {
      const firstField = dialogRef.current?.querySelector<HTMLElement>('select:not(:disabled), input:not(:disabled), textarea:not(:disabled)')
      firstField?.focus()
    })

    return () => {
      window.cancelAnimationFrame(focusFrame)
      if (appShell) {
        if (!hadInert) appShell.removeAttribute('inert')
        if (previousAriaHidden === null) appShell.removeAttribute('aria-hidden')
        else appShell.setAttribute('aria-hidden', previousAriaHidden)
      }
      document.body.style.overflow = previousOverflow
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section
        ref={dialogRef}
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-shell border border-line bg-canvas p-5 shadow-float sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby="create-box-modal-title"
      >
        <span className="pointer-events-none fixed size-px overflow-hidden opacity-0" tabIndex={0} onFocus={() => controls(dialogRef.current).at(-1)?.focus()} />
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-section-title font-bold" id="create-box-modal-title">创建箱子</h2>
          <button className="grid size-11 flex-none place-items-center rounded-control border border-line bg-surface text-ink" type="button" aria-label="关闭创建箱子" disabled={busy} onClick={close}>
            <AppIcon name="close" />
          </button>
        </div>
        <BoxForm presentation="modal" onBusyChange={setBusy} onCreated={onCreated} onDone={onDone} />
        <span className="pointer-events-none fixed size-px overflow-hidden opacity-0" tabIndex={0} onFocus={() => controls(dialogRef.current)[0]?.focus()} />
      </section>
    </div>,
    document.body,
  )
}
