import { expect, test } from 'vitest'
import { buildLabels, paginateLabels } from './pdf'

const box = {
  id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  space_name: '家', location: '衣柜上层', visibility: 'private' as const,
}

test('maps selected boxes to printable labels', () => {
  expect(buildLabels([box], 'https://nomo.example/')).toEqual([{
    code: 'BX-00001', name: '冬季衣物', space: '家', location: '衣柜上层',
    qrUrl: 'https://nomo.example/b/public-1',
  }])
})

test('paginates labels eight per A4 page', () => {
  const labels = Array.from({ length: 17 }, (_, index) => ({
    code: `BX-${index}`, name: `箱子 ${index}`, space: '家', location: null,
    qrUrl: `https://nomo.example/b/${index}`,
  }))
  expect(paginateLabels(labels).map((page) => page.length)).toEqual([8, 8, 1])
})
