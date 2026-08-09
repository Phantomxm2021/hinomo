import { useEffect, useId, useRef } from 'react'
import { useMobileFeedback, type FeedbackErrorOptions } from './mobile-feedback'
import { useI18n } from '../i18n/I18nProvider'
import { classifyFeedbackError } from '../lib/feedback-errors'

type ResponsiveOperationErrorProps = {
  message: string
  onRetry?: () => void
  busy?: boolean
  retryLabel?: string
  cancelLabel?: string
  onCancel?: () => void | Promise<void>
  onActionError?: (error: unknown) => void
  error?: unknown
}

export function ResponsiveOperationError({ message, onRetry, busy = false, retryLabel, cancelLabel, onCancel, onActionError, error }: ResponsiveOperationErrorProps) {
  const feedback = useMobileFeedback()
  const { t } = useI18n()
  const owner = useId()
  const retryRef = useRef(onRetry)
  const dismissedRef = useRef(false)
  const previousMessageRef = useRef(message)
  const classification = error === undefined ? null : classifyFeedbackError(error)
  const title = classification ? t(classification.titleKey) : message
  const description = classification ? `${message} ${t(classification.messageKey)}` : undefined
  const canRetry = Boolean(onRetry) && (classification?.retryable ?? true)

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
      retry: canRetry ? () => { if (!busy) retryRef.current?.() } : undefined,
      retryLabel,
      retrying: busy,
      cancelLabel,
      onCancel,
      onActionError,
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
      cancelLabel: options.cancelLabel,
      onCancel: options.onCancel,
      onActionError: options.onActionError,
      onDismiss: options.onDismiss,
      primaryDisabled: options.retrying,
      primaryBusy: options.retrying,
    })
  }, [busy, canRetry, cancelLabel, description, feedback, message, onActionError, onCancel, onRetry, owner, retryLabel, title])

  useEffect(() => () => feedback.dismiss(owner), [feedback, owner])

  return null
}
