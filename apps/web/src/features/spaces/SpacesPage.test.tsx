import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SpacesPage } from './SpacesPage'

const { mockCreateSpace, mockDeleteSpace, mockListSpaces, mockUpdateSpace } = vi.hoisted(() => ({
  mockCreateSpace: vi.fn(),
  mockDeleteSpace: vi.fn(),
  mockListSpaces: vi.fn(),
  mockUpdateSpace: vi.fn(),
}))

vi.mock('./spaces.api', () => ({
  createSpace: mockCreateSpace,
  deleteSpace: mockDeleteSpace,
  listSpaces: mockListSpaces,
  updateSpace: mockUpdateSpace,
}))

function renderSpaces() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return render(<SpacesPage />, { wrapper: Wrapper })
}

beforeEach(() => {
  mockCreateSpace.mockReset()
  mockDeleteSpace.mockReset()
  mockListSpaces.mockReset()
  mockUpdateSpace.mockReset()
})

afterEach(cleanup)

test('creates a space and refreshes the list', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { id: 'space-home', name: '家', description: null, box_count: 0 },
    ])
  mockCreateSpace.mockResolvedValue({ id: 'space-home' })
  renderSpaces()

  await screen.findByText('还没有空间')
  await user.type(screen.getByLabelText('空间名称'), '家')
  await user.click(screen.getByRole('button', { name: '创建空间' }))

  expect(mockCreateSpace).toHaveBeenCalledWith({
    name: '家',
    description: null,
  })
  expect(await screen.findByText('家')).toBeInTheDocument()
})

test('explains why a non-empty space cannot be deleted', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '家', description: null, box_count: 2 },
  ])
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '删除家' }))

  expect(screen.getByRole('alert')).toHaveTextContent(
    '请先移动或删除其中的 2 个箱子',
  )
  expect(mockDeleteSpace).not.toHaveBeenCalled()
})

test('updates a space and refreshes the list', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([
      { id: 's1', name: '家', description: null, box_count: 0 },
    ])
    .mockResolvedValueOnce([
      { id: 's1', name: '新家', description: '搬家后', box_count: 0 },
    ])
  mockUpdateSpace.mockResolvedValue(undefined)
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '编辑家' }))
  const nameInput = screen.getByLabelText('空间名称')
  await user.clear(nameInput)
  await user.type(nameInput, '新家')
  await user.type(screen.getByLabelText('描述（可选）'), '搬家后')
  await user.click(screen.getByRole('button', { name: '保存空间' }))

  expect(mockUpdateSpace).toHaveBeenCalledWith('s1', {
    name: '新家',
    description: '搬家后',
  })
  expect(await screen.findByText('新家')).toBeInTheDocument()
})

test('deletes an empty space after confirmation', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([
      { id: 's1', name: '空房间', description: null, box_count: 0 },
    ])
    .mockResolvedValueOnce([])
  mockDeleteSpace.mockResolvedValue(undefined)
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '删除空房间' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteSpace).toHaveBeenCalledWith('s1')
  expect(await screen.findByText('还没有空间')).toBeInTheDocument()
})
