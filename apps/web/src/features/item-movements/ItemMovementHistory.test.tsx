import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ItemMovementHistory } from './ItemMovementHistory'
import type { ItemMovementHistory as Movement } from './item-movements.api'

const base = {
  actor_id: 'user-1',
  handler_label: null,
  item_id: 'item-1',
  note: null,
} satisfies Partial<Movement>

test('renders take out, return, and move history with private context', () => {
  const movements: Movement[] = [
    { ...base, id: 'm1', action: 'move', quantity: 3, from_box_id: 'box-1', to_box_id: 'box-2', from_box: { name: '工具箱' }, to_box: { name: '露营箱' }, created_at: '2026-08-02T08:30:00Z' },
    { ...base, id: 'm2', action: 'return', quantity: 1, from_box_id: null, to_box_id: 'box-1', from_box: null, to_box: { name: '工具箱' }, created_at: '2026-08-02T08:00:00Z' },
    { ...base, id: 'm3', action: 'take_out', quantity: 1, from_box_id: 'box-1', to_box_id: null, from_box: { name: '工具箱' }, to_box: null, handler_label: '周末露营', note: '周一放回', created_at: '2026-08-01T08:00:00Z' },
  ]
  render(<ItemMovementHistory movements={movements} loading={false} />)

  const history = screen.getByRole('list', { name: '物品流转记录' })
  expect(within(history).getByText('工具箱 → 露营箱')).toBeInTheDocument()
  expect(within(history).getByText('放回 工具箱')).toBeInTheDocument()
  expect(within(history).getByText('从 工具箱 取出')).toBeInTheDocument()
  expect(within(history).getByText('经手人或用途：周末露营')).toBeInTheDocument()
  expect(within(history).getByText('备注：周一放回')).toBeInTheDocument()
})

test('renders calm loading and empty states', () => {
  const { rerender } = render(<ItemMovementHistory movements={[]} loading />)
  expect(screen.getByRole('status')).toHaveTextContent('正在读取流转记录')
  rerender(<ItemMovementHistory movements={[]} loading={false} />)
  expect(screen.getByText('还没有流转记录')).toBeInTheDocument()
})
