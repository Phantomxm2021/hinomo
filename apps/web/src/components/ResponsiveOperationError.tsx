import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMobileFeedback } from './mobile-feedback'
import { SYSTEM_ALERT_Z_INDEX } from './overlay-layers'

type ResponsiveOperationErrorProps = {
  message: string
  onRetry?: () => void
  busy?: boolean
  retryLabel?: string
}

export function ResponsiveOperationError({ message, onRetry, busy = false, retryLabel = '重试' }: ResponsiveOperationErrorProps) {
  const feedback = useMobileFeedback()
  const retryRef = useRef(onRetry)
  const hasRetry = Boolean(onRetry)
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null)
  const titleId = useId()

  useEffect(() => {
    retryRef.current = onRetry
  }, [onRetry])

  useEffect(() => {
    feedback.showAlert({
      title: message,
      primaryLabel: hasRetry ? retryLabel : '好',
      onPrimary: hasRetry ? () => retryRef.current?.() : undefined,
      cancelLabel: hasRetry ? '取消' : undefined,
    })
  }, [feedback, hasRetry, message, retryLabel])

  if (dismissedMessage === message) return null

  const dismiss = () => {
    setDismissedMessage(message)
    feedback.dismiss()
  }

  return createPortal(
    <div className="fixed inset-0 isolate hidden place-items-center bg-ink/28 p-5 backdrop-blur-[3px] lg:grid" style={{ zIndex: SYSTEM_ALERT_Z_INDEX }} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) dismiss()
    }}>
      <section className="w-full max-w-sm overflow-hidden rounded-[1.6rem] border border-line/80 bg-surface shadow-[0_28px_80px_rgb(48_39_30_/_24%)]" role="alert" aria-labelledby={titleId} aria-live="assertive">
        <div className="px-7 pt-7 pb-6 text-center">
          <span className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-danger/8 text-xl font-black text-danger" aria-hidden="true">!</span>
          <h2 className="m-0 text-lg leading-relaxed font-bold tracking-[-0.02em] text-ink" id={titleId}>{message}</h2>
        </div>
        <div className={`grid border-t border-line/80 ${hasRetry ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasRetry ? (
            <button className="min-h-13 border-0 border-r border-line/80 bg-transparent px-4 font-bold text-muted hover:bg-canvas" type="button" disabled={busy} onClick={dismiss}>取消</button>
          ) : null}
          <button
            className="min-h-13 border-0 bg-transparent px-4 font-bold text-brand-strong hover:bg-brand/5"
            type="button"
            disabled={busy}
            aria-busy={busy}
            onClick={() => {
              if (hasRetry) retryRef.current?.()
              else dismiss()
            }}
          >
            {hasRetry ? (busy ? '重试中…' : retryLabel) : '好'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
