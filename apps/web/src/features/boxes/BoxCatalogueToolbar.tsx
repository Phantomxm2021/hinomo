import type { ChangeEvent } from 'react'
import type { BoxCatalogueSort } from './box-catalogue'

type BoxCatalogueToolbarProps = {
  query: string
  sort: BoxCatalogueSort
  onQueryChange: (query: string) => void
  onSortChange: (sort: BoxCatalogueSort) => void
}

export function BoxCatalogueToolbar({ query, sort, onQueryChange, onSortChange }: BoxCatalogueToolbarProps) {
  return (
    <div className="grid gap-2 rounded-card border border-line bg-surface/75 p-2 sm:grid-cols-2">
      <input
        className="min-h-12 w-full rounded-control border border-line bg-surface px-3 text-ink placeholder:text-muted focus:border-brand"
        type="search"
        aria-label="搜索箱子"
        placeholder="搜索箱子名称、编号、空间或位置"
        value={query}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
      />
      <select
        className="min-h-12 w-full rounded-control border border-line bg-surface px-3 text-ink focus:border-brand"
        aria-label="箱子排序"
        value={sort}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onSortChange(event.target.value as BoxCatalogueSort)}
      >
        <option value="recent">最近更新</option>
        <option value="name">名称 A–Z</option>
        <option value="items">物品数量从多到少</option>
      </select>
    </div>
  )
}
