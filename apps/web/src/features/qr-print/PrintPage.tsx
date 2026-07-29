import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { env } from '../../lib/env'
import { listBoxes } from '../boxes/boxes.api'
import { buildLabels, renderLabelsPdf } from './pdf'

export function PrintPage() {
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [error, setError] = useState(false)
  const [generating, setGenerating] = useState(false)

  function toggle(boxId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(boxId)) next.delete(boxId)
      else next.add(boxId)
      return next
    })
  }

  async function generate() {
    const boxes = boxesQuery.data?.filter((box) => selected.has(box.id)) ?? []
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

  return (
    <section className="page-stack" aria-labelledby="print-title">
      <header className="page-heading">
        <p className="eyebrow">A4 每页 8 张标签</p>
        <h1 id="print-title">批量打印二维码</h1>
      </header>
      {boxesQuery.isPending ? <p role="status">正在加载箱子…</p> : null}
      {boxesQuery.isError ? <p role="alert">箱子加载失败，请重试</p> : null}
      <div className="card-grid">
        {boxesQuery.data?.map((box) => (
          <label className="panel print-option" key={box.id}>
            <input
              type="checkbox"
              checked={selected.has(box.id)}
              onChange={() => toggle(box.id)}
            />
            <span><strong>{box.name}</strong><small>{box.box_code} · {box.space_name}</small></span>
          </label>
        ))}
      </div>
      {progress ? <p role="status">二维码渲染进度：{progress.completed}/{progress.total}</p> : null}
      {error ? <p role="alert">PDF 生成失败，请重试</p> : null}
      <button type="button" disabled={selected.size === 0 || generating} onClick={() => void generate()}>
        {generating ? '生成中…' : '生成 PDF'}
      </button>
    </section>
  )
}
