import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PropsWithChildren } from 'react'
import { MemoryRouter } from 'react-router-dom'
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
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
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

test('keeps the create editor closed until the prominent action is used', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  renderSpaces()

  await screen.findByText('还没有空间')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('空间名称')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))

  const dialog = screen.getByRole('dialog', { name: '创建空间' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  const nameInput = within(dialog).getByLabelText('空间名称')
  expect(nameInput).toHaveValue('')
  expect(nameInput).toHaveFocus()
  expect(within(dialog).getByLabelText('描述（可选）')).toHaveValue('')
})

test('creates a space, closes the editor, and resets it for the next create', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { id: 'space-home', name: '家', description: null, box_count: 0, item_count: 0 },
    ])
  mockCreateSpace.mockResolvedValue({ id: 'space-home' })
  renderSpaces()

  await screen.findByText('还没有空间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  await user.type(screen.getByLabelText('空间名称'), '家')
  await user.click(
    within(screen.getByRole('dialog', { name: '创建空间' })).getByRole('button', {
      name: '创建空间',
    }),
  )

  expect(mockCreateSpace).toHaveBeenCalledWith({
    name: '家',
    description: null,
  })
  expect(await screen.findByText('家')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
  expect(screen.getByLabelText('描述（可选）')).toHaveValue('')
})

test('opens the edit panel with populated values, then updates and resets it', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([
      { id: 's1', name: '家', description: '一楼', box_count: 0, item_count: 3 },
    ])
    .mockResolvedValueOnce([
      { id: 's1', name: '新家', description: '搬家后', box_count: 0, item_count: 3 },
    ])
  mockUpdateSpace.mockResolvedValue(undefined)
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '编辑家' }))
  const dialog = screen.getByRole('dialog', { name: '编辑空间' })
  const nameInput = within(dialog).getByLabelText('空间名称')
  expect(nameInput).toHaveValue('家')
  expect(within(dialog).getByLabelText('描述（可选）')).toHaveValue('一楼')

  await user.clear(nameInput)
  await user.type(nameInput, '新家')
  await user.clear(screen.getByLabelText('描述（可选）'))
  await user.type(screen.getByLabelText('描述（可选）'), '搬家后')
  await user.click(screen.getByRole('button', { name: '保存空间' }))

  expect(mockUpdateSpace).toHaveBeenCalledWith('s1', {
    name: '新家',
    description: '搬家后',
  })
  expect(await screen.findByText('新家')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
})

test('cancel and close dismiss the editor and reset entered values', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([])
  renderSpaces()

  await screen.findByText('还没有空间')
  const emptyCreateButton = screen.getByRole('button', { name: '创建第一个空间' })
  await user.click(emptyCreateButton)
  await user.type(screen.getByLabelText('空间名称'), '未保存')
  await user.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(emptyCreateButton).toHaveFocus()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
  await user.type(screen.getByLabelText('空间名称'), '仍未保存')
  await user.click(screen.getByRole('button', { name: '关闭创建空间编辑器' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '创建空间' }))
  expect(screen.getByLabelText('空间名称')).toHaveValue('')
})

test('renders direct navigation cards with exact counts and separate actions', async () => {
  mockListSpaces.mockResolvedValue([
    { id: 'home / 1', name: '家', description: '日常收纳', box_count: 2, item_count: 5 },
  ])
  renderSpaces()

  const cardLink = await screen.findByRole('link', { name: /家/ })
  expect(cardLink).toHaveAttribute('href', '/app/boxes?space=home%20%2F%201')
  expect(within(cardLink).getByText('日常收纳')).toBeInTheDocument()
  expect(within(cardLink).getByText('2 个箱子 · 5 件物品')).toBeInTheDocument()
  expect(within(cardLink).queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '编辑家' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除家' })).toBeInTheDocument()
})

test('explains why a non-empty space cannot be deleted', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '家', description: null, box_count: 2, item_count: 5 },
  ])
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '删除家' }))

  expect(screen.getByRole('alert')).toHaveTextContent(
    '请先移动或删除其中的 2 个箱子',
  )
  expect(mockDeleteSpace).not.toHaveBeenCalled()
})

test('deletes an empty space after confirmation', async () => {
  const user = userEvent.setup()
  mockListSpaces
    .mockResolvedValueOnce([
      { id: 's1', name: '空房间', description: null, box_count: 0, item_count: 0 },
    ])
    .mockResolvedValueOnce([])
  mockDeleteSpace.mockResolvedValue(undefined)
  renderSpaces()

  await user.click(await screen.findByRole('button', { name: '删除空房间' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(mockDeleteSpace).toHaveBeenCalledWith('s1')
  expect(await screen.findByText('还没有空间')).toBeInTheDocument()
})

test('keeps localized mutation errors without leaking backend text', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 's1', name: '空房间', description: null, box_count: 0, item_count: 0 },
  ])
  mockCreateSpace.mockRejectedValue(new Error('sensitive create details'))
  mockDeleteSpace.mockRejectedValue(new Error('sensitive delete details'))
  renderSpaces()

  await screen.findByText('空房间')
  await user.click(screen.getByRole('button', { name: '创建空间' }))
  await user.type(screen.getByLabelText('空间名称'), '失败空间')
  await user.click(
    within(screen.getByRole('dialog', { name: '创建空间' })).getByRole('button', {
      name: '创建空间',
    }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请稍后重试')
  expect(screen.getByRole('dialog', { name: '创建空间' })).toBeInTheDocument()
  expect(screen.queryByText('sensitive create details')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '取消' }))
  await user.click(screen.getByRole('button', { name: '删除空房间' }))
  await user.click(screen.getByRole('button', { name: '确认删除' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('删除失败，请稍后重试')
  expect(screen.queryByText('sensitive delete details')).not.toBeInTheDocument()
})
