import { useEffect, useMemo, useRef, useState } from 'react'
import { env } from '../../lib/env'
import type { BoxSummary } from '../boxes/boxes.api'
import { paginatePrintBoxes } from './print-model'
import { boxQrPng, boxQrUrl } from './qr'

type Props = {
  boxes: readonly BoxSummary[]
  mode: 'a4' | 'single'
}

type QrState =
  | { status: 'loading' }
  | { status: 'ready'; image: string }
  | { status: 'error' }

function qrIdentity(box: BoxSummary): string {
  return JSON.stringify([box.id, box.public_id])
}

function PrintLabel({ box, qr }: { box: BoxSummary; qr: QrState }) {
  const location = box.location || '未填写位置'

  return (
    <article
      className="min-w-0 overflow-hidden border border-line bg-surface p-3"
      role="group"
      aria-label={`${box.name}标签`}
    >
      <div className="grid min-w-0 grid-cols-[minmax(4.5rem,0.8fr)_minmax(0,1.2fr)] items-center gap-3">
        <div className="grid aspect-square min-w-0 place-items-center overflow-hidden bg-canvas p-2 text-center text-xs text-muted">
          {qr.status === 'ready' ? (
            <img className="size-full object-contain" src={qr.image} alt={`${box.name}二维码`} />
          ) : qr.status === 'error' ? (
            <span>二维码预览生成失败</span>
          ) : (
            <span>正在生成二维码…</span>
          )}
        </div>
        <div className="min-w-0 overflow-hidden">
          <h3 className="truncate text-base font-bold text-ink">{box.name}</h3>
          <p className="mt-1 truncate text-sm font-semibold tracking-wide text-ink">{box.box_code}</p>
          <p className="mt-1 truncate text-xs text-muted">{box.space_name} · {location}</p>
          <p className="mt-2 truncate text-xs font-semibold text-brand">扫码查看箱内物品</p>
        </div>
      </div>
    </article>
  )
}

export function PrintSheetPreview({ boxes, mode }: Props) {
  const qrCache = useRef(new Map<string, QrState>())
  const visibleIdentities = useRef(new Set<string>())
  const mounted = useRef(false)
  const [, setRevision] = useState(0)
  const visibleBoxes = useMemo(
    () => mode === 'single' ? boxes.slice(0, 1) : boxes,
    [boxes, mode],
  )
  const currentIdentities = useMemo(
    () => new Set(visibleBoxes.map(qrIdentity)),
    [visibleBoxes],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      visibleIdentities.current = new Set()
    }
  }, [])

  useEffect(() => {
    visibleIdentities.current = currentIdentities
    for (const identity of qrCache.current.keys()) {
      if (!currentIdentities.has(identity)) qrCache.current.delete(identity)
    }

    for (const box of visibleBoxes) {
      const identity = qrIdentity(box)
      if (qrCache.current.has(identity)) continue

      const loading: QrState = { status: 'loading' }
      qrCache.current.set(identity, loading)
      const url = boxQrUrl(env.VITE_PUBLIC_APP_ORIGIN, box.public_id)

      void boxQrPng(url)
        .then((image) => {
          if (!visibleIdentities.current.has(identity) || qrCache.current.get(identity) !== loading) return
          qrCache.current.set(identity, { status: 'ready', image })
          if (mounted.current) setRevision((revision) => revision + 1)
        })
        .catch(() => {
          if (!visibleIdentities.current.has(identity) || qrCache.current.get(identity) !== loading) return
          qrCache.current.set(identity, { status: 'error' })
          if (mounted.current) setRevision((revision) => revision + 1)
        })
    }
  }, [currentIdentities, visibleBoxes])

  if (mode === 'single') {
    const box = boxes[0]
    if (!box) return null

    return (
      <section className="min-w-0 overflow-hidden rounded-card border border-line bg-surface" aria-label="单个标签预览">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-lg font-bold text-ink">单个标签预览</h2>
        </header>
        <div className="min-w-0 overflow-auto bg-canvas p-4">
          <PrintLabel box={box} qr={qrCache.current.get(qrIdentity(box)) ?? { status: 'loading' }} />
        </div>
      </section>
    )
  }

  const pages = paginatePrintBoxes(boxes)

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface" aria-label="A4 标签预览">
      <header className="flex min-w-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="min-w-0 truncate text-lg font-bold text-ink">A4 标签预览</h2>
        <p className="shrink-0 text-sm text-muted">共 {pages.length} 页 · {boxes.length} 张标签</p>
      </header>
      <div className="max-h-[70dvh] min-h-0 overflow-auto bg-canvas p-3 sm:p-5">
        {pages.length === 0 ? (
          <div
            className="mx-auto grid aspect-[210/297] w-full max-w-[42rem] place-items-center border border-line bg-surface p-6 text-center text-sm text-muted shadow-soft"
            data-testid="a4-sheet"
          >
            选择箱子后将在这里生成 A4 预览
          </div>
        ) : (
          <div className="grid w-full gap-5">
            {pages.map((page, pageIndex) => (
              <div
                className="mx-auto grid aspect-[210/297] w-full max-w-[42rem] grid-cols-2 grid-rows-4 gap-px overflow-hidden border border-line bg-surface p-px shadow-soft"
                data-testid="a4-sheet"
                key={pageIndex}
              >
                {page.map((box) => (
                  <PrintLabel
                    box={box}
                    key={qrIdentity(box)}
                    qr={qrCache.current.get(qrIdentity(box)) ?? { status: 'loading' }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
