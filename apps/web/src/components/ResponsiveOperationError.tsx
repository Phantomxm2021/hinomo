import { useEffect, useId, useRef } from 'react'
import { useMobileFeedback } from './mobile-feedback'

type ResponsiveOperationErrorProps = {
  message: string
  onRetry?: () => void
  busy?: boolean
  retryLabel?: string
}

export function ResponsiveOperationError({ message, onRetry, busy = false, retryLabel }: ResponsiveOperationErrorProps) {
  const feedback = useMobileFeedback()
  const owner = useId()
  const retryRef = useRef(onRetry)
  const dismissedRef = useRef(false)
  const previousMessageRef = useRef(message)

  useEffect(() => {
    retryRef.current = onRetry
  }, [onRetry])

  useEffect(() => {
    if (previousMessageRef.current !== message) {
      previousMessageRef.current = message
      dismissedRef.current = false
    }
    if (dismissedRef.current) return
    feedback.error({
      key: `responsive-operation-error:${message}`,
      owner,
      title: message,
      retry: onRetry ? () => { if (!busy) retryRef.current?.() } : undefined,
      retryLabel,
      retrying: busy,
      onDismiss: () => { dismissedRef.current = true },
    })
  }, [busy, feedback, message, onRetry, owner, retryLabel])

  useEffect(() => () => feedback.dismiss(owner), [feedback, owner])

  return null
}
