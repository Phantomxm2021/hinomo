import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVenue, deleteVenue, listVenues, updateVenue } from './venues.api'

const { mockDelete, mockEq, mockFrom, mockGetSession, mockInsert, mockRpc, mockSelect, mockUpdate, mockUpdateSelect } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockInsert: vi.fn(),
  mockRpc: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateSelect: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession }, from: mockFrom, rpc: mockRpc },
}))

describe('venues api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } } })
    mockFrom.mockReturnValue({
      select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete,
    })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockDelete.mockReturnValue({ eq: mockEq })
  })

  it('maps accessible venues returned by the sharing RPC', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { id: 'default', owner_id: 'owner-1', name: '默认', description: null, is_default: true, role: 'owner', owner_display_name: 'Owner', space_count: 0, member_count: 1, max_members: 5 },
        { id: 'home', owner_id: 'owner-2', name: '家里', description: null, is_default: false, role: 'member', owner_display_name: 'Alice', space_count: 3, member_count: 2, max_members: 5 },
      ],
      error: null,
    })

    await expect(listVenues()).resolves.toEqual([
      { id: 'default', owner_id: 'owner-1', name: '默认', description: null, is_default: true, role: 'owner', owner_display_name: 'Owner', space_count: 0, member_count: 1, max_members: 5 },
      { id: 'home', owner_id: 'owner-2', name: '家里', description: null, is_default: false, role: 'member', owner_display_name: 'Alice', space_count: 3, member_count: 2, max_members: 5 },
    ])
    expect(mockRpc).toHaveBeenCalledWith('list_accessible_venues')
  })

  it.each(['PGRST200', 'PGRST205', '42P01', '42703'])('maps %s to a deployment error', async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { code, message: 'schema unavailable' } })
    await expect(listVenues()).rejects.toMatchObject({ code: 'VENUES_SCHEMA_UNAVAILABLE' })
  })

  it('creates an owner-scoped venue', async () => {
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'office' }, error: null }) })

    await expect(createVenue({ name: '公司', description: null })).resolves.toEqual({ id: 'office' })
    expect(mockInsert).toHaveBeenCalledWith({ owner_id: 'owner-1', name: '公司', description: null })
  })

  it('updates and deletes by id', async () => {
    mockEq.mockReturnValue({ select: mockUpdateSelect })
    mockUpdateSelect.mockResolvedValue({ data: [{ id: 'office' }], error: null })
    await updateVenue('office', { name: '工作室', description: '二楼' })
    expect(mockUpdate).toHaveBeenCalledWith({ name: '工作室', description: '二楼' })
    expect(mockEq).toHaveBeenCalledWith('id', 'office')

    await deleteVenue('office')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenLastCalledWith('id', 'office')
  })

  it('fails instead of reporting success when venue update affects no rows', async () => {
    mockEq.mockReturnValue({ select: mockUpdateSelect })
    mockUpdateSelect.mockResolvedValue({ data: [], error: null })

    await expect(updateVenue('default', { name: '我的家', description: null }))
      .rejects.toThrow('venue update was not applied')
  })
})
