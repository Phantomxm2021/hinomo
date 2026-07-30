import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PrintPage } from './PrintPage'

const { mockBoxQrPng, mockListBoxes, mockRenderLabelsPdf } = vi.hoisted(() => ({
  mockBoxQrPng: vi.fn(),
  mockListBoxes: vi.fn(),
  mockRenderLabelsPdf: vi.fn(),
}))
vi.mock('../boxes/boxes.api', () => ({ listBoxes: mockListBoxes }))
vi.mock('./qr', () => ({
  boxQrPng: mockBoxQrPng,
  boxQrUrl: (origin: string, publicId: string) => `${origin.replace(/\/+$/, '')}/b/${publicId}`,
}))
vi.mock('./pdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./pdf')>()
  return { ...actual, renderLabelsPdf: mockRenderLabelsPdf }
})

const boxes = [{
  id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  space_id: 'space-1', space_name: '家', location: '衣柜上层', visibility: 'private',
  cover_object_key: null, item_count: 8, updated_at: '2026-07-29T10:00:00Z',
}, {
  id: 'box-2', public_id: 'public-2', box_code: 'BX-00002', name: '露营装备',
  space_id: 'space-2', space_name: '储藏室', location: '北侧', visibility: 'public',
  cover_object_key: null, item_count: 4, updated_at: '2026-07-28T10:00:00Z',
}]

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function renderPrint() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><PrintPage /></QueryClientProvider>)
}

beforeEach(() => {
  mockListBoxes.mockReset().mockResolvedValue(boxes)
  mockRenderLabelsPdf.mockReset().mockResolvedValue(undefined)
  mockBoxQrPng.mockReset().mockResolvedValue('data:image/png;base64,qr')
})

afterEach(cleanup)

test('provides a desktop multi-select workspace and a real QR preview', async () => {
  const user = userEvent.setup()
  renderPrint()

  const desktop = screen.getByRole('region', { name: '批量标签工作台' })
  expect(within(desktop).getByText('已选择 0 个')).toBeInTheDocument()
  expect(within(desktop).getByText('标签预览')).toBeInTheDocument()
  await user.click(await within(desktop).findByRole('checkbox', { name: /冬季衣物/ }))

  expect(within(desktop).getByText('已选择 1 个')).toBeInTheDocument()
  expect(within(desktop).getByText('BX-00001')).toBeInTheDocument()
  expect(within(desktop).getByText('家 · 衣柜上层')).toBeInTheDocument()
  expect(await within(desktop).findByRole('img', { name: '二维码标签预览' })).toHaveAttribute('src', 'data:image/png;base64,qr')
  expect(mockBoxQrPng).toHaveBeenCalledWith(expect.stringMatching(/\/b\/public-1$/))
})

test('keeps desktop PDF download, progress, and error behavior', async () => {
  const user = userEvent.setup()
  mockRenderLabelsPdf.mockImplementation(async (_labels, onProgress) => {
    onProgress?.(1, 1)
    throw new Error('failed')
  })
  renderPrint()

  const desktop = screen.getByRole('region', { name: '批量标签工作台' })
  const generate = within(desktop).getByRole('button', { name: '生成 PDF' })
  expect(generate).toBeDisabled()
  await user.click(await within(desktop).findByRole('checkbox', { name: /冬季衣物/ }))
  await user.click(generate)

  expect(mockRenderLabelsPdf).toHaveBeenCalledOnce()
  expect(await screen.findByText('二维码渲染进度：1/1')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('PDF 生成失败，请重试')
})

test('uses a separate mobile single-label choice without multi-select controls', async () => {
  const user = userEvent.setup()
  renderPrint()

  const mobile = screen.getByRole('region', { name: '单个标签' })
  expect(within(mobile).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(within(mobile).getByRole('button', { name: '下载单个标签' })).toBeDisabled()
  await user.click(await within(mobile).findByRole('radio', { name: /冬季衣物/ }))
  expect(within(mobile).getByRole('button', { name: '下载单个标签' })).toBeEnabled()
})

test('never pairs a previous or stale QR image with newly selected metadata', async () => {
  const user = userEvent.setup()
  const initialSecondQr = deferred<string>()
  const firstQr = deferred<string>()
  const refreshedSecondQr = deferred<string>()
  mockBoxQrPng
    .mockImplementationOnce(() => initialSecondQr.promise)
    .mockImplementationOnce(() => firstQr.promise)
    .mockImplementationOnce(() => refreshedSecondQr.promise)
  renderPrint()
  const desktop = screen.getByRole('region', { name: '批量标签工作台' })

  await user.click(await within(desktop).findByRole('checkbox', { name: /露营装备/ }))
  await act(() => { initialSecondQr.resolve('data:image/png;base64,second-old') })
  expect(within(desktop).getByRole('img', { name: '二维码标签预览' })).toHaveAttribute('src', 'data:image/png;base64,second-old')

  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  expect(within(desktop).getByText('BX-00001')).toBeInTheDocument()
  expect(within(desktop).queryByRole('img', { name: '二维码标签预览' })).not.toBeInTheDocument()
  expect(within(desktop).getByText('正在生成二维码…')).toBeInTheDocument()

  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  expect(within(desktop).getByText('BX-00002')).toBeInTheDocument()
  await act(() => { firstQr.resolve('data:image/png;base64,stale-first') })
  expect(within(desktop).queryByRole('img', { name: '二维码标签预览' })).not.toBeInTheDocument()

  await act(() => { refreshedSecondQr.resolve('data:image/png;base64,second-new') })
  expect(within(desktop).getByRole('img', { name: '二维码标签预览' })).toHaveAttribute('src', 'data:image/png;base64,second-new')
})
