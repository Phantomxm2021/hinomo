import { useEffect, useId, useRef } from 'react'
import { useMobileFeedback, type FeedbackErrorOptions } from './mobile-feedback'
import { useI18n } from '../i18n/I18nProvider'
import { classifyFeedbackError } from '../lib/feedback-errors'

type ResponsiveOperationErrorProps = {
  message: string
  onRetry?: () => void
  busy?: boolean
  retryLabel?: string
  error?: unknown
}

export function ResponsiveOperationError({ message, onRetry, busy = false, retryLabel, error }: ResponsiveOperationErrorProps) {
  const feedback = useMobileFeedback()
  const { t } = useI18n()
  const owner = useId()
  const retryRef = useRef(onRetry)
  const dismissedRef = useRef(false)
  const previousMessageRef = useRef(message)
  const classification = error === undefined ? null : classifyFeedbackError(error)
  const title = classification ? t(classification.titleKey) : message
  const description = classification ? t(classification.messageKey) : undefined

  useEffect(() => {
    retryRef.current = onRetry
  }, [onRetry])

  useEffect(() => {
    if (previousMessageRef.current !== message) {
      previousMessageRef.current = message
      dismissedRef.current = false
    }
    if (dismissedRef.current) return
    const options: FeedbackErrorOptions = {
      key: `responsive-operation-error:${message}`,
      owner,
      title,
      message: description,
      retry: onRetry ? () => { if (!busy) retryRef.current?.() } : undefined,
      retryLabel,
      retrying: busy,
      onDismiss: (reason) => { dismissedRef.current = reason === undefined || reason === 'cancel' || reason === 'escape' },
    }
    if (typeof feedback.error === 'function') {
      feedback.error(options)
      return
    }
    // Older embedders supplied the pre-`error` feedback API. Keep the adapter
    // safe during that transition while the application provider uses `error`.
    feedback.showAlert({
      key: options.key,
      owner: options.owner,
      title: options.title,
      message: options.message,
      primaryLabel: options.retry ? options.retryLabel : undefined,
      onPrimary: options.retry,
      onDismiss: options.onDismiss,
      primaryDisabled: options.retrying,
      primaryBusy: options.retrying,
    })
  }, [busy, description, feedback, message, onRetry, owner, retryLabel, title])

  useEffect(() => () => feedback.dismiss(owner), [feedback, owner])

  return null
}
