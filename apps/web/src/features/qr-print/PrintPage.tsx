import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../../components/AppIcon'
import { PageState } from '../../components/PageState'
import { ResponsiveOperationError } from '../../components/ResponsiveOperationError'
import { Skeleton, SkeletonGroup } from '../../components/Skeleton'
import { env } from '../../lib/env'
import { listBoxes, type BoxSummary } from '../boxes/boxes.api'
import { buildLabels, renderLabelsPdf } from './pdf'
import { PrintBoxSelector } from './PrintBoxSelector'
import { filterPrintBoxes, selectedPrintBoxes, toggleVisibleSelection } from './print-model'
import { PrintSheetPreview } from './PrintSheetPreview'

const EMPTY_BOXES: BoxSummary[] = []
const DESKTOP_MEDIA_QUERY = '(min-width: 64rem)'

function subscribeDesktopViewport(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

function getDesktopViewportSnapshot() {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

function getServerDesktopViewportSnapshot() {
  return false
}

export function PrintPage() {
  const boxesQuery = useQuery({ queryKey: ['boxes'], queryFn: listBoxes })
  const mounted = useRef(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [mobileSelectedId, setMobileSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null)
  const [error, setError] = useState(false)
  const [generating, setGenerating] = useState(false)
  const isDesktopViewport = useSyncExternalStore(
    subscribeDesktopViewport,
    getDesktopViewportSnapshot,
    getServerDesktopViewportSnapshot,
  )
  const allBoxes = useMemo(() => boxesQuery.data ?? EMPTY_BOXES, [boxesQuery.data])
  const visibleBoxes = useMemo(() => filterPrintBoxes(allBoxes, query), [allBoxes, query])
  const selectedBoxes = useMemo(() => selectedPrintBoxes(allBoxes, selected), [allBoxes, selected])
  const effectiveSelected = useMemo(
    () => new Set(selectedBoxes.map((box) => box.id)),
    [selectedBoxes],
  )
  const mobileBox = useMemo(
    () => allBoxes.find((box) => box.id === mobileSelectedId) ?? null,
    [allBoxes, mobileSelectedId],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (boxesQuery.data === undefined) return
    const validIds = new Set(boxesQuery.data.map((box) => box.id))
    setSelected((current) => {
      const next = new Set([...current].filter((id) => validIds.has(id)))
      return next.size === current.size ? current : next
    })
    setMobileSelectedId((current) => current && !validIds.has(current) ? '' : current)
  }, [boxesQuery.data])

  function toggle(boxId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(boxId)) next.delete(boxId)
      else next.add(boxId)
      return next
    })
  }

  async function generate(boxes: BoxSummary[]) {
    if (boxes.length === 0 || generating) return
    setGenerating(true)
    setError(false)
    setProgress({ completed: 0, total: boxes.length })
    try {
      await renderLabelsPdf(
        buildLabels(boxes, env.VITE_PUBLIC_APP_ORIGIN),
        (completed, total) => {
          if (mounted.current) setProgress({ completed, total })
        },
      )
    } catch {
      if (mounted.current) setError(true)
    } finally {
      if (mounted.current) setGenerating(false)
    }
  }

  const content = boxesQuery.isPending && boxesQuery.data === undefined ? (
    <SkeletonGroup className="grid min-w-0 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]" label="正在加载打印工作台">
      <div className="grid content-start gap-4 rounded-card border border-line bg-surface p-4">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-11 w-full" />
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex items-center gap-3" key={index}><Skeleton className="size-5" /><Skeleton className="h-12 flex-1" /></div>
        ))}
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="min-w-0 rounded-card border border-line bg-surface p-5">
        <Skeleton className="mx-auto aspect-[210/297] w-full max-w-[42rem] rounded-none" />
      </div>
    </SkeletonGroup>
  ) : boxesQuery.isError && boxesQuery.data === undefined ? (
    <PageState state="error" message="箱子加载失败，请重试" onRetry={() => void boxesQuery.refetch()} />
  ) : allBoxes.length === 0 ? (
    <PageState
      state="empty"
      title="请先创建箱子"
      action={(
        <Link className="min-h-11 rounded-control bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong" to="/app/boxes">
          查看全部箱子
        </Link>
      )}
    />
  ) : (
    <>
      <section
        className="hidden min-w-0 gap-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]"
        aria-label="批量标签工作台"
      >
        <div className="min-w-0">
          <PrintBoxSelector
            boxes={visibleBoxes}
            totalCount={allBoxes.length}
            selected={effectiveSelected}
            query={query}
            generating={generating}
            onQueryChange={setQuery}
            onToggle={toggle}
            onToggleVisible={() => setSelected((current) => toggleVisibleSelection(
              current,
              visibleBoxes.map((box) => box.id),
            ))}
            onDownload={() => void generate(selectedBoxes)}
          />
        </div>
        <div className="min-w-0">
          {isDesktopViewport ? <PrintSheetPreview boxes={selectedBoxes} mode="a4" /> : null}
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-4 lg:hidden" aria-label="单个标签下载">
        <h2 className="m-0 text-section-title font-bold text-ink">选择一个箱子</h2>
        <div className="grid min-w-0 gap-2">
          {allBoxes.map((box) => {
            const checked = mobileSelectedId === box.id
            const location = box.location || '未填写位置'
            return (
              <label
                className={`grid min-h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-control border px-3 py-2 ${checked ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
                key={box.id}
              >
                <input
                  className="size-5 accent-brand focus-visible:ring-2 focus-visible:ring-brand/30"
                  type="radio"
                  name="mobile-label"
                  checked={checked}
                  onChange={() => setMobileSelectedId(box.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{box.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{box.box_code} · {box.space_name} · {location}</span>
                </span>
              </label>
            )
          })}
        </div>
        {!isDesktopViewport && mobileBox ? (
          <PrintSheetPreview boxes={[mobileBox]} mode="single" />
        ) : !mobileBox ? (
          <p className="rounded-card border border-dashed border-line bg-surface/70 p-6 text-center text-sm text-muted">
            选择一个箱子查看标签预览
          </p>
        ) : null}
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-muted focus-visible:ring-2 focus-visible:ring-brand/30"
          type="button"
          disabled={!mobileBox || generating}
          onClick={() => mobileBox ? void generate([mobileBox]) : undefined}
        >
          <AppIcon name="print" />
          {generating ? '生成中…' : '下载单个标签'}
        </button>
      </section>
    </>
  )

  return (
    <section className="mx-auto flex min-w-0 w-full max-w-7xl flex-col gap-5 lg:gap-8" aria-labelledby="print-title">
      <header className="flex flex-col gap-2 py-3 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <p className="mb-1 hidden text-meta font-medium tracking-eyebrow text-muted lg:block">打印中心</p>
          <h1 className="m-0 text-page-title font-extrabold text-ink" id="print-title">
            <span className="lg:hidden">下载箱子标签</span>
            <span className="hidden lg:inline">打印二维码标签</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            <span className="lg:hidden">移动设备每次处理一张标签</span>
            <span className="hidden lg:block">选择箱子，预览 A4 排版并下载可打印 PDF</span>
          </p>
        </div>
        <p className="hidden shrink-0 text-sm font-semibold text-muted lg:block">
          A4 · 双列 · 已选 {selectedBoxes.length} 张
        </p>
      </header>

      {boxesQuery.isError && boxesQuery.data !== undefined ? (
        <ResponsiveOperationError message="箱子列表刷新失败，正在显示上次结果" busy={boxesQuery.isFetching} onRetry={() => void boxesQuery.refetch()} />
      ) : null}
      {content}
      {progress ? (
        <p className="hidden text-sm text-muted lg:block" role="status" aria-label={`二维码渲染进度：${progress.completed}/${progress.total}`}>
          二维码渲染进度：{progress.completed}/{progress.total}
        </p>
      ) : null}
      {error ? <ResponsiveOperationError message="PDF 生成失败，请重试" onRetry={() => void generate(isDesktopViewport ? selectedBoxes : mobileBox ? [mobileBox] : [])} /> : null}
    </section>
  )
}
