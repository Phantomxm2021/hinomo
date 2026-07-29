import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxesPage } from './BoxesPage'

const { mockDeleteBox, mockListBoxes } = vi.hoisted(() => ({
  mockDeleteBox: vi.fn(),
  mockListBoxes: vi.fn(),
}))

vi.mock('./boxes.api', () => ({
  deleteBox: mockDeleteBox,
  listBoxes: mockListBoxes,
}))

beforeEach(() => {
  mockDeleteBox.mockReset()
  mockListBoxes.mockReset()
})

afterEach(cleanup)

test('lists boxes and deletes one after confirmation', async () => {
  const user = userEvent.setup()
  mockListBoxes
    .mockResolvedValueOnce([
      {
        id: 'box-1',
        public_id: 'public-1',
        box_code: 'BX-00001',
        name: '冬季衣物',
        location: '衣柜上层',
        visibility: 'private',
        space_name: '家',
      },
    ])
    .mockResolvedValueOnce([])
  mockDeleteBox.mockResolvedValue(undefined)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <BoxesPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )

  expect(await screen.findByText('BX-00001')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '删除冬季衣物' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteBox).toHaveBeenCalledWith('box-1')
  expect(await screen.findByText('还没有箱子')).toBeInTheDocument()
})
