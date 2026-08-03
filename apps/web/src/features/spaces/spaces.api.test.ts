import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpace, createSpaces, listSpaceLayouts, listSpaces, saveSpaceLayout } from './spaces.api'

const { mockFrom, mockGetSession, mockLayoutSelect, mockOrder, mockSelect, mockUpsert } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockLayoutSelect: vi.fn(),
  mockOrder: vi.fn(),
  mockSelect: vi.fn(),
  mockUpsert: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
}))

describe('spaces api', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockGetSession.mockReset()
    mockLayoutSelect.mockReset()
    mockOrder.mockReset()
    mockSelect.mockReset()
    mockUpsert.mockReset()
    mockFrom.mockImplementation((table: string) => table === 'space_layouts'
      ? { select: mockLayoutSelect, upsert: mockUpsert }
      : { select: mockSelect })
    mockSelect.mockReturnValue({ order: mockOrder })
  })

  it('aggregates box and item counts for each space', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'space-1',
          venue_id: 'venue-home',
          name: '客厅',
          description: '日常用品',
          venues: { name: '家里' },
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
        venue_id: 'venue-home',
        venue_name: '家里',
        name: '客厅',
        description: '日常用品',
        box_count: 2,
        item_count: 5,
      },
    ])
    expect(mockSelect).toHaveBeenCalledWith(
      'id, venue_id, name, description, venues(name), boxes(id, items(count))',
    )
  })

  it('falls back to the legacy spaces query when the venue relationship is unavailable', async () => {
    mockOrder
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST200', message: "Could not find a relationship between 'spaces' and 'venues'" },
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'space-1', name: '客厅', description: '原有数据',
          boxes: [{ id: 'box-1', items: [{ count: 4 }] }],
        }],
        error: null,
      })

    await expect(listSpaces()).resolves.toEqual([{
      id: 'space-1', venue_id: '', venue_name: '', name: '客厅', description: '原有数据',
      box_count: 1, item_count: 4,
    }])
    expect(mockSelect).toHaveBeenNthCalledWith(
      2,
      'id, name, description, boxes(id, items(count))',
    )
  })

  it('creates a space in the selected venue', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'space-2' }, error: null })
    const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })
    mockFrom.mockImplementation((table: string) => table === 'spaces'
      ? { select: mockSelect, insert: mockInsert }
      : { select: mockLayoutSelect, upsert: mockUpsert })
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    await createSpace({ venue_id: 'venue-home', name: '卧室', description: null })

    expect(mockInsert).toHaveBeenCalledWith({
      owner_id: 'user-1', venue_id: 'venue-home', name: '卧室', description: null,
    })
  })

  it('creates several selected spaces in one atomic insert', async () => {
    const mockInsertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'space-1' }, { id: 'space-2' }], error: null })
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })
    mockFrom.mockImplementation((table: string) => table === 'spaces'
      ? { select: mockSelect, insert: mockInsert }
      : { select: mockLayoutSelect, upsert: mockUpsert })
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })

    await expect(createSpaces([
      { venue_id: 'venue-home', name: '客厅', description: null },
      { venue_id: 'venue-home', name: '卧室', description: null },
    ])).resolves.toEqual([{ id: 'space-1' }, { id: 'space-2' }])

    expect(mockInsert).toHaveBeenCalledWith([
      { owner_id: 'user-1', venue_id: 'venue-home', name: '客厅', description: null },
      { owner_id: 'user-1', venue_id: 'venue-home', name: '卧室', description: null },
    ])
    expect(mockInsertSelect).toHaveBeenCalledWith('id')
  })

  it('maps persisted percentage layouts', async () => {
    mockLayoutSelect.mockResolvedValue({
      data: [{ space_id: 'space-1', x_percent: 4, y_percent: 8, width_percent: 44, height_percent: 36 }],
      error: null,
    })

    await expect(listSpaceLayouts()).resolves.toEqual([
      { space_id: 'space-1', x: 4, y: 8, width: 44, height: 36 },
    ])
  })

  it('marks layout storage unavailable when the migration is not installed', async () => {
    mockLayoutSelect.mockResolvedValue({
      data: null,
      error: { code: 'PGRST205', message: "Could not find the table 'public.space_layouts'" },
    })

    await expect(listSpaceLayouts()).rejects.toMatchObject({ code: 'LAYOUT_STORAGE_UNAVAILABLE' })
  })

  it('upserts a layout for the signed-in owner', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    mockUpsert.mockResolvedValue({ error: null })

    await saveSpaceLayout('space-1', { x: 6, y: 10, width: 44, height: 36 })

    expect(mockUpsert).toHaveBeenCalledWith({
      space_id: 'space-1', owner_id: 'user-1',
      x_percent: 6, y_percent: 10, width_percent: 44, height_percent: 36,
    })
  })
})
