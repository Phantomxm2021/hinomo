import { describe, expect, it } from 'vitest'
import type { BoxSummary } from './boxes.api'
import {
  catalogueSpaces,
  catalogueSummary,
  filterAndSortBoxes,
  parseCatalogueSort,
} from './box-catalogue'

const boxes: BoxSummary[] = [
  {
    id: 'box-1', public_id: 'public-1', box_code: 'LAT-001', name: 'Apple Box',
    space_id: 'space-kitchen', space_name: '厨房', location: 'Pantry Shelf',
    visibility: 'private', cover_object_key: null, item_count: 2,
    updated_at: '2026-07-29T08:00:00Z',
  },
  {
    id: 'box-2', public_id: 'public-2', box_code: 'CN-002', name: '测试收纳箱',
    space_id: 'space-living', space_name: '客厅', location: '电视柜',
    visibility: 'private', cover_object_key: null, item_count: 7,
    updated_at: '2026-07-31T08:00:00Z',
  },
  {
    id: 'box-3', public_id: 'public-3', box_code: 'GAM-002', name: '阿尔法盒',
    space_id: 'space-kitchen', space_name: '厨房', location: null,
    visibility: 'private', cover_object_key: null, item_count: 7,
    updated_at: '2026-07-30T08:00:00Z',
  },
]

const recentFilters = { query: '', spaceId: '', sort: 'recent' as const }

describe('box catalogue', () => {
  it('parses only supported non-default sort values', () => {
    expect(parseCatalogueSort('name')).toBe('name')
    expect(parseCatalogueSort('items')).toBe('items')
    expect(parseCatalogueSort('recent')).toBe('recent')
    expect(parseCatalogueSort('unexpected')).toBe('recent')
    expect(parseCatalogueSort(null)).toBe('recent')
  })

  it.each([
    ['name', ' apple ', ['box-1']],
    ['code', 'cn-002', ['box-2']],
    ['space', '客厅', ['box-2']],
    ['location', 'pantry', ['box-1']],
  ])('searches %s with a trimmed case-insensitive query', (_field, query, ids) => {
    expect(filterAndSortBoxes(boxes, { ...recentFilters, query }).map((box) => box.id)).toEqual(ids)
  })

  it('combines a query with an exact space filter', () => {
    expect(filterAndSortBoxes(boxes, { ...recentFilters, query: '002', spaceId: 'space-kitchen' }))
      .toEqual([boxes[2]])
  })

  it('sorts by most recently updated first', () => {
    expect(filterAndSortBoxes(boxes, recentFilters).map((box) => box.id)).toEqual(['box-2', 'box-3', 'box-1'])
  })

  it('sorts recent boxes chronologically across timezone offsets', () => {
    const timezoneBoxes = [
      { ...boxes[0], id: 'utc', updated_at: '2026-07-31T01:00:00Z' },
      { ...boxes[1], id: 'offset', updated_at: '2026-07-31T08:00:00+08:00' },
    ]

    expect(filterAndSortBoxes(timezoneBoxes, recentFilters).map((box) => box.id)).toEqual(['utc', 'offset'])
  })

  it('sorts Chinese and Latin names with zh-CN collation', () => {
    expect(filterAndSortBoxes(boxes, { ...recentFilters, sort: 'name' }).map((box) => box.id))
      .toEqual(['box-3', 'box-2', 'box-1'])
  })

  it('sorts by item count descending and breaks ties by name', () => {
    expect(filterAndSortBoxes(boxes, { ...recentFilters, sort: 'items' }).map((box) => box.id))
      .toEqual(['box-3', 'box-2', 'box-1'])
  })

  it('does not mutate the input array', () => {
    const input = [...boxes]
    filterAndSortBoxes(input, recentFilters)
    expect(input).toEqual(boxes)
  })

  it('lists spaces in first-encounter order with their box counts', () => {
    expect(catalogueSpaces(boxes)).toEqual([
      { id: 'space-kitchen', name: '厨房', count: 2 },
      { id: 'space-living', name: '客厅', count: 1 },
    ])
  })

  it('summarizes box and item totals', () => {
    expect(catalogueSummary(boxes)).toEqual({ boxCount: 3, itemCount: 16 })
  })
})
