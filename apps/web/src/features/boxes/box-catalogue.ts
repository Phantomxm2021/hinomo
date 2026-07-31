import type { BoxSummary } from './boxes.api'

export type BoxCatalogueSort = 'recent' | 'name' | 'items'

export type BoxCatalogueFilters = {
  query: string
  spaceId: string
  sort: BoxCatalogueSort
}

export function parseCatalogueSort(value: string | null): BoxCatalogueSort {
  return value === 'name' || value === 'items' ? value : 'recent'
}

export function filterAndSortBoxes(
  boxes: readonly BoxSummary[],
  filters: BoxCatalogueFilters,
): BoxSummary[] {
  const query = filters.query.trim().toLowerCase()

  return boxes
    .filter((box) => {
      const matchesQuery = !query || [box.name, box.box_code, box.space_name, box.location ?? '']
        .some((value) => value.toLowerCase().includes(query))
      return matchesQuery && (!filters.spaceId || box.space_id === filters.spaceId)
    })
    .toSorted((left, right) => {
      if (filters.sort === 'name') {
        return left.name.localeCompare(right.name, 'zh-CN') || left.id.localeCompare(right.id)
      }
      if (filters.sort === 'items') {
        return right.item_count - left.item_count
          || left.name.localeCompare(right.name, 'zh-CN')
          || left.id.localeCompare(right.id)
      }
      return Date.parse(right.updated_at) - Date.parse(left.updated_at)
        || left.id.localeCompare(right.id)
    })
}

export function catalogueSpaces(boxes: readonly BoxSummary[]): Array<{ id: string; name: string; count: number }> {
  const spaces = new Map<string, { id: string; name: string; count: number }>()

  for (const box of boxes) {
    const existing = spaces.get(box.space_id)
    if (existing) existing.count += 1
    else spaces.set(box.space_id, { id: box.space_id, name: box.space_name, count: 1 })
  }

  return [...spaces.values()]
}

export function catalogueSummary(boxes: readonly BoxSummary[]): { boxCount: number; itemCount: number } {
  return {
    boxCount: boxes.length,
    itemCount: boxes.reduce((total, box) => total + box.item_count, 0),
  }
}
