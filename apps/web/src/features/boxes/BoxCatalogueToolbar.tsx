import type { ChangeEvent } from 'react'

type BoxCatalogueToolbarProps = {
  query: string
  onQueryChange: (query: string) => void
}

export function BoxCatalogueToolbar({ query, onQueryChange }: BoxCatalogueToolbarProps) {
  return (
    <div className="w-full lg:rounded-card lg:border lg:border-line lg:bg-surface/75 lg:p-2">
      <input
        className="min-h-12 w-full rounded-control border-0 bg-placeholder/45 px-3 text-ink placeholder:text-muted focus:border-brand lg:border lg:border-line lg:bg-surface"
        type="search"
        aria-label="搜索箱子"
        placeholder="搜索箱子名称、编号、空间或位置"
        value={query}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
      />
    </div>
  )
}
