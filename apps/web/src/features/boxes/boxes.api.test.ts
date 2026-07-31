import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBoxByPublicId, listBoxes } from './boxes.api'

const { mockEq, mockFrom, mockGetSession, mockOrder, mockRpc, mockSelect, mockSingle } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockOrder: vi.fn(),
  mockRpc: vi.fn(),
  mockSelect: vi.fn(),
  mockSingle: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
    rpc: mockRpc,
  },
}))

describe('boxes api', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockFrom.mockReset()
    mockGetSession.mockReset()
    mockOrder.mockReset()
    mockRpc.mockReset()
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
          spaces: { name: '客厅', venues: { name: '家里' } },
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
        venue_name: '家里',
        cover_object_key: 'users/u/boxes/b/cover.webp',
        item_count: 3,
        updated_at: '2026-07-30T08:00:00Z',
      },
    ])
    expect(mockSelect).toHaveBeenCalledWith(
      'id, public_id, box_code, space_id, name, location, visibility, cover_object_key, updated_at, items(count), spaces(name, venues(name))',
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

  it('falls back to the legacy catalogue query when the venue relationship is unavailable', async () => {
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST200', message: "Could not find a relationship between 'spaces' and 'venues'" },
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'box-1', public_id: 'public-1', box_code: 'B001', space_id: 'space-1',
          name: '原有箱子', location: null, visibility: 'private', cover_object_key: null,
          updated_at: '2026-07-30T08:00:00Z', items: [{ count: 2 }], spaces: { name: '客厅' },
        }],
        error: null,
      })

    await expect(listBoxes()).resolves.toMatchObject([{
      name: '原有箱子', venue_name: '', space_name: '客厅', item_count: 2,
    }])
    expect(mockSelect).toHaveBeenNthCalledWith(
      2,
      'id, public_id, box_code, space_id, name, location, visibility, cover_object_key, updated_at, items(count), spaces(name)',
    )
  })

  it('rejects catalogue access when there is no authenticated user', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(listBoxes()).rejects.toThrow('authentication is required')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('loads public box details through the safe RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{
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
        space_name: '客厅',
        venue_name: '家里',
        items: [],
      }],
      error: null,
    })

    await expect(getBoxByPublicId('public-1')).resolves.toMatchObject({
      id: 'box-1',
      updated_at: '2026-07-30T08:00:00Z',
      space_name: '客厅',
    })
    expect(mockRpc).toHaveBeenCalledWith('get_public_box', { p_public_id: 'public-1' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('falls back to the owner query for a signed-in private box', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq
      .mockReturnValueOnce({ eq: mockEq })
      .mockReturnValueOnce({ single: mockSingle })
    mockSingle.mockResolvedValue({
      data: {
        id: 'box-private', owner_id: 'user-1', public_id: 'private-1', box_code: 'B002',
        space_id: 'space-1', name: '证件箱', category: null, location: null,
        description: null, visibility: 'private', cover_object_key: null,
        updated_at: '2026-07-30T08:00:00Z', spaces: { name: '书房', venues: { name: '家里' } }, items: [],
      },
      error: null,
    })

    await expect(getBoxByPublicId('private-1')).resolves.toMatchObject({
      id: 'box-private', visibility: 'private', venue_name: '家里', space_name: '书房',
    })
    expect(mockEq).toHaveBeenNthCalledWith(1, 'public_id', 'private-1')
    expect(mockEq).toHaveBeenNthCalledWith(2, 'owner_id', 'user-1')
  })

  it('falls back to the legacy owner detail query when venues are not deployed', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq
      .mockReturnValueOnce({ eq: mockEq })
      .mockReturnValueOnce({ single: mockSingle })
      .mockReturnValueOnce({ eq: mockEq })
      .mockReturnValueOnce({ single: mockSingle })
    mockSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST200', message: "Could not find a relationship between 'spaces' and 'venues'" },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'box-private', owner_id: 'user-1', public_id: 'private-1', box_code: 'B002',
          space_id: 'space-1', name: '证件箱', category: null, location: null,
          description: null, visibility: 'private', cover_object_key: null,
          updated_at: '2026-07-30T08:00:00Z', spaces: { name: '书房' }, items: [],
        },
        error: null,
      })

    await expect(getBoxByPublicId('private-1')).resolves.toMatchObject({
      id: 'box-private', venue_name: '', space_name: '书房',
    })
  })

  it('does not issue an owner query when the visitor is anonymous', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(getBoxByPublicId('private-1')).resolves.toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
