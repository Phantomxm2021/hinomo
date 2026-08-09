import { useEffect, useRef } from 'react'
import { useMobileFeedback } from './mobile-feedback'

type ResponsiveOperationErrorProps = {
  message: string
  onRetry?: () => void
  busy?: boolean
  retryLabel?: string
}

export function ResponsiveOperationError({ message, onRetry, busy = false, retryLabel }: ResponsiveOperationErrorProps) {
  const feedback = useMobileFeedback()
  const retryRef = useRef(onRetry)

  useEffect(() => {
    retryRef.current = onRetry
  }, [onRetry])

  useEffect(() => {
    feedback.error({
      key: `responsive-operation-error:${message}`,
      title: message,
      retry: onRetry ? () => { if (!busy) retryRef.current?.() } : undefined,
      retryLabel,
      retrying: busy,
    })
  }, [busy, feedback, message, onRetry, retryLabel])

  return null
}
