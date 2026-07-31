export type PrintBox = {
  id: string
  name: string
  box_code: string
  space_name: string
  location: string | null
}

function normalized(value: string | null): string {
  return (value ?? '').trim().toLocaleLowerCase()
}

export function filterPrintBoxes<T extends PrintBox>(boxes: readonly T[], query: string): T[] {
  const normalizedQuery = normalized(query)

  if (!normalizedQuery) return [...boxes]

  return boxes.filter((box) => [box.name, box.box_code, box.space_name, box.location ?? '']
    .some((value) => normalized(value).includes(normalizedQuery)))
}

export function toggleVisibleSelection(
  selected: ReadonlySet<string>,
  visibleIds: Iterable<string>,
): Set<string> {
  const visible = [...new Set(visibleIds)]
  const next = new Set(selected)

  if (visible.every((id) => selected.has(id))) {
    for (const id of visible) next.delete(id)
  } else {
    for (const id of visible) next.add(id)
  }

  return next
}

export function selectedPrintBoxes<T extends { id: string }>(boxes: readonly T[], selected: ReadonlySet<string>): T[] {
  return boxes.filter((box) => selected.has(box.id))
}

export function paginatePrintBoxes<T>(boxes: readonly T[]): T[][] {
  return Array.from(
    { length: Math.ceil(boxes.length / 8) },
    (_, page) => boxes.slice(page * 8, page * 8 + 8),
  )
}
