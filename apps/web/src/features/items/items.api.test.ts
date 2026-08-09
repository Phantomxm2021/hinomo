import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteItem, updateItem } from './items.api'

const mocks = vi.hoisted(() => ({
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

describe('item mutation visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
