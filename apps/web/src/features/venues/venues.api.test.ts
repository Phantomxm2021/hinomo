import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVenue, deleteVenue, listVenues, updateVenue } from './venues.api'

const { mockDefaultOrder, mockDelete, mockEq, mockFrom, mockGetSession, mockInsert, mockNameOrder, mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockDefaultOrder: vi.fn(),
  mockDelete: vi.fn(),
  mockEq: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockInsert: vi.fn(),
  mockNameOrder: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession }, from: mockFrom },
}))

describe('venues api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } } })
    mockFrom.mockReturnValue({
      select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete,
    })
    mockSelect.mockReturnValue({ order: mockDefaultOrder })
    mockDefaultOrder.mockReturnValue({ order: mockNameOrder })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockDelete.mockReturnValue({ eq: mockEq })
  })

  it('maps venue space counts', async () => {
    mockNameOrder.mockResolvedValue({
      data: [
        { id: 'default', name: '默认', description: null, is_default: true, spaces: [{ count: 0 }] },
        { id: 'home', name: '家里', description: null, is_default: false, spaces: [{ count: 3 }] },
      ],
      error: null,
    })

    await expect(listVenues()).resolves.toEqual([
      { id: 'default', name: '默认', description: null, is_default: true, space_count: 0 },
      { id: 'home', name: '家里', description: null, is_default: false, space_count: 3 },
    ])
    expect(mockSelect).toHaveBeenCalledWith('id, name, description, is_default, spaces(count)')
    expect(mockDefaultOrder).toHaveBeenCalledWith('is_default', { ascending: false })
    expect(mockNameOrder).toHaveBeenCalledWith('name')
  })

  it.each(['PGRST200', 'PGRST205', '42P01', '42703'])('maps %s to a deployment error', async (code) => {
    mockNameOrder.mockResolvedValue({ data: null, error: { code, message: 'schema unavailable' } })
    await expect(listVenues()).rejects.toMatchObject({ code: 'VENUES_SCHEMA_UNAVAILABLE' })
  })

  it('creates an owner-scoped venue', async () => {
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'office' }, error: null }) })

    await expect(createVenue({ name: '公司', description: null })).resolves.toEqual({ id: 'office' })
    expect(mockInsert).toHaveBeenCalledWith({ owner_id: 'owner-1', name: '公司', description: null })
  })

  it('updates and deletes by id', async () => {
    mockEq.mockResolvedValue({ error: null })
    await updateVenue('office', { name: '工作室', description: '二楼' })
    expect(mockUpdate).toHaveBeenCalledWith({ name: '工作室', description: '二楼' })
    expect(mockEq).toHaveBeenCalledWith('id', 'office')

    await deleteVenue('office')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenLastCalledWith('id', 'office')
  })
})
