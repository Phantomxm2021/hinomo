import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchItems } from './search.api'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

describe('search api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the search RPC and preserves the complete venue path', async () => {
    const result = {
      item_id: 'item-1',
      item_name: '充电器',
      quantity: 2,
      stored_quantity: 1,
      box_id: 'box-1',
      box_public_id: 'public-1',
      box_name: '电子设备箱',
      venue_name: '公司',
      space_name: '办公室',
      location: '文件柜',
    }
    mockRpc.mockResolvedValue({ data: [result], error: null })

    await expect(searchItems('充电器')).resolves.toEqual([result])
    expect(mockRpc).toHaveBeenCalledWith('search_my_items', { p_query: '充电器' })
  })

  it('returns an empty list for a successful RPC without rows', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await expect(searchItems('不存在')).resolves.toEqual([])
  })

  it('surfaces RPC errors', async () => {
    const error = { code: '42501', message: 'permission denied' }
    mockRpc.mockResolvedValue({ data: null, error })
    await expect(searchItems('充电器')).rejects.toBe(error)
  })
})
