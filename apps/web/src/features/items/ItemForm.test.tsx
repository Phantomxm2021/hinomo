import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type PropsWithChildren } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n/I18nProvider'
import { ItemForm } from './ItemForm'

const { mockCreateItem, mockUpdateItem, mockUpload } = vi.hoisted(() => ({
  mockCreateItem: vi.fn(),
  mockUpdateItem: vi.fn(),
  mockUpload: vi.fn(),
}))
vi.mock('./items.api', () => ({ createItem: mockCreateItem, updateItem: mockUpdateItem }))
vi.mock('../media/useMediaUpload', () => ({
  useMediaUpload: () => ({ stage: 'idle', upload: mockUpload, reset: vi.fn() }),
}))
vi.mock('../media/AuthorizedImage', () => ({
  AuthorizedImage: ({ alt }: { alt: string }) => <img alt={alt} src="signed:image" />,
}))
beforeEach(() => {
  mockCreateItem.mockReset()
  mockUpdateItem.mockReset()
  mockUpload.mockReset()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:item-preview'), revokeObjectURL: vi.fn() })
})
afterEach(cleanup)

test('reports busy while a new item is being created and clears it after saving', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  const onBusyChange = vi.fn()
  let resolveCreate: (item: { id: string }) => void = () => undefined
  mockCreateItem.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve }))
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} onBusyChange={onBusyChange} />
    </QueryClientProvider>,
  )

  await user.type(screen.getByLabelText('物品名称'), '围巾')
  await user.click(screen.getByRole('button', { name: '保存' }))

  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true))
  resolveCreate({ id: 'item-1' })
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
})

test('keeps delete and cancel unavailable while saving an existing item', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  const onDelete = vi.fn()
  mockUpdateItem.mockImplementation(() => new Promise(() => undefined))
  render(
    <QueryClientProvider client={client}>
      <ItemForm
        boxId="box-1"
        item={{ id: 'item-1', name: '锤子', category: null, quantity: 1, description: null }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
        onDelete={onDelete}
      />
    </QueryClientProvider>,
  )

  await user.click(screen.getByRole('button', { name: '保存' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '删除物品' })).toBeDisabled())
  expect(screen.getByRole('button', { name: '取消' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '删除物品' }))

  expect(onDelete).not.toHaveBeenCalled()
})

test('omits the form heading when it is rendered inside an editor dialog', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} showHeading={false} />
    </QueryClientProvider>,
  )

  expect(screen.queryByRole('heading', { name: '新增物品' })).not.toBeInTheDocument()
})

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

  const labels = screen.getAllByText(/物品名称|分类|数量|描述/)
  expect(labels.map((label) => label.textContent)).toEqual([
    '物品名称',
    '分类（可选）',
    '数量',
    '描述（可选）',
  ])
})

test('shows the existing item image in the cover control', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" item={{ id: 'item-1', name: '锤子', category: null, quantity: 1, description: null, image_object_key: 'items/item-1.webp' }} onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  expect(screen.getByRole('img', { name: '锤子图片预览' })).toBeInTheDocument()
})

test('removes an existing image from the cover when the form is saved', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  mockUpdateItem.mockResolvedValue(undefined)
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" item={{ id: 'item-1', name: '锤子', category: null, quantity: 1, description: null, image_object_key: 'items/item-1.webp' }} onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  await user.click(screen.getByRole('button', { name: '删除物品图片' }))
  expect(screen.getByRole('button', { name: '添加物品图片' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(mockUpdateItem).toHaveBeenCalledWith('item-1', expect.objectContaining({ image_object_key: null }))
})

test('keeps the native image picker hidden behind the cover control', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  expect(screen.getByRole('button', { name: '添加物品图片' })).toBeInTheDocument()
  expect(screen.getByLabelText('选择物品图片')).toHaveClass('sr-only')
})

test('shows a local preview after choosing an item image', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} />
    </QueryClientProvider>,
  )

  await user.upload(screen.getByLabelText('选择物品图片'), new File(['image'], 'hammer.webp', { type: 'image/webp' }))
  expect(screen.getByRole('img', { name: '待上传物品图片预览' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除待上传图片' })).toBeInTheDocument()
})

test('keeps mobile actions above the public-page safe area', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm boxId="box-1" onSaved={vi.fn()} onCancel={vi.fn()} />
    </QueryClientProvider>,
  )

  const save = screen.getByRole('button', { name: '保存' })
  const cancel = screen.getByRole('button', { name: '取消' })
  expect(save.parentElement).toHaveClass(
    'fixed',
    'inset-x-4',
    'min-[360px]:inset-x-5',
    'bottom-[max(1rem,var(--safe-area-bottom))]',
    'lg:static',
  )
  expect(save).toHaveClass('min-h-12')
  expect(cancel).toHaveClass('min-h-11')
})

test('offers deletion from the edit form', async () => {
  const user = userEvent.setup()
  const onDelete = vi.fn()
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ItemForm
        boxId="box-1"
        item={{ id: 'item-1', name: '锤子', category: null, quantity: 1, description: null }}
        onSaved={vi.fn()}
        onDelete={onDelete}
      />
    </QueryClientProvider>,
  )

  await user.click(screen.getByRole('button', { name: '删除物品' }))
  expect(onDelete).toHaveBeenCalledOnce()
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
  await user.upload(screen.getByLabelText('选择物品图片'), file)
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
    screen.getByLabelText('选择物品图片'),
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

test('localizes item form controls and validation in English', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }
  render(
    <I18nProvider>
      <EnglishProvider>
        <QueryClientProvider client={client}>
          <ItemForm boxId="box-1" onSaved={vi.fn()} onCancel={vi.fn()} />
        </QueryClientProvider>
      </EnglishProvider>
    </I18nProvider>,
  )

  expect(screen.getByRole('heading', { name: 'Add item' })).toBeInTheDocument()
  expect(screen.getByLabelText('Item name')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByText('Enter an item name')).toBeInTheDocument()
})

test('refreshes item validation messages when the locale changes', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  function LocaleHarness({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('zh-CN'), [setLocale])
    return (
      <>
        <button type="button" onClick={() => setLocale('en-US')}>Use English</button>
        {children}
      </>
    )
  }
  render(
    <I18nProvider>
      <LocaleHarness>
        <QueryClientProvider client={client}>
          <ItemForm boxId="box-1" onSaved={vi.fn()} />
        </QueryClientProvider>
      </LocaleHarness>
    </I18nProvider>,
  )

  await user.click(screen.getByRole('button', { name: '保存' }))
  expect(await screen.findByText('请输入物品名称')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Use English' }))
  expect(await screen.findByText('Enter an item name')).toBeInTheDocument()
})

test('localizes an item save error in English', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  mockCreateItem.mockRejectedValueOnce(new Error('save failed'))
  function EnglishProvider({ children }: PropsWithChildren) {
    const { setLocale } = useI18n()
    useEffect(() => setLocale('en-US'), [setLocale])
    return <>{children}</>
  }
  render(
    <I18nProvider>
      <EnglishProvider>
        <QueryClientProvider client={client}>
          <ItemForm boxId="box-1" onSaved={vi.fn()} />
        </QueryClientProvider>
      </EnglishProvider>
    </I18nProvider>,
  )

  await user.type(screen.getByLabelText('Item name'), 'Camera')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Please try again later.')
})
