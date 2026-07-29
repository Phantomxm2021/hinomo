import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { SearchPage } from './SearchPage'

const { mockSearchItems } = vi.hoisted(() => ({ mockSearchItems: vi.fn() }))
vi.mock('./search.api', () => ({ searchItems: mockSearchItems }))

afterEach(cleanup)

test('shows where an item is stored after a debounced search', async () => {
  const user = userEvent.setup()
  mockSearchItems.mockResolvedValue([{
    item_id: 'item-1', item_name: 'USB-C 充电器', quantity: 2,
    box_id: 'box-1', box_public_id: 'public-1', box_name: '电子设备箱',
    space_name: '办公室', location: '书房柜子',
  }])
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}><SearchPage /></QueryClientProvider>
    </MemoryRouter>,
  )

  expect(screen.getByText('请输入关键词')).toBeInTheDocument()
  await user.type(screen.getByRole('searchbox'), ' 充电器 ')

  expect(await screen.findByText('USB-C 充电器 × 2')).toBeInTheDocument()
  expect(screen.getByText('办公室 · 电子设备箱 · 书房柜子')).toBeInTheDocument()
  expect(mockSearchItems).toHaveBeenCalledWith('充电器')
  expect(screen.getByRole('link', { name: /USB-C 充电器/ })).toHaveAttribute('href', '/b/public-1')
})
