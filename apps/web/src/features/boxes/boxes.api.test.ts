import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isBoxLimitReached } from './box-entitlements.api'
import { createBox, getBoxByPublicId, listBoxes, listBoxesForVenue, updateBox } from './boxes.api'

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

  it('lists only boxes accessible through the venue-safe RPC', async () => {
    mockRpc.mockResolvedValue({
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
          item_count: 3,
          venue_id: 'venue-home', space_name: '客厅', venue_name: '家里',
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
        venue_id: 'venue-home',
        space_name: '客厅',
        venue_name: '家里',
        cover_object_key: 'users/u/boxes/b/cover.webp',
        item_count: 3,
        updated_at: '2026-07-30T08:00:00Z',
      },
    ])
    expect(mockRpc).toHaveBeenCalledWith('list_accessible_boxes', { p_venue_id: null })
  })

  it('limits the catalogue query to the selected venue', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await expect(listBoxesForVenue('venue-office')).resolves.toEqual([])

    expect(mockRpc).toHaveBeenCalledWith('list_accessible_boxes', { p_venue_id: 'venue-office' })
  })

  it('maps accessible catalogue rows returned by the RPC', async () => {
    mockRpc.mockResolvedValue({
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
        item_count: 0,
        venue_id: 'venue-home', space_name: '客厅', venue_name: '家里',
      }],
      error: null,
    })

    await expect(listBoxes()).resolves.toMatchObject([{ space_name: '客厅' }])
  })


  it('creates a box through the entitlement RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'box-1', public_id: 'public-1', box_code: 'B001', name: '换季衣物' }],
      error: null,
    })

    await expect(createBox({
      space_id: 'space-1',
      name: '换季衣物',
      category: '衣物',
      location: '衣柜顶层',
      description: '冬季用品',
      visibility: 'private',
    })).resolves.toEqual({ id: 'box-1', public_id: 'public-1', box_code: 'B001', name: '换季衣物' })

    expect(mockRpc).toHaveBeenCalledWith('create_box', {
      p_space_id: 'space-1',
      p_name: '换季衣物',
      p_category: '衣物',
      p_location: '衣柜顶层',
      p_description: '冬季用品',
      p_visibility: 'private',
    })
  })

  it('propagates box creation RPC errors', async () => {
    const error = new Error('box_limit_reached')
    mockRpc.mockResolvedValue({ data: null, error })

    await expect(createBox({
      space_id: 'space-1', name: '换季衣物', category: null, location: null, description: null, visibility: 'private',
    })).rejects.toBe(error)
  })

  it('recognizes only the stable box-limit error code', () => {
    expect(isBoxLimitReached({ message: 'box_limit_reached' })).toBe(true)
    expect(isBoxLimitReached({ message: 'database error', details: 'P0001: box_limit_reached' })).toBe(true)
    expect(isBoxLimitReached(new Error('network interrupted'))).toBe(false)
  })

  it('falls back to the public RPC when the authenticated RLS detail is not accessible', async () => {
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
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
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('spaces(venue_id, name, venues(name))'))
    expect(mockRpc).toHaveBeenCalledWith('get_public_box', { p_public_id: 'public-1' })
  })

  it('uses the authenticated RLS detail query for a shared private box before public fallback', async () => {
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
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
    expect(mockEq).toHaveBeenCalledWith('public_id', 'private-1')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('does not issue an owner query when the visitor is anonymous', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await expect(getBoxByPublicId('private-1')).resolves.toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('updates a box through the venue-safe RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await updateBox('box-1', {
      space_id: 'space-1', name: '证件箱', category: null, location: null, description: null, visibility: 'private',
    })
    expect(mockRpc).toHaveBeenCalledWith('update_box', {
      p_box_id: 'box-1', p_space_id: 'space-1', p_name: '证件箱', p_category: null,
      p_location: null, p_description: null, p_visibility: 'private',
    })
  })
})
