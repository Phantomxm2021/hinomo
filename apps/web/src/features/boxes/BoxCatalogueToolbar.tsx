import type { ChangeEvent } from 'react'

type BoxCatalogueToolbarProps = {
  query: string
  onQueryChange: (query: string) => void
}

export function BoxCatalogueToolbar({ query, onQueryChange }: BoxCatalogueToolbarProps) {
  return (
    <div className="w-full rounded-card border border-line bg-surface/75 p-2">
      <input
        className="min-h-12 w-full rounded-control border border-line bg-surface px-3 text-ink placeholder:text-muted focus:border-brand"
        type="search"
        aria-label="搜索箱子"
        placeholder="搜索箱子名称、编号、空间或位置"
        value={query}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
      />
    </div>
  )
}
