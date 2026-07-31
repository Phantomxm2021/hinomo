import { describe, expect, it } from 'vitest'
import type { BoxSummary } from './boxes.api'
import {
  catalogueSpaces,
  catalogueSummary,
  filterBoxes,
} from './box-catalogue'

const boxes: BoxSummary[] = [
  {
    id: 'box-1', public_id: 'public-1', box_code: 'LAT-001', name: 'Apple Box',
    space_id: 'space-kitchen', venue_name: '家里', space_name: '厨房', location: 'Pantry Shelf',
    visibility: 'private', cover_object_key: null, item_count: 2,
    updated_at: '2026-07-29T08:00:00Z',
  },
  {
    id: 'box-2', public_id: 'public-2', box_code: 'CN-002', name: '测试收纳箱',
    space_id: 'space-living', venue_name: '家里', space_name: '客厅', location: '电视柜',
    visibility: 'private', cover_object_key: null, item_count: 7,
    updated_at: '2026-07-31T08:00:00Z',
  },
  {
    id: 'box-3', public_id: 'public-3', box_code: 'GAM-002', name: '阿尔法盒',
    space_id: 'space-kitchen', venue_name: '家里', space_name: '厨房', location: null,
    visibility: 'private', cover_object_key: null, item_count: 7,
    updated_at: '2026-07-30T08:00:00Z',
  },
]

const emptyFilters = { query: '', spaceId: '' }

describe('box catalogue', () => {
  it.each([
    ['name', ' apple ', ['box-1']],
    ['code', 'cn-002', ['box-2']],
    ['space', '客厅', ['box-2']],
    ['location', 'pantry', ['box-1']],
  ])('searches %s with a trimmed case-insensitive query', (_field, query, ids) => {
    expect(filterBoxes(boxes, { ...emptyFilters, query }).map((box) => box.id)).toEqual(ids)
  })

  it('combines a query with an exact space filter', () => {
    expect(filterBoxes(boxes, { query: '002', spaceId: 'space-kitchen' }))
      .toEqual([boxes[2]])
  })

  it('keeps the input API order after filtering', () => {
    expect(filterBoxes(boxes, emptyFilters).map((box) => box.id)).toEqual(['box-1', 'box-2', 'box-3'])
    expect(filterBoxes(boxes, { query: '002', spaceId: '' }).map((box) => box.id)).toEqual(['box-2', 'box-3'])
  })

  it('does not mutate the input array', () => {
    const input = structuredClone(boxes)
    const snapshot = structuredClone(input)
    filterBoxes(input, emptyFilters)
    expect(input).toEqual(snapshot)
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
