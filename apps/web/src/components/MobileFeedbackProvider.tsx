import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { MobileActionSheet } from './MobileActionSheet'
import { AppleAlert } from './AppleAlert'
import { MobileFeedbackContext, type MobileAlertOptions, type MobileFeedbackApi, type MobileSheetOptions } from './mobile-feedback'
import { SYSTEM_NOTICE_Z_INDEX } from './overlay-layers'
import { useI18n } from '../i18n/I18nProvider'

export function MobileFeedbackProvider({ children }: PropsWithChildren) {
  const { t } = useI18n()
  const [notice, setNotice] = useState<string | null>(null)
  const [alert, setAlert] = useState<MobileAlertOptions | null>(null)
  const alertRef = useRef<MobileAlertOptions | null>(null)
  const [sheet, setSheet] = useState<MobileSheetOptions | null>(null)
  const updateAlert = useCallback((next: MobileAlertOptions | null) => {
    alertRef.current = next
    setAlert(next)
  }, [])
  const dismiss = useCallback((owner?: string) => {
    const currentAlert = alertRef.current
    if (owner && currentAlert?.owner !== owner) return
    currentAlert?.onDismiss?.()
    updateAlert(null)
    if (owner) return
    setNotice(null)
    setSheet(null)
  }, [updateAlert])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const showAlert = useCallback((options: MobileAlertOptions) => {
    setNotice(null)
    setSheet(null)
    updateAlert(options)
  }, [updateAlert])
  const api = useMemo<MobileFeedbackApi>(() => ({
    notify: (message) => { updateAlert(null); setSheet(null); setNotice(message) },
    showAlert,
    showActionSheet: (options) => { setNotice(null); updateAlert(null); setSheet(options) },
    error: (options) => {
      showAlert({
        key: options.key,
        owner: options.owner,
        title: options.title,
        message: options.message,
        primaryLabel: options.retry ? (options.retrying ? t('common.retrying') : options.retryLabel ?? t('common.retry')) : t('common.ok'),
        onPrimary: options.retry,
        cancelLabel: options.retry ? t('common.cancel') : undefined,
        primaryDisabled: options.retrying,
        primaryBusy: options.retrying,
        onDismiss: options.onDismiss,
        onActionError: () => showAlert({
          key: `${options.key}:action-error`,
          owner: options.owner,
          title: t('common.operationFailed'),
          message: t('common.operationError'),
          onDismiss: options.onDismiss,
          onActionError: options.onActionError,
        }),
      })
    },
    confirm: showAlert,
    dismiss,
  }), [dismiss, showAlert, t, updateAlert])

  return (
    <MobileFeedbackContext.Provider value={api}>
      {children}
      {notice ? createPortal(
        <div className="fixed inset-x-4 top-[max(0.75rem,var(--safe-area-top))] isolate flex min-h-11 items-center justify-center rounded-full bg-ink/92 px-4 py-2 text-center text-sm font-semibold text-white shadow-float backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:max-w-md" style={{ zIndex: SYSTEM_NOTICE_Z_INDEX }} role="status" aria-label={notice} aria-live="polite">
          {notice}
        </div>,
        document.body,
      ) : null}
      <AppleAlert open={Boolean(alert)} title={alert?.title ?? ''} message={alert?.message} primaryLabel={alert?.primaryLabel} onPrimary={alert?.onPrimary} cancelLabel={alert?.cancelLabel} onCancel={alert?.onCancel} primaryDisabled={alert?.primaryDisabled} primaryBusy={alert?.primaryBusy} onActionError={alert?.onActionError} onClose={() => dismiss(alert?.owner)} />
      <MobileActionSheet open={Boolean(sheet)} title={sheet?.title ?? ''} message={sheet?.message} actions={sheet?.actions ?? []} cancelLabel={sheet?.cancelLabel} onClose={dismiss} />
    </MobileFeedbackContext.Provider>
  )
}
