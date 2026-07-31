import type { IScannerControls } from '@zxing/browser'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseNomoBoxPath } from './scanner-url'

export function ScannerPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const handledRef = useRef(false)
  const [cameraMessage, setCameraMessage] = useState<string | null>(null)
  const [cameraCanRetry, setCameraCanRetry] = useState(false)
  const [scannerAttempt, setScannerAttempt] = useState(0)

  useEffect(() => {
    const hostname = window.location.hostname
    const local = hostname === 'localhost' || hostname === '127.0.0.1'
    if (window.isSecureContext === false && !local) {
      setCameraMessage('当前页面不是 HTTPS，无法使用相机')
      setCameraCanRetry(false)
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
              setCameraMessage('识别到的二维码不是有效的 Nomo 箱子地址')
              setCameraCanRetry(false)
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
          setCameraCanRetry(true)
        }
      } catch (error: unknown) {
        if (cancelled) return
        setCameraCanRetry(true)
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setCameraMessage('相机权限被拒绝，请在浏览器站点设置中允许相机后重试')
        } else if (error instanceof DOMException && error.name === 'NotFoundError') {
          setCameraMessage('没有找到可用的相机')
        } else {
          setCameraMessage('相机启动失败，请重新尝试')
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
  }, [navigate, scannerAttempt])

  function retryCamera() {
    handledRef.current = false
    setCameraMessage(null)
    setCameraCanRetry(false)
    controlsRef.current?.stop()
    controlsRef.current = null
    setScannerAttempt((attempt) => attempt + 1)
  }

  return (
    <section className="mx-auto grid min-w-0 w-full max-w-4xl gap-5 lg:gap-6" aria-labelledby="scanner-title">
      <header className="py-3">
        <p className="mb-1 text-meta font-medium tracking-eyebrow text-muted">对准箱子上的二维码</p>
        <h1 className="m-0 text-page-title font-extrabold text-ink" id="scanner-title">扫码查看</h1>
      </header>
      <video className="block aspect-[4/5] max-h-[65dvh] w-full overflow-hidden rounded-shell bg-ink object-cover shadow-float md:aspect-video" ref={videoRef} muted playsInline aria-label="二维码扫描画面" />
      {cameraMessage ? <p role="status">{cameraMessage}</p> : null}
      {cameraCanRetry ? (
        <button className="min-h-12 w-full rounded-control border border-brand bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong sm:min-h-11 sm:w-auto" type="button" onClick={retryCamera}>
          重新尝试相机
        </button>
      ) : null}
    </section>
  )
}
