import type { ChangeEvent } from 'react'
import { AppIcon } from '../../components/AppIcon'
import type { BoxSummary } from '../boxes/boxes.api'

export type PrintBoxSelectorProps = {
  boxes: readonly BoxSummary[]
  totalCount: number
  selected: ReadonlySet<string>
  query: string
  generating: boolean
  onQueryChange: (query: string) => void
  onToggle: (boxId: string) => void
  onToggleVisible: () => void
  onDownload: () => void
}

export function PrintBoxSelector({
  boxes,
  totalCount,
  selected,
  query,
  generating,
  onQueryChange,
  onToggle,
  onToggleVisible,
  onDownload,
}: PrintBoxSelectorProps) {
  const allVisibleSelected = boxes.length > 0 && boxes.every((box) => selected.has(box.id))
  const selectVisibleLabel = allVisibleSelected ? '取消选择当前结果' : '全选当前结果'

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface" aria-label="选择要打印的箱子">
      <header className="border-b border-line px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">选择箱子</h2>
            <p className="mt-1 text-sm text-muted">显示 {boxes.length} / 共 {totalCount} 个箱子</p>
          </div>
          <span className="text-sm font-medium text-brand" role="status" aria-label={`已选择 ${selected.size} 个箱子`}>
            已选择 {selected.size} 个
          </span>
        </div>
        <div className="relative mt-4">
          <AppIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" name="search" size={18} />
          <input
            className="min-h-11 w-full rounded-control border border-line bg-canvas py-2 pr-3 pl-10 text-ink placeholder:text-muted focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
            type="search"
            aria-label="搜索箱子"
            placeholder="搜索箱子名称、编号或空间"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            className="min-h-11 rounded-control px-3 text-sm font-semibold text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:text-muted focus-visible:ring-2 focus-visible:ring-brand/30"
            type="button"
            disabled={boxes.length === 0}
            onClick={onToggleVisible}
          >
            {selectVisibleLabel}
          </button>
        </div>
      </header>

      <div className="max-h-[32rem] overflow-y-auto overscroll-contain">
        {boxes.map((box) => {
          const isSelected = selected.has(box.id)
          const location = box.location || '未填写位置'

          return (
            <label
              className={`grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-x border-b px-3 py-2 transition-colors ${isSelected ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
              key={box.id}
            >
              <input
                className="size-5 shrink-0 accent-brand focus-visible:ring-2 focus-visible:ring-brand/30"
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(box.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{box.name}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">{box.space_name} · {location}</span>
              </span>
              <span className="justify-self-end whitespace-nowrap text-xs font-medium tracking-wide text-muted">{box.box_code}</span>
            </label>
          )
        })}
      </div>

      <footer className="border-t border-line p-4">
        <button
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-2 font-bold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-muted focus-visible:ring-2 focus-visible:ring-brand/30"
          type="button"
          disabled={selected.size === 0 || generating}
          onClick={onDownload}
        >
          <AppIcon name="print" size={18} />
          {generating ? '生成中…' : '下载 PDF'}
        </button>
      </footer>
    </section>
  )
}
