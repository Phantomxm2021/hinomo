import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createItem, deleteItem, updateItem } from './items.api'

const mocks = vi.hoisted(() => ({
  captureGrowthEvent: vi.fn(),
  firstGrowthOccurrence: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))
vi.mock('../../lib/analytics', () => ({
  captureGrowthEvent: mocks.captureGrowthEvent,
  firstGrowthOccurrence: mocks.firstGrowthOccurrence,
}))

describe('item mutation visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.firstGrowthOccurrence.mockReturnValue(true)
    mocks.from.mockReturnValue({ update: mocks.update, delete: mocks.delete })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.delete.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ select: mocks.select })
    mocks.select.mockReturnValue({ maybeSingle: mocks.maybeSingle })
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'item-1' }, error: null })
  })

  it('requires update REST calls to return the affected item row', async () => {
    await updateItem('item-1', {
      name: 'Lantern', category: null, quantity: 1, description: null,
    })

    expect(mocks.update).toHaveBeenCalled()
    expect(mocks.eq).toHaveBeenCalledWith('id', 'item-1')
    expect(mocks.select).toHaveBeenCalledWith('id')
    expect(mocks.maybeSingle).toHaveBeenCalledOnce()
  })

  it('captures a manual first-item event only after an item insert succeeds', async () => {
    const insert = vi.fn().mockReturnValue({ select: mocks.select })
    mocks.from.mockReturnValue({ insert, update: mocks.update, delete: mocks.delete })
    mocks.select.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }) })

    await createItem({ box_id: 'box-1', name: 'Lantern', category: null, quantity: 1, description: null })

    expect(mocks.captureGrowthEvent).toHaveBeenCalledWith('first_item_created', {
      onboarding: false, method: 'manual', first: true,
    })
  })

  it('does not capture an item event when the insert fails', async () => {
    const insert = vi.fn().mockReturnValue({ select: mocks.select })
    mocks.from.mockReturnValue({ insert, update: mocks.update, delete: mocks.delete })
    const error = new Error('insert failed')
    mocks.select.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error }) })

    await expect(createItem({ box_id: 'box-1', name: 'Lantern', category: null, quantity: 1, description: null })).rejects.toBe(error)

    expect(mocks.captureGrowthEvent).not.toHaveBeenCalled()
  })

  it.each([
    ['update', () => updateItem('item-1', { name: 'Lantern', category: null, quantity: 1, description: null })],
    ['delete', () => deleteItem('item-1')],
  ])('turns an RLS-hidden zero-row %s into an observable access denial', async (_operation, mutate) => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(mutate()).rejects.toMatchObject({
      code: '42501',
      message: 'item is not accessible',
    })
  })

  it('preserves a concrete PostgREST mutation error', async () => {
    const error = { code: '42501', message: 'permission denied for table items' }
    mocks.maybeSingle.mockResolvedValue({ data: null, error })

    await expect(deleteItem('item-1')).rejects.toBe(error)
  })
})
