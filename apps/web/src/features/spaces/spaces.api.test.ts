import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSpace, listSpaceLayouts, listSpaces, saveSpaceLayout, updateSpace } from './spaces.api'

const { mockCaptureGrowthEvent, mockFirstGrowthOccurrence, mockFrom, mockGetSession, mockLayoutSelect, mockOrder, mockRpc, mockSelect, mockUpsert } = vi.hoisted(() => ({
  mockCaptureGrowthEvent: vi.fn(),
  mockFirstGrowthOccurrence: vi.fn(),
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockLayoutSelect: vi.fn(),
  mockOrder: vi.fn(),
  mockRpc: vi.fn(),
  mockSelect: vi.fn(),
  mockUpsert: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
    rpc: mockRpc,
  },
}))
vi.mock('../../lib/analytics', () => ({
  captureGrowthEvent: mockCaptureGrowthEvent,
  firstGrowthOccurrence: mockFirstGrowthOccurrence,
}))

describe('spaces api', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockGetSession.mockReset()
    mockLayoutSelect.mockReset()
    mockOrder.mockReset()
    mockRpc.mockReset()
    mockSelect.mockReset()
    mockUpsert.mockReset()
    mockCaptureGrowthEvent.mockReset()
    mockFirstGrowthOccurrence.mockReset().mockReturnValue(true)
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

  it('creates a space through the venue-safe RPC without an owner id', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'space-2' }], error: null })

    await createSpace({ venue_id: 'venue-home', name: '卧室', description: null })

    expect(mockRpc).toHaveBeenCalledWith('create_space', {
      p_venue_id: 'venue-home', p_name: '卧室', p_description: null,
    })
    expect(mockCaptureGrowthEvent).toHaveBeenCalledWith('space_created', { onboarding: false, first: true })
  })

  it('does not capture a space event when the create RPC fails', async () => {
    const error = new Error('space create failed')
    mockRpc.mockResolvedValue({ data: null, error })

    await expect(createSpace({ venue_id: 'venue-home', name: '卧室', description: null })).rejects.toBe(error)

    expect(mockCaptureGrowthEvent).not.toHaveBeenCalled()
  })

  it('updates the selected venue through the venue-safe RPC without an owner id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await updateSpace('space-1', { venue_id: 'venue-office', name: '书房', description: '文件' })

    expect(mockRpc).toHaveBeenCalledWith('update_space', {
      p_space_id: 'space-1', p_venue_id: 'venue-office', p_name: '书房', p_description: '文件',
    })
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

  it('saves a layout through the venue-safe RPC without an owner id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })

    await saveSpaceLayout('space-1', { x: 6, y: 10, width: 44, height: 36 })

    expect(mockRpc).toHaveBeenCalledWith('save_space_layout', {
      p_space_id: 'space-1', p_x_percent: 6, p_y_percent: 10, p_width_percent: 44, p_height_percent: 36,
    })
  })
})
