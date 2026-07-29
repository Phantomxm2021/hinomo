import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listSpaces } from './spaces.api'

const { mockFrom, mockOrder, mockSelect } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockOrder: vi.fn(),
  mockSelect: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

describe('spaces api', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockOrder.mockReset()
    mockSelect.mockReset()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ order: mockOrder })
  })

  it('aggregates box and item counts for each space', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'space-1',
          name: '客厅',
          description: '日常用品',
          boxes: [
            { id: 'box-1', items: [{ count: 2 }] },
            { id: 'box-2', items: [{ count: 3 }] },
          ],
        },
      ],
      error: null,
    })

    await expect(listSpaces()).resolves.toEqual([
      {
        id: 'space-1',
        name: '客厅',
        description: '日常用品',
        box_count: 2,
        item_count: 5,
      },
    ])
    expect(mockSelect).toHaveBeenCalledWith(
      'id, name, description, boxes(id, items(count))',
    )
  })
})
