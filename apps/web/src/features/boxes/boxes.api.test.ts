import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBoxByPublicId, listBoxes } from './boxes.api'

const { mockEq, mockFrom, mockOrder, mockSelect, mockSingle } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockOrder: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

describe('boxes api', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockFrom.mockReset()
    mockOrder.mockReset()
    mockSelect.mockReset()
    mockSingle.mockReset()
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('maps storage overview fields for each box', async () => {
    mockSelect.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'box-1',
          public_id: 'public-1',
          box_code: 'B001',
          space_id: 'space-1',
          name: '换季衣物',
          location: '衣柜顶层',
          visibility: 'private',
          cover_object_key: 'users/u/boxes/b/cover.webp',
          updated_at: '2026-07-30T08:00:00Z',
          items: [{ count: 3 }],
          spaces: { name: '客厅' },
        },
      ],
      error: null,
    })

    await expect(listBoxes()).resolves.toEqual([
      {
        id: 'box-1',
        public_id: 'public-1',
        box_code: 'B001',
        space_id: 'space-1',
        name: '换季衣物',
        location: '衣柜顶层',
        visibility: 'private',
        space_name: '客厅',
        cover_object_key: 'users/u/boxes/b/cover.webp',
        item_count: 3,
        updated_at: '2026-07-30T08:00:00Z',
      },
    ])
    expect(mockSelect).toHaveBeenCalledWith(
      'id, public_id, box_code, space_id, name, location, visibility, cover_object_key, updated_at, items(count), spaces(name)',
    )
  })

  it('maps updated_at for public box details', async () => {
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({
      data: {
        id: 'box-1',
        owner_id: 'user-1',
        public_id: 'public-1',
        box_code: 'B001',
        space_id: 'space-1',
        name: '换季衣物',
        category: '衣物',
        location: '衣柜顶层',
        description: '冬季用品',
        visibility: 'public',
        cover_object_key: null,
        updated_at: '2026-07-30T08:00:00Z',
        spaces: { name: '客厅' },
        items: [],
      },
      error: null,
    })

    await expect(getBoxByPublicId('public-1')).resolves.toMatchObject({
      id: 'box-1',
      updated_at: '2026-07-30T08:00:00Z',
    })
    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining('updated_at'),
    )
  })
})
