import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBoxByPublicId, listBoxes } from './boxes.api'

const { mockEq, mockFrom, mockGetSession, mockOrder, mockSelect, mockSingle } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockOrder: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
}))

describe('boxes api', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockFrom.mockReset()
    mockGetSession.mockReset()
    mockOrder.mockReset()
    mockSelect.mockReset()
    mockSingle.mockReset()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
  })

  it('lists only boxes owned by the signed-in user', async () => {
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder })
    mockEq.mockReturnValue({ order: mockOrder })
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
    expect(mockEq).toHaveBeenCalledWith('owner_id', 'user-1')
  })

  it('keeps the catalogue available when an embedded space is inaccessible', async () => {
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({
      data: [{
        id: 'box-1',
        public_id: 'public-1',
        box_code: 'B001',
        space_id: 'space-1',
        name: '换季衣物',
        location: null,
        visibility: 'public',
        cover_object_key: null,
        updated_at: '2026-07-30T08:00:00Z',
        items: [{ count: 0 }],
        spaces: null,
      }],
      error: null,
    })

    await expect(listBoxes()).resolves.toMatchObject([{ space_name: '' }])
  })

  it('rejects catalogue access when there is no authenticated user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(listBoxes()).rejects.toThrow('authentication is required')
    expect(mockFrom).not.toHaveBeenCalled()
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
