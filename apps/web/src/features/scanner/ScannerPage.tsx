import type { IScannerControls } from '@zxing/browser'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { useMobileFeedback } from '../../components/mobile-feedback'
import { parseNomoBoxPath } from './scanner-url'

export function ScannerPage() {
  const navigate = useNavigate()
  const feedback = useMobileFeedback()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const handledRef = useRef(false)
  const [cameraMessage, setCameraMessage] = useState<string | null>(null)

  useEffect(() => {
    const hostname = window.location.hostname
    const local = hostname === 'localhost' || hostname === '127.0.0.1'
    if (window.isSecureContext === false && !local) {
      setCameraMessage('当前页面不是 HTTPS，无法使用相机')
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
              feedback.notify('未识别到有效的 Nomo 箱子二维码，请继续扫描')
              return
            }
            handledRef.current = true
            scanControls.stop()
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
          setCameraMessage('相机权限被拒绝，请在浏览器站点设置中允许相机')
        } else if (error instanceof DOMException && error.name === 'NotFoundError') {
          setCameraMessage('没有找到可用的相机')
        } else {
          setCameraMessage('相机启动失败，请检查浏览器设置后重新进入扫码页')
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
  }, [feedback, navigate])

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-4xl gap-5 lg:gap-6" aria-labelledby="scanner-title">
      <header className="py-3">
        <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">对准箱子上的二维码</p>
        <h1 className="m-0 text-page-title font-extrabold text-ink" id="scanner-title">扫码查看</h1>
      </header>
      <div className="scanner-camera relative overflow-hidden rounded-shell bg-ink shadow-float">
        <video className="block aspect-[4/5] max-h-[65dvh] w-full overflow-hidden rounded-shell bg-ink object-cover md:aspect-video" ref={videoRef} muted playsInline aria-label="二维码扫描画面" />
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
      {cameraMessage ? <ResponsiveOperationError message={cameraMessage} /> : null}
    </section>
  )
}
