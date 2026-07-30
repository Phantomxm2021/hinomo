import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ItemForm } from './ItemForm'

const { mockCreateItem, mockUpload } = vi.hoisted(() => ({
  mockCreateItem: vi.fn(),
  mockUpload: vi.fn(),
}))
vi.mock('./items.api', () => ({ createItem: mockCreateItem, updateItem: vi.fn() }))
vi.mock('../media/useMediaUpload', () => ({
  useMediaUpload: () => ({ stage: 'idle', upload: mockUpload, reset: vi.fn() }),
}))
beforeEach(() => {
  mockCreateItem.mockReset()
  mockUpload.mockReset()
})
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
  expect(screen.getByLabelText('数量')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByLabelText('数量')).toHaveAttribute('aria-describedby', 'item-quantity-error')
  expect(mockCreateItem).not.toHaveBeenCalled()
})

test('steps quantity without going below one and submits the final number', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  mockCreateItem.mockResolvedValue({ id: 'item-1' })
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  const quantity = screen.getByLabelText('数量')
  expect(quantity).toHaveValue(1)
  await user.click(screen.getByRole('button', { name: '减少数量' }))
  expect(quantity).toHaveValue(1)
  await user.click(screen.getByRole('button', { name: '增加数量' }))
  await user.click(screen.getByRole('button', { name: '增加数量' }))
  expect(quantity).toHaveValue(3)

  await user.type(screen.getByLabelText('物品名称'), '围巾')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }))
  expect(screen.getByRole('button', { name: '减少数量' })).toHaveAttribute('type', 'button')
  expect(screen.getByRole('button', { name: '增加数量' })).toHaveAttribute('type', 'button')
})

test('shows media before item details in the visual field order', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  const labels = screen.getAllByText(/物品图片|物品名称|分类|数量|描述/)
  expect(labels.map((label) => label.textContent)).toEqual([
    '物品图片（可选）',
    '物品名称',
    '分类（可选）',
    '数量',
    '描述（可选）',
  ])
})

test('keeps the save action above mobile navigation', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} onCancel={vi.fn()} />
    </QueryClientProvider>,
  )

  expect(screen.getByRole('button', { name: '保存' }).parentElement).toHaveClass(
    'fixed',
    'inset-x-5',
    'bottom-[calc(6.75rem+env(safe-area-inset-bottom))]',
    'lg:static',
  )
})

test('submits a directly entered quantity as a number', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  mockCreateItem.mockResolvedValue({ id: 'item-1' })
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  await user.type(screen.getByLabelText('物品名称'), '收纳袋')
  await user.clear(screen.getByLabelText('数量'))
  await user.type(screen.getByLabelText('数量'), '12')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({ quantity: 12 }))
})

test('uploads a selected image after creating the item', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  const onSaved = vi.fn()
  mockCreateItem.mockResolvedValue({ id: 'item-1' })
  mockUpload.mockResolvedValue('boxes/box-1/items/item-1.webp')
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={onSaved} />
    </QueryClientProvider>,
  )

  await user.type(screen.getByLabelText('物品名称'), '围巾')
  const file = new File(['image'], 'scarf.jpeg', { type: 'image/jpeg' })
  await user.upload(screen.getByLabelText('物品图片（可选）'), file)
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(mockUpload).toHaveBeenCalledWith({
    file, boxId: 'box-1', itemId: 'item-1', kind: 'item',
  })
  expect(onSaved).toHaveBeenCalledOnce()
})

test('preserves fields and retries only the failed image upload', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  const onSaved = vi.fn()
  mockCreateItem.mockResolvedValue({ id: 'item-1' })
  mockUpload.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce('key')
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={onSaved} />
    </QueryClientProvider>,
  )

  await user.type(screen.getByLabelText('物品名称'), '不会丢失的围巾')
  await user.upload(
    screen.getByLabelText('物品图片（可选）'),
    new File(['image'], 'scarf.webp', { type: 'image/webp' }),
  )
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('已保留填写内容')
  expect(screen.getByLabelText('物品名称')).toHaveValue('不会丢失的围巾')
  await user.click(screen.getByRole('button', { name: '重试上传' }))

  expect(mockCreateItem).toHaveBeenCalledOnce()
  expect(mockUpload).toHaveBeenCalledTimes(2)
  expect(onSaved).toHaveBeenCalledOnce()
})
