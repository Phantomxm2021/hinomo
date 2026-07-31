import type { BoxSummary } from './boxes.api'

export type BoxCatalogueFilters = {
  query: string
  spaceId: string
}

export function filterBoxes(
  boxes: readonly BoxSummary[],
  filters: BoxCatalogueFilters,
): BoxSummary[] {
  const query = filters.query.trim().toLowerCase()

  return boxes.filter((box) => {
    const matchesQuery = !query || [box.name, box.box_code, box.space_name, box.location ?? '']
      .some((value) => value.toLowerCase().includes(query))
    return matchesQuery && (!filters.spaceId || box.space_id === filters.spaceId)
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
