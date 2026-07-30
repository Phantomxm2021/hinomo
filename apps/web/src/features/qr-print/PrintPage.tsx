import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { env } from '../../lib/env'
import { listBoxes } from '../boxes/boxes.api'
import { buildLabels, renderLabelsPdf } from './pdf'
import { boxQrPng, boxQrUrl } from './qr'

export function PrintPage() {
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [mobileSelectedId, setMobileSelectedId] = useState('')
  const [previewQr, setPreviewQr] = useState<{ boxId: string; src: string } | null>(null)
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [error, setError] = useState(false)
  const [generating, setGenerating] = useState(false)
  const selectedBox = useMemo(
    () => boxesQuery.data?.find((box) => selected.has(box.id)) ?? null,
    [boxesQuery.data, selected],
  )

  useEffect(() => {
    let active = true
    setPreviewQr(null)
    if (!selectedBox) {
      return
    }
    const qrUrl = boxQrUrl(env.VITE_PUBLIC_APP_ORIGIN, selectedBox.public_id)
    void boxQrPng(qrUrl).then((image) => {
      if (active) setPreviewQr({ boxId: selectedBox.id, src: image })
    }).catch(() => {
      if (active) setPreviewQr(null)
    })
    return () => { active = false }
  }, [selectedBox])

  function toggle(boxId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(boxId)) next.delete(boxId)
      else next.add(boxId)
      return next
    })
  }

  async function generate(boxIds: Set<string>) {
    const boxes = boxesQuery.data?.filter((box) => boxIds.has(box.id)) ?? []
    if (boxes.length === 0) return
    setGenerating(true)
    setError(false)
    setProgress({ completed: 0, total: boxes.length })
    try {
      await renderLabelsPdf(
        buildLabels(boxes, env.VITE_PUBLIC_APP_ORIGIN),
        (completed, total) => setProgress({ completed, total }),
      )
    } catch {
      setError(true)
    } finally {
      setGenerating(false)
    }
  }

  const option = (box: NonNullable<typeof boxesQuery.data>[number], mode: 'desktop' | 'mobile') => (
    <label className="flex min-h-18 cursor-pointer items-center gap-3 rounded-control border border-line bg-surface px-4 py-3 hover:border-brand/40" key={box.id}>
      <input
        className="size-5 accent-brand"
        type={mode === 'desktop' ? 'checkbox' : 'radio'}
        name={mode === 'mobile' ? 'mobile-label' : undefined}
        checked={mode === 'desktop' ? selected.has(box.id) : mobileSelectedId === box.id}
        onChange={() => mode === 'desktop' ? toggle(box.id) : setMobileSelectedId(box.id)}
      />
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-ink">{box.name}</strong>
        <small className="block truncate text-muted">{box.box_code} · {box.space_name}</small>
      </span>
    </label>
  )

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-8" aria-labelledby="print-title">
      <header className="flex flex-col gap-2 py-3">
        <p className="mb-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">整理、预览并下载标签</p>
        <h1 className="mb-0" id="print-title">打印二维码标签</h1>
      </header>
      {boxesQuery.isPending ? <PageState state="loading" label="正在加载箱子…" /> : null}
      {boxesQuery.isError ? <PageState state="error" message="箱子加载失败，请重试" onRetry={() => void boxesQuery.refetch()} /> : null}

      <section className="hidden gap-6 lg:grid lg:grid-cols-[minmax(18rem,0.75fr)_1.25fr]" aria-label="批量标签工作台">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-3"><h2 className="mb-0">选择箱子</h2><span className="text-sm font-bold text-brand">已选择 {selected.size} 个</span></div>
          <div className="grid max-h-[34rem] gap-2 overflow-y-auto pr-1">{boxesQuery.data?.map((box) => option(box, 'desktop'))}</div>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={selected.size === 0 || generating} onClick={() => void generate(selected)}>
            <AppIcon name="print" />{generating ? '生成中…' : '生成 PDF'}
          </button>
        </div>

        <div className="min-h-[32rem] rounded-card border border-line bg-surface p-6">
          <h2>标签预览</h2>
          {selectedBox ? (
            <article className="mx-auto mt-8 grid max-w-2xl grid-cols-[minmax(10rem,0.9fr)_1.1fr] items-center gap-8 rounded-card border-2 border-line bg-surface p-8">
              <div className="aspect-square overflow-hidden rounded-control bg-canvas p-3">
                {previewQr?.boxId === selectedBox.id ? <img className="h-full w-full object-contain" src={previewQr.src} alt="二维码标签预览" /> : <span className="grid h-full place-items-center text-muted">正在生成二维码…</span>}
              </div>
              <div className="min-w-0"><h3 className="mb-3 text-3xl">{selectedBox.name}</h3><p className="mb-2 font-mono text-xl font-bold text-brand">{selectedBox.box_code}</p><p>{selectedBox.space_name} · {selectedBox.location || '未填写位置'}</p><p className="mt-8 text-sm">扫码查看箱内物品</p></div>
            </article>
          ) : (
            <div className="grid min-h-96 place-content-center justify-items-center gap-3 text-center text-muted"><span className="grid size-16 place-items-center rounded-full bg-placeholder"><AppIcon name="print" size={28} /></span><p>选择箱子后，在这里预览标签。</p></div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 lg:hidden" aria-label="单个标签">
        <div><h2 className="mb-1">选择一个箱子</h2><p>移动设备每次下载一张标签。</p></div>
        <div className="grid gap-2">{boxesQuery.data?.map((box) => option(box, 'mobile'))}</div>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-45" type="button" disabled={!mobileSelectedId || generating} onClick={() => void generate(new Set([mobileSelectedId]))}>
          <AppIcon name="print" />{generating ? '生成中…' : '下载单个标签'}
        </button>
      </section>

      {progress ? <p role="status">二维码渲染进度：{progress.completed}/{progress.total}</p> : null}
      {error ? <p role="alert">PDF 生成失败，请重试</p> : null}
    </section>
  )
}
