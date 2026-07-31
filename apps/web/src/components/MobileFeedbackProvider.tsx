import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { MobileActionSheet } from './MobileActionSheet'
import { MobileAlert } from './MobileAlert'
import { MobileFeedbackContext, type MobileAlertOptions, type MobileFeedbackApi, type MobileSheetOptions } from './mobile-feedback'

export function MobileFeedbackProvider({ children }: PropsWithChildren) {
  const [notice, setNotice] = useState<string | null>(null)
  const [alert, setAlert] = useState<MobileAlertOptions | null>(null)
  const [sheet, setSheet] = useState<MobileSheetOptions | null>(null)
  const dismiss = useCallback(() => {
    setNotice(null)
    setAlert(null)
    setSheet(null)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  const api = useMemo<MobileFeedbackApi>(() => ({
    notify: (message) => { setAlert(null); setSheet(null); setNotice(message) },
    showAlert: (options) => { setNotice(null); setSheet(null); setAlert(options) },
    showActionSheet: (options) => { setNotice(null); setAlert(null); setSheet(options) },
    dismiss,
  }), [dismiss])

  return (
    <MobileFeedbackContext.Provider value={api}>
      {children}
      {notice ? createPortal(
        <div className="fixed inset-x-4 top-[max(0.75rem,var(--safe-area-top))] z-[105] flex min-h-11 items-center justify-center rounded-full bg-ink/92 px-4 py-2 text-center text-sm font-semibold text-white shadow-float backdrop-blur-xl lg:hidden" role="status" aria-live="polite">
          {notice}
        </div>,
        document.body,
      ) : null}
      <MobileAlert open={Boolean(alert)} title={alert?.title ?? ''} message={alert?.message} primaryLabel={alert?.primaryLabel} onPrimary={alert?.onPrimary} cancelLabel={alert?.cancelLabel} onClose={dismiss} />
      <MobileActionSheet open={Boolean(sheet)} title={sheet?.title ?? ''} message={sheet?.message} actions={sheet?.actions ?? []} cancelLabel={sheet?.cancelLabel} onClose={dismiss} />
    </MobileFeedbackContext.Provider>
  )
}
