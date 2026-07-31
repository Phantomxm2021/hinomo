import { useEffect, useRef } from 'react'
import { useMobileFeedback } from './mobile-feedback'

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

  return (
    <div className="hidden flex-wrap items-center justify-between gap-3 rounded-control border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger lg:flex" role="alert">
      <h2 className="m-0 text-sm font-semibold tracking-normal text-danger">{message}</h2>
      {onRetry ? (
        <button className="min-h-11 rounded-control border border-danger/30 bg-surface px-4 py-2 font-bold" type="button" disabled={busy} aria-busy={busy} onClick={onRetry}>
          {busy ? '重试中…' : retryLabel}
        </button>
      ) : null}
    </div>
  )
}
