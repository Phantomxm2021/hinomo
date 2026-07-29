import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { ItemForm } from './ItemForm'

const { mockCreateItem } = vi.hoisted(() => ({ mockCreateItem: vi.fn() }))
vi.mock('./items.api', () => ({ createItem: mockCreateItem, updateItem: vi.fn() }))
afterEach(cleanup)

test('rejects zero quantity before submit', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  await user.type(screen.getByLabelText('物品名称'), '围巾')
  await user.clear(screen.getByLabelText('数量'))
  await user.type(screen.getByLabelText('数量'), '0')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(screen.getByText('数量必须大于 0')).toBeInTheDocument()
  expect(mockCreateItem).not.toHaveBeenCalled()
})
