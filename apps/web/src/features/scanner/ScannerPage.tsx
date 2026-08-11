import type { IScannerControls } from '@zxing/browser'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { useI18n } from '../../i18n/I18nProvider'
import { captureGrowthEvent, firstGrowthOccurrence } from '../../lib/analytics'
import { parseNomoBoxPath } from './scanner-url'

type CameraErrorKey = 'scanner.secureContext' | 'scanner.permissionDenied' | 'scanner.noCamera' | 'scanner.cameraStartFailed'

export function ScannerPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const feedback = useMobileFeedback()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const handledRef = useRef(false)
  const [cameraMessage, setCameraMessage] = useState<CameraErrorKey | null>(null)

  useEffect(() => {
    const hostname = window.location.hostname
    const local = hostname === 'localhost' || hostname === '127.0.0.1'
    if (window.isSecureContext === false && !local) {
      setCameraMessage('scanner.secureContext')
      return
    }

    let cancelled = false
    let attemptControls: IScannerControls | null = null
    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' } } },
          videoRef.current ?? undefined,
          (result, _error, scanControls) => {
            if (cancelled || !result || handledRef.current) return
            const path = parseNomoBoxPath(result.getText())
            if (!path) {
              feedback.notify(t('scanner.invalidQr'))
              return
            }
            handledRef.current = true
            scanControls.stop()
            captureGrowthEvent('qr_scanned', { destination: 'box', first: firstGrowthOccurrence('qr_scanned') })
            navigate(path)
          },
        )
        attemptControls = controls
        if (cancelled) controls.stop()
        else {
          controlsRef.current = controls
        }
      } catch (error: unknown) {
        if (cancelled) return
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setCameraMessage('scanner.permissionDenied')
        } else if (error instanceof DOMException && error.name === 'NotFoundError') {
          setCameraMessage('scanner.noCamera')
        } else {
          setCameraMessage('scanner.cameraStartFailed')
        }
      }
    }
    void startScanner()

    return () => {
      cancelled = true
      if (attemptControls && controlsRef.current === attemptControls) {
        attemptControls.stop()
        controlsRef.current = null
      }
    }
  }, [feedback, navigate, t])

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-4xl gap-5 lg:gap-6" aria-labelledby="scanner-title">
      <header className="py-3">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">{t('scanner.eyebrow')}</p>
        <h1 className="m-0 text-page-title font-extrabold text-ink" id="scanner-title">{t('scanner.heading')}</h1>
      </header>
      <div className="scanner-camera relative overflow-hidden rounded-shell bg-ink shadow-float">
        <video className="block aspect-[4/5] max-h-[65dvh] w-full overflow-hidden rounded-shell bg-ink object-cover md:aspect-video" ref={videoRef} muted playsInline aria-label={t('scanner.videoLabel')} />
        {!cameraMessage ? (
          <div className="scanner-feedback pointer-events-none absolute inset-0" data-testid="scanner-feedback" aria-hidden="true">
            <span className="scanner-vignette absolute inset-0" />
            <span className="scanner-target absolute top-1/2 left-1/2 aspect-square w-[min(68%,19rem)] -translate-x-1/2 -translate-y-1/2">
              <span className="scanner-corner scanner-corner-top-left absolute top-0 left-0" />
              <span className="scanner-corner scanner-corner-top-right absolute top-0 right-0" />
              <span className="scanner-corner scanner-corner-bottom-left absolute bottom-0 left-0" />
              <span className="scanner-corner scanner-corner-bottom-right absolute right-0 bottom-0" />
              <span className="scanner-beam absolute right-[4%] left-[4%] h-px" />
              <span className="scanner-focus-dot absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            </span>
          </div>
        ) : null}
      </div>
      {cameraMessage ? <ResponsiveOperationError message={t(cameraMessage)} /> : null}
    </section>
  )
}
