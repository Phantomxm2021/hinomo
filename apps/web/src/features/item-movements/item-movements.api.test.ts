import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listItemMovements, moveItem, returnItem, takeOutItem } from './item-movements.api'

const { mockRpc, mockFrom, mockSelect, mockEq, mockOrder } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}))

describe('item movement api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
  })

  it('takes out an item and returns the updated quantity', async () => {
    const updated = { item_id: 'item-1', box_id: 'box-1', quantity: 3, stored_quantity: 2 }
    mockRpc.mockResolvedValue({ data: [updated], error: null })
    await expect(takeOutItem({ itemId: 'item-1', quantity: 1, handlerLabel: '小林' })).resolves.toEqual(updated)
    expect(mockRpc).toHaveBeenCalledWith('take_out_item', {
      p_item_id: 'item-1', p_quantity: 1, p_handler_label: '小林', p_note: null,
    })
  })

  it('returns an item through the return RPC', async () => {
    mockRpc.mockResolvedValue({ data: [{ item_id: 'item-1' }], error: null })
    await returnItem({ itemId: 'item-1', quantity: 1, note: '归还' })
    expect(mockRpc).toHaveBeenCalledWith('return_item', {
      p_item_id: 'item-1', p_quantity: 1, p_note: '归还',
    })
  })

  it('moves an item through the move RPC', async () => {
    mockRpc.mockResolvedValue({ data: [{ item_id: 'item-1' }], error: null })
    await moveItem({ itemId: 'item-1', targetBoxId: 'box-2' })
    expect(mockRpc).toHaveBeenCalledWith('move_item', {
      p_item_id: 'item-1', p_target_box_id: 'box-2', p_note: null,
    })
  })

  it('surfaces RPC errors and missing results', async () => {
    const error = { code: '22023', message: 'invalid quantity' }
    mockRpc.mockResolvedValueOnce({ data: null, error })
    await expect(takeOutItem({ itemId: 'item-1', quantity: 0 })).rejects.toBe(error)
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    await expect(returnItem({ itemId: 'item-1', quantity: 1 })).rejects.toThrow('did not return')
  })

  it('lists newest movement history first', async () => {
    const rows = [{ id: 'movement-1' }]
    mockOrder.mockResolvedValue({ data: rows, error: null })
    await expect(listItemMovements('item-1')).resolves.toEqual(rows)
    expect(mockFrom).toHaveBeenCalledWith('item_movements')
    expect(mockEq).toHaveBeenCalledWith('item_id', 'item-1')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
