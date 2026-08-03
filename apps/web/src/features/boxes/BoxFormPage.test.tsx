import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxFormPage } from './BoxFormPage'
import { BoxForm } from './BoxForm'

const { mockCreateBox, mockGetBox, mockListSpaces, mockBoxQrPng, mockUpdateBox, mockUpload, mockUploadReset } = vi.hoisted(() => ({
  mockCreateBox: vi.fn(),
  mockGetBox: vi.fn(),
  mockListSpaces: vi.fn(),
  mockBoxQrPng: vi.fn(),
  mockUpdateBox: vi.fn(),
  mockUpload: vi.fn(),
  mockUploadReset: vi.fn(),
}))

vi.mock('./boxes.api', () => ({
  createBox: mockCreateBox,
  getBox: mockGetBox,
  updateBox: mockUpdateBox,
}))
vi.mock('../spaces/spaces.api', () => ({ listSpaces: mockListSpaces }))
vi.mock('../qr-print/qr', () => ({
  boxQrUrl: (_origin: string, publicId: string) => `https://nomo.test/b/${publicId}`,
  boxQrPng: mockBoxQrPng,
}))
vi.mock('../media/useMediaUpload', () => ({
  useMediaUpload: () => ({ stage: 'idle', upload: mockUpload, reset: mockUploadReset }),
}))

function renderBoxForm(initialEntry = '/app/boxes/new', client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/app/boxes/new" element={<BoxFormPage />} />
          <Route path="/app/boxes/:boxId/edit" element={<BoxFormPage />} />
        </Routes>
        <BoxNavigationControls />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

function BoxNavigationControls() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/app/boxes/box-2/edit')}>切换箱子</button>
}

function renderModalBoxForm(onCompleted = vi.fn(), onBusyChange?: (busy: boolean) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <BoxForm presentation="modal" onCompleted={onCompleted} onBusyChange={onBusyChange} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

test('uses compact mobile page titles with a desktop scale-up', async () => {
  mockListSpaces.mockResolvedValue([])
  renderBoxForm()

  const heading = await screen.findByRole('heading', { name: '创建箱子' })
  expect(heading).toHaveClass('text-page-title', 'font-extrabold')
})

test('shows a form-shaped skeleton while spaces are loading', () => {
  mockListSpaces.mockReturnValue(new Promise(() => undefined))
  renderBoxForm()

  expect(screen.getByRole('status', { name: '正在加载箱子表单' })).toBeInTheDocument()
  expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(2)
  expect(screen.queryByText('正在加载空间…')).not.toBeInTheDocument()
})

test('omits independent page framing inside a modal', async () => {
  mockListSpaces.mockResolvedValue([])
  renderModalBoxForm()

  await screen.findByRole('button', { name: '创建箱子' })
  expect(screen.queryByRole('heading', { name: '创建箱子' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '创建箱子' }).closest('form')).not.toHaveClass('rounded-shell', 'p-5')
})

test('keeps mobile creation focused on essential fields and progressively reveals more settings', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '储藏室', description: null, box_count: 0 },
  ])
  renderModalBoxForm()

  await screen.findByRole('option', { name: '储藏室' })
  expect(screen.getByLabelText('空间')).toBeInTheDocument()
  expect(screen.getByLabelText('箱子名称')).toBeInTheDocument()
  expect(screen.getByLabelText('具体位置')).toBeInTheDocument()
  const advancedFields = document.getElementById('box-advanced-fields')
  const toggle = screen.getByRole('button', { name: '更多设置' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(advancedFields).toHaveClass('hidden', 'sm:contents')

  await user.click(toggle)
  expect(screen.getByRole('button', { name: '收起更多设置' })).toHaveAttribute('aria-expanded', 'true')
  expect(advancedFields).toHaveClass('contents', 'sm:contents')
  expect(screen.getByLabelText('分类（可选）')).toBeInTheDocument()
  expect(screen.getByLabelText('箱子封面（可选）')).toBeInTheDocument()
})

beforeEach(() => {
  mockCreateBox.mockReset()
  mockGetBox.mockReset()
  mockListSpaces.mockReset()
  mockBoxQrPng.mockReset()
  mockUpdateBox.mockReset()
  mockUpload.mockReset()
  mockUploadReset.mockReset()
})

test('uploads a selected cover before completing box creation', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  mockCreateBox.mockResolvedValue({
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  })
  mockUpload.mockResolvedValue('boxes/box-1/cover.webp')
  mockBoxQrPng.mockResolvedValue('data:image/png;base64,qr')
  renderModalBoxForm(onCompleted)

  await screen.findByRole('option', { name: '家' })
  await user.selectOptions(screen.getByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '冬季衣物')
  const file = new File(['cover'], 'cover.png', { type: 'image/png' })
  await user.upload(screen.getByLabelText('箱子封面（可选）'), file)
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(mockUpload).toHaveBeenCalledWith({
    file, boxId: 'box-1', itemId: null, kind: 'cover',
  })
  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith({
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  }))
  expect(mockBoxQrPng).not.toHaveBeenCalled()
})

test('keeps a created box and selected cover available when upload fails, then retries without creating twice', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  const box = { id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物' }
  mockCreateBox.mockResolvedValue(box)
  mockUpload.mockRejectedValueOnce(new Error('upload failed')).mockResolvedValueOnce('boxes/box-1/cover.webp')
  renderModalBoxForm(onCompleted)

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '冬季衣物')
  const file = new File(['cover'], 'cover.png', { type: 'image/png' })
  await user.upload(screen.getByLabelText('箱子封面（可选）'), file)
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('箱子记录已创建，但封面未完成')
  expect(onCompleted).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '创建箱子' })).not.toBeInTheDocument()
  fireEvent.submit(screen.getByRole('button', { name: '重试上传' }).closest('form')!)
  expect(mockCreateBox).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: '重试上传' }))

  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(box))
  expect(mockCreateBox).toHaveBeenCalledTimes(1)
  expect(mockUpload).toHaveBeenCalledTimes(2)
  expect(mockUpload).toHaveBeenLastCalledWith({ file, boxId: 'box-1', itemId: null, kind: 'cover' })
})

test('uploads a replacement cover to the pending box without creating another record', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  const box = { id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物' }
  mockCreateBox.mockResolvedValue(box)
  mockUpload.mockRejectedValueOnce(new Error('upload failed')).mockResolvedValueOnce('boxes/box-1/cover.webp')
  renderModalBoxForm(onCompleted)

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '冬季衣物')
  await user.upload(screen.getByLabelText('箱子封面（可选）'), new File(['old'], 'old.png', { type: 'image/png' }))
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  await screen.findByText('箱子记录已创建，但封面未完成。')

  const replacement = new File(['new'], 'new.png', { type: 'image/png' })
  await user.upload(screen.getByLabelText('箱子封面（可选）'), replacement)

  expect(screen.queryByRole('button', { name: '创建箱子' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '上传封面' }))

  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(box))
  expect(mockCreateBox).toHaveBeenCalledTimes(1)
  expect(mockUpload).toHaveBeenLastCalledWith({
    file: replacement, boxId: 'box-1', itemId: null, kind: 'cover',
  })
})

test('can finish a pending box without its failed cover upload', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  const onBusyChange = vi.fn()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  const box = { id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物' }
  mockCreateBox.mockResolvedValue(box)
  mockUpload.mockRejectedValue(new Error('upload failed'))
  renderModalBoxForm(onCompleted, onBusyChange)

  await user.selectOptions(await screen.findByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '冬季衣物')
  await user.upload(screen.getByLabelText('箱子封面（可选）'), new File(['cover'], 'cover.png', { type: 'image/png' }))
  await user.click(screen.getByRole('button', { name: '创建箱子' }))
  await screen.findByText('箱子记录已创建，但封面未完成。')
  expect(onBusyChange).toHaveBeenLastCalledWith(true)
  await user.click(screen.getByRole('button', { name: '暂不上传封面' }))

  expect(onCompleted).toHaveBeenCalledWith(box)
  expect(mockCreateBox).toHaveBeenCalledTimes(1)
  expect(mockUpload).toHaveBeenCalledTimes(1)
})

test('offers a retry when spaces cannot be loaded', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(new Promise(() => undefined))
  renderBoxForm()

  expect(await screen.findByRole('alert')).toHaveTextContent('空间加载失败')
  await user.click(screen.getByRole('button', { name: '重试' }))
  expect(mockListSpaces).toHaveBeenCalledTimes(2)
})

test('keeps form values visible when cached spaces fail to refetch', async () => {
  const user = userEvent.setup()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['spaces'], [
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  mockListSpaces.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(new Promise(() => undefined))
  renderBoxForm('/app/boxes/new', client)

  await user.selectOptions(screen.getByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '保留中的填写')
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('空间刷新失败，正在显示上次结果')
  expect(screen.getByLabelText('箱子名称')).toHaveValue('保留中的填写')
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  const retrying = within(alert).getByRole('button', { name: '重试中…' })
  expect(retrying).toBeDisabled()
  expect(retrying).toHaveAttribute('aria-busy', 'true')
  await user.click(retrying)
  expect(mockListSpaces).toHaveBeenCalledTimes(2)
})

test('keeps edited values visible when the cached box fails to refetch', async () => {
  const user = userEvent.setup()
  const cachedBox = {
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', space_id: 'space-home',
    name: '旧名称', category: null, location: null, description: null, visibility: 'private',
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['spaces'], [
    { id: 'space-home', name: '家', description: null, box_count: 1 },
  ])
  client.setQueryData(['box-edit', 'box-1'], cachedBox)
  mockListSpaces.mockResolvedValue(client.getQueryData(['spaces']))
  mockGetBox.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(new Promise(() => undefined))
  renderBoxForm('/app/boxes/box-1/edit', client)

  const nameInput = await screen.findByDisplayValue('旧名称')
  await user.clear(nameInput)
  await user.type(nameInput, '用户未保存的名称')
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('箱子刷新失败，正在显示上次内容')
  expect(nameInput).toHaveValue('用户未保存的名称')
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  const retrying = within(alert).getByRole('button', { name: '重试中…' })
  expect(retrying).toBeDisabled()
  expect(retrying).toHaveAttribute('aria-busy', 'true')
  await user.click(retrying)
  expect(mockGetBox).toHaveBeenCalledTimes(2)
})

test('clears saved state and a selected cover when switching boxes', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([{ id: 'space-home', name: '家', description: null, box_count: 2 }])
  mockGetBox.mockImplementation(async (id: string) => ({
    id, public_id: `public-${id}`, box_code: id === 'box-1' ? 'BX-00001' : 'BX-00002',
    space_id: 'space-home', name: id === 'box-1' ? '第一个箱子' : '第二个箱子',
    category: null, location: null, description: null, visibility: 'private',
  }))
  mockUpdateBox.mockResolvedValue(undefined)
  mockUpload.mockResolvedValue('cover.webp')
  renderBoxForm('/app/boxes/box-1/edit')

  await screen.findByDisplayValue('第一个箱子')
  const cover = new File(['cover'], 'box-1.png', { type: 'image/png' })
  await user.upload(screen.getByLabelText('箱子封面（可选）'), cover)
  await user.click(screen.getByRole('button', { name: '保存修改' }))
  expect(await screen.findByText('修改已保存')).toBeInTheDocument()
  expect(mockUpload).toHaveBeenCalledWith({ file: cover, boxId: 'box-1', itemId: null, kind: 'cover' })

  await user.click(screen.getByRole('button', { name: '切换箱子' }))
  expect(await screen.findByDisplayValue('第二个箱子')).toBeInTheDocument()
  expect(screen.queryByText('修改已保存')).not.toBeInTheDocument()
  expect(screen.getByLabelText('箱子封面（可选）')).toHaveValue('')
  await user.click(screen.getByRole('button', { name: '保存修改' }))
  await waitFor(() => expect(mockUpdateBox).toHaveBeenLastCalledWith('box-2', expect.any(Object)))
  expect(mockUpload).toHaveBeenCalledTimes(1)
})

test('preserves user edits when retrying a cached box returns a new object', async () => {
  const user = userEvent.setup()
  const cachedBox = {
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', space_id: 'space-home',
    name: '缓存名称', category: null, location: null, description: null, visibility: 'private',
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['spaces'], [
    { id: 'space-home', name: '家', description: null, box_count: 1 },
  ])
  client.setQueryData(['box-edit', 'box-1'], cachedBox)
  mockListSpaces.mockResolvedValue(client.getQueryData(['spaces']))
  mockGetBox
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce({ ...cachedBox, name: '服务端新名称' })
  renderBoxForm('/app/boxes/box-1/edit', client)

  const nameInput = await screen.findByDisplayValue('缓存名称')
  await user.clear(nameInput)
  await user.type(nameInput, '用户未保存的名称')
  await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: '重试' }))

  await waitFor(() => expect(mockGetBox).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByText('箱子刷新失败，正在显示上次内容')).not.toBeInTheDocument())
  expect(nameInput).toHaveValue('用户未保存的名称')
})

test('initializes the form again when the route switches to another box id', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 2 },
  ])
  mockGetBox.mockImplementation(async (id: string) => ({
    id,
    public_id: `public-${id}`,
    box_code: id === 'box-1' ? 'BX-00001' : 'BX-00002',
    space_id: 'space-home',
    name: id === 'box-1' ? '第一个箱子' : '第二个箱子',
    category: null,
    location: null,
    description: null,
    visibility: 'private',
  }))
  renderBoxForm('/app/boxes/box-1/edit')

  expect(await screen.findByDisplayValue('第一个箱子')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '切换箱子' }))
  expect(await screen.findByDisplayValue('第二个箱子')).toBeInTheDocument()
})

test('edits mutable fields without sending database identifiers', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 1 },
  ])
  mockGetBox.mockResolvedValue({
    id: 'box-1',
    public_id: 'public-1',
    box_code: 'BX-00001',
    space_id: 'space-home',
    name: '旧名称',
    category: null,
    location: null,
    description: null,
    visibility: 'private',
  })
  mockUpdateBox.mockResolvedValue(undefined)
  renderBoxForm('/app/boxes/box-1/edit')

  const nameInput = await screen.findByDisplayValue('旧名称')
  await user.clear(nameInput)
  await user.type(nameInput, '新名称')
  await user.click(screen.getByRole('button', { name: '保存修改' }))

  expect(mockUpdateBox).toHaveBeenCalledWith('box-1', {
    space_id: 'space-home',
    name: '新名称',
    category: null,
    location: null,
    description: null,
    visibility: 'private',
  })
  expect(await screen.findByRole('status')).toHaveTextContent('修改已保存')
})

afterEach(cleanup)

test('completes a coverless private box without generating or presenting QR output', async () => {
  const user = userEvent.setup()
  const onCompleted = vi.fn()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  mockCreateBox.mockResolvedValue({
    id: 'box-1',
    public_id: 'public-1',
    box_code: 'BX-00001',
    name: '冬季衣物',
  })
  renderModalBoxForm(onCompleted)

  await screen.findByRole('option', { name: '家' })
  await user.selectOptions(screen.getByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '冬季衣物')
  await user.type(screen.getByLabelText('具体位置'), '卧室衣柜上层')
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(mockCreateBox).toHaveBeenCalledWith({
    space_id: 'space-home',
    name: '冬季衣物',
    category: null,
    location: '卧室衣柜上层',
    description: null,
    visibility: 'private',
  })
  await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1))
  expect(onCompleted).toHaveBeenCalledWith({
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  })
  expect(mockBoxQrPng).not.toHaveBeenCalled()
  expect(screen.queryByRole('img', { name: /二维码/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /\/b\// })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '重新生成' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '下载 PNG' })).not.toBeInTheDocument()
  expect(mockUpdateBox).not.toHaveBeenCalled()
})
