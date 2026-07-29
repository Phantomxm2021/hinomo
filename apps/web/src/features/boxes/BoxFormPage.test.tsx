import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { BoxFormPage } from './BoxFormPage'

const { mockCreateBox, mockGetBox, mockListSpaces, mockBoxQrPng, mockUpdateBox, mockUpload } = vi.hoisted(() => ({
  mockCreateBox: vi.fn(),
  mockGetBox: vi.fn(),
  mockListSpaces: vi.fn(),
  mockBoxQrPng: vi.fn(),
  mockUpdateBox: vi.fn(),
  mockUpload: vi.fn(),
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
  useMediaUpload: () => ({ stage: 'idle', upload: mockUpload, reset: vi.fn() }),
}))

function renderBoxForm(initialEntry = '/app/boxes/new') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/app/boxes/new" element={<BoxFormPage />} />
          <Route path="/app/boxes/:boxId/edit" element={<BoxFormPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockCreateBox.mockReset()
  mockGetBox.mockReset()
  mockListSpaces.mockReset()
  mockBoxQrPng.mockReset()
  mockUpdateBox.mockReset()
  mockUpload.mockReset()
})

test('uploads a selected cover after creating the box', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  mockCreateBox.mockResolvedValue({
    id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  })
  mockUpload.mockResolvedValue('boxes/box-1/cover.webp')
  mockBoxQrPng.mockResolvedValue('data:image/png;base64,qr')
  renderBoxForm()

  await screen.findByRole('option', { name: '家' })
  await user.selectOptions(screen.getByLabelText('空间'), 'space-home')
  await user.type(screen.getByLabelText('箱子名称'), '冬季衣物')
  const file = new File(['cover'], 'cover.png', { type: 'image/png' })
  await user.upload(screen.getByLabelText('箱子封面（可选）'), file)
  await user.click(screen.getByRole('button', { name: '创建箱子' }))

  expect(mockUpload).toHaveBeenCalledWith({
    file, boxId: 'box-1', itemId: null, kind: 'cover',
  })
  expect(await screen.findByText('BX-00001')).toBeInTheDocument()
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

test('creates a private box inside the chosen space by default', async () => {
  const user = userEvent.setup()
  mockListSpaces.mockResolvedValue([
    { id: 'space-home', name: '家', description: null, box_count: 0 },
  ])
  mockCreateBox.mockResolvedValue({
    id: 'box-1',
    public_id: 'public-1',
    box_code: 'BX-00001',
    name: '冬季衣物',
  })
  mockBoxQrPng.mockResolvedValue('data:image/png;base64,qr')
  renderBoxForm()

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
  expect(await screen.findByText('BX-00001')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '重新生成' }))
  expect(mockBoxQrPng).toHaveBeenCalledTimes(2)
  expect(mockUpdateBox).not.toHaveBeenCalled()
})
