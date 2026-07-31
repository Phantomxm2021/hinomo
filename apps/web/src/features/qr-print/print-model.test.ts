import { describe, expect, it } from 'vitest'
import {
  filterPrintBoxes,
  paginatePrintBoxes,
  selectedPrintBoxes,
  toggleVisibleSelection,
  type PrintBox,
} from './print-model'

type TestBox = PrintBox & { marker: number }

const boxes: TestBox[] = [
  {
    id: 'box-1', name: '冬季衣物', box_code: 'BX-WARM', space_name: '家',
    location: '卧室衣柜上层', marker: 1,
  },
  {
    id: 'box-2', name: '露营装备', box_code: 'camp-002', space_name: '储藏室',
    location: null, marker: 2,
  },
  {
    id: 'box-3', name: '文件', box_code: 'DOC-003', space_name: '书房',
    location: '书桌抽屉', marker: 3,
  },
]

describe('print model', () => {
  it.each([
    ['中文名称', ' 冬季 ', ['box-1']],
    ['大小写无关的编号', 'CAMP-002', ['box-2']],
    ['空间', '储藏室', ['box-2']],
    ['位置', '抽屉', ['box-3']],
  ])('filters by %s with a trimmed case-insensitive query', (_field, query, ids) => {
    expect(filterPrintBoxes(boxes, query).map((box) => box.id)).toEqual(ids)
  })

  it('returns every box in a new array for a blank query without mutating input', () => {
    const snapshot = structuredClone(boxes)
    const result = filterPrintBoxes(boxes, '   ')

    expect(result).toEqual(boxes)
    expect(result).not.toBe(boxes)
    expect(boxes).toEqual(snapshot)
  })

  it('removes all selected visible ids while preserving hidden selections', () => {
    const selected = new Set(['box-1', 'box-2', '', 'hidden-box'])

    const result = toggleVisibleSelection(selected, ['box-1', 'box-2', '', 'box-2'])

    expect(result).toEqual(new Set(['hidden-box']))
    expect(result).not.toBe(selected)
    expect(selected).toEqual(new Set(['box-1', 'box-2', '', 'hidden-box']))
  })

  it('adds every visible id when any visible id is unselected', () => {
    const selected = new Set(['box-1', 'hidden-box'])
    const result = toggleVisibleSelection(selected, ['box-1', 'box-2', ''])

    expect(result).toEqual(new Set(['box-1', 'hidden-box', 'box-2', '']))
    expect(result).not.toBe(selected)
    expect(selected).toEqual(new Set(['box-1', 'hidden-box']))
  })

  it('returns an equivalent new selection for no visible ids', () => {
    const selected = new Set(['hidden-box'])
    const result = toggleVisibleSelection(selected, [])

    expect(result).toEqual(selected)
    expect(result).not.toBe(selected)
  })

  it('returns selected boxes in their original order without mutating inputs', () => {
    const selected = new Set(['box-3', 'box-1'])
    const snapshot = structuredClone(boxes)

    expect(selectedPrintBoxes(boxes, selected).map((box) => box.id)).toEqual(['box-1', 'box-3'])
    expect(boxes).toEqual(snapshot)
    expect(selected).toEqual(new Set(['box-3', 'box-1']))
  })

  it('accepts selected values that only provide an id', () => {
    const idOnlyBoxes = [{ id: 'box-1' }, { id: 'box-2' }]

    expect(selectedPrintBoxes(idOnlyBoxes, new Set(['box-2']))).toEqual([{ id: 'box-2' }])
  })

  it.each([
    [0, []],
    [8, [8]],
    [9, [8, 1]],
  ])('paginates %i boxes eight per page without mutating input', (length, pageSizes) => {
    const input = Array.from({ length }, (_, index) => ({
      ...boxes[0], id: `box-${index + 1}`, marker: index + 1,
    }))
    const snapshot = structuredClone(input)

    const pages = paginatePrintBoxes(input)

    expect(pages.map((page) => page.length)).toEqual(pageSizes)
    expect(pages.flat().map((box) => box.id)).toEqual(input.map((box) => box.id))
    expect(input).toEqual(snapshot)
  })
})
