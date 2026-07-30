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
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState(false)

  useEffect(() => {
    const hostname = window.location.hostname
    const local = hostname === 'localhost' || hostname === '127.0.0.1'
    if (window.isSecureContext === false && !local) {
      setCameraMessage('当前页面不是 HTTPS，无法使用相机')
      return
    }

    let cancelled = false
    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' } } },
          videoRef.current ?? undefined,
          (result, _error, scanControls) => {
            if (!result || handledRef.current) return
            const path = parseNomoBoxPath(result.getText())
            if (!path) {
              setCameraMessage('识别到的二维码不是有效的 Nomo 箱子地址')
              return
            }
            handledRef.current = true
            scanControls.stop()
            navigate(path)
          },
        )
        if (cancelled) controls.stop()
        else controlsRef.current = controls
      } catch (error: unknown) {
        if (cancelled) return
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setCameraMessage('相机权限被拒绝')
        } else if (error instanceof DOMException && error.name === 'NotFoundError') {
          setCameraMessage('没有找到可用的相机')
        } else {
          setCameraMessage('相机启动失败，请使用手动输入')
        }
      }
    }
    void startScanner()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [navigate])

  function openManualAddress() {
    const path = parseNomoBoxPath(manualValue)
    if (!path) {
      setManualError(true)
      return
    }
    setManualError(false)
    controlsRef.current?.stop()
    navigate(path)
  }

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6" aria-labelledby="scanner-title">
      <header className="py-3">
        <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">对准箱子上的二维码</p>
        <h1 className="m-0 text-2xl font-black tracking-tight text-ink md:text-4xl" id="scanner-title">扫码查看</h1>
      </header>
      <video className="block min-h-70 max-h-[65dvh] w-full rounded-shell bg-ink object-cover shadow-float" ref={videoRef} muted playsInline aria-label="二维码扫描画面" />
      {cameraMessage ? <p role="status">{cameraMessage}</p> : null}
      <div className="grid gap-3 rounded-shell border border-line bg-surface p-5 md:p-6">
        <label className="font-bold text-ink" htmlFor="manual-qr-url">手动输入二维码地址</label>
        <input
          className="min-h-12 w-full rounded-control border border-line bg-canvas px-3 text-ink focus:border-brand"
          id="manual-qr-url"
          type="url"
          inputMode="url"
          value={manualValue}
          aria-invalid={manualError}
          aria-describedby={manualError ? 'manual-qr-url-error' : undefined}
          onChange={(event) => { setManualValue(event.target.value); setManualError(false) }}
        />
        {manualError ? <p id="manual-qr-url-error" role="alert">不是有效的 Nomo 箱子地址</p> : null}
        <button className="min-h-11 rounded-control border border-brand bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong" type="button" onClick={openManualAddress}>打开箱子</button>
      </div>
    </section>
  )
}
