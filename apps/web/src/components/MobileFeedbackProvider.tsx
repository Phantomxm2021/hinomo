import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { MobileActionSheet } from './MobileActionSheet'
import { AppleAlert } from './AppleAlert'
import { MobileFeedbackContext, type MobileAlertOptions, type MobileFeedbackApi, type MobileSheetOptions } from './mobile-feedback'
import { SYSTEM_NOTICE_Z_INDEX } from './overlay-layers'
import { useI18n } from '../i18n/I18nProvider'

export function MobileFeedbackProvider({ children }: PropsWithChildren) {
  const { t } = useI18n()
  const [notice, setNotice] = useState<string | null>(null)
  const [alert, setAlert] = useState<(MobileAlertOptions & { key?: string }) | null>(null)
  const [sheet, setSheet] = useState<MobileSheetOptions | null>(null)
  const dismiss = useCallback(() => {
    setNotice(null)
    setAlert(null)
    setSheet(null)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const showAlert = useCallback((options: MobileAlertOptions & { key?: string }) => {
    setNotice(null)
    setSheet(null)
    setAlert(options)
  }, [])
  const api = useMemo<MobileFeedbackApi>(() => ({
    notify: (message) => { setAlert(null); setSheet(null); setNotice(message) },
    showAlert,
    showActionSheet: (options) => { setNotice(null); setAlert(null); setSheet(options) },
    error: (options) => {
      showAlert({
        key: options.key,
        title: options.title,
        message: options.message,
        primaryLabel: options.retry ? (options.retrying ? t('common.retrying') : options.retryLabel ?? t('common.retry')) : t('common.ok'),
        onPrimary: options.retry,
        cancelLabel: options.retry ? t('common.cancel') : undefined,
        primaryDisabled: options.retrying,
        primaryBusy: options.retrying,
      })
    },
    confirm: showAlert,
    dismiss,
  }), [dismiss, showAlert, t])

  return (
    <MobileFeedbackContext.Provider value={api}>
      {children}
      {notice ? createPortal(
        <div className="fixed inset-x-4 top-[max(0.75rem,var(--safe-area-top))] isolate flex min-h-11 items-center justify-center rounded-full bg-ink/92 px-4 py-2 text-center text-sm font-semibold text-white shadow-float backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:max-w-md" style={{ zIndex: SYSTEM_NOTICE_Z_INDEX }} role="status" aria-label={notice} aria-live="polite">
          {notice}
        </div>,
        document.body,
      ) : null}
      <AppleAlert open={Boolean(alert)} title={alert?.title ?? ''} message={alert?.message} primaryLabel={alert?.primaryLabel} onPrimary={alert?.onPrimary} cancelLabel={alert?.cancelLabel} onCancel={alert?.onCancel} primaryDisabled={alert?.primaryDisabled} primaryBusy={alert?.primaryBusy} onClose={dismiss} />
      <MobileActionSheet open={Boolean(sheet)} title={sheet?.title ?? ''} message={sheet?.message} actions={sheet?.actions ?? []} cancelLabel={sheet?.cancelLabel} onClose={dismiss} />
    </MobileFeedbackContext.Provider>
  )
}
