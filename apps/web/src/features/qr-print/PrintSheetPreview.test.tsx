import { Suspense, startTransition, useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { BoxSummary } from '../boxes/boxes.api'
import { PrintSheetPreview } from './PrintSheetPreview'

const { mockBoxQrPng } = vi.hoisted(() => ({ mockBoxQrPng: vi.fn() }))

vi.mock('./qr', () => ({
  boxQrPng: mockBoxQrPng,
  boxQrUrl: (origin: string, publicId: string) => `${origin.replace(/\/+$/, '')}/b/${publicId}`,
}))

function box(index: number, overrides: Partial<BoxSummary> = {}): BoxSummary {
  return {
    id: `box-${index}`,
    public_id: `public-${index}`,
    box_code: `BX-${String(index).padStart(5, '0')}`,
    name: `箱子 ${index}`,
    space_id: 'space-1',
    space_name: '家',
    location: index % 2 ? '衣柜上层' : null,
    visibility: 'private',
    cover_object_key: null,
    item_count: index,
    updated_at: '2026-07-29T10:00:00Z',
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  mockBoxQrPng.mockReset().mockImplementation((url: string) => Promise.resolve(`data:${url}`))
})

afterEach(cleanup)

test('paginates nine labels over two A4 sheets', async () => {
  const boxes = Array.from({ length: 9 }, (_, index) => box(index + 1))
  render(<PrintSheetPreview boxes={boxes} mode="a4" />)

  const preview = screen.getByRole('region', { name: 'A4 标签预览' })
  expect(within(preview).getByRole('heading', { name: 'A4 标签预览' })).toBeInTheDocument()
  expect(within(preview).getByText('共 2 页 · 9 张标签')).toBeInTheDocument()
  expect(within(preview).getAllByTestId('a4-sheet')).toHaveLength(2)
  expect(within(preview).getAllByRole('group')).toHaveLength(9)
  expect(within(preview).getByRole('group', { name: '箱子 9标签' })).toBeInTheDocument()

  const firstSheet = within(preview).getAllByTestId('a4-sheet')[0]
  expect(firstSheet).toHaveClass('aspect-[210/297]', 'w-full', 'max-w-[42rem]', 'grid', 'grid-cols-2', 'grid-rows-4', 'bg-surface', 'shadow-soft')
  const stage = firstSheet.parentElement?.parentElement
  expect(stage).toHaveClass('bg-canvas', 'overflow-auto')
  expect(firstSheet.parentElement?.className).not.toMatch(/\bmin-w-/)
  expect(stage?.className).not.toMatch(/\bmin-w-/)
  const firstLabel = within(preview).getByRole('group', { name: '箱子 1标签' })
  expect(firstLabel).toHaveClass('min-w-0', 'overflow-hidden')
  expect(firstLabel.className).not.toMatch(/\bshadow/)
})

test('renders label metadata in order and generates its QR from the public URL', async () => {
  const qr = deferred<string>()
  mockBoxQrPng.mockReturnValueOnce(qr.promise)
  render(<PrintSheetPreview boxes={[box(1, { name: '冬季衣物', box_code: 'BX-00001' })]} mode="a4" />)

  const label = screen.getByRole('group', { name: '冬季衣物标签' })
  expect(within(label).getByText('正在生成二维码…')).toBeInTheDocument()
  expect(label).toHaveTextContent('冬季衣物BX-00001家 · 衣柜上层扫码查看箱内物品')
  expect(mockBoxQrPng).toHaveBeenCalledWith('http://localhost:5173/b/public-1')

  await act(async () => {
    qr.resolve('data:image/png;base64,first')
    await qr.promise
  })
  expect(within(label).getByRole('img', { name: '冬季衣物二维码' }))
    .toHaveAttribute('src', 'data:image/png;base64,first')
})

test('uses compact base density for A4 labels and comfortable density for single labels', () => {
  mockBoxQrPng.mockReturnValue(new Promise(() => {}))
  const sheetView = render(<PrintSheetPreview boxes={[box(1)]} mode="a4" />)

  const sheetLabel = screen.getByRole('group', { name: '箱子 1标签' })
  expect(sheetLabel).toHaveClass('p-1.5', 'xl:p-3')
  expect(sheetLabel.firstElementChild).toHaveClass(
    'grid-cols-[minmax(2.75rem,0.65fr)_minmax(0,1.35fr)]',
    'gap-1.5',
    'xl:grid-cols-[minmax(4.5rem,0.8fr)_minmax(0,1.2fr)]',
    'xl:gap-3',
  )
  expect(within(sheetLabel).getByRole('heading', { name: '箱子 1' })).toHaveClass('text-[0.625rem]', 'xl:text-base')
  expect(within(sheetLabel).getByText('扫码查看箱内物品')).toHaveClass('hidden', 'xl:block')

  sheetView.unmount()
  render(<PrintSheetPreview boxes={[box(1)]} mode="single" />)

  const singleLabel = screen.getByRole('group', { name: '箱子 1标签' })
  expect(singleLabel).toHaveClass('p-3')
  expect(singleLabel).not.toHaveClass('p-1.5', 'xl:p-3')
  expect(singleLabel.firstElementChild).toHaveClass(
    'grid-cols-[minmax(4.5rem,0.8fr)_minmax(0,1.2fr)]',
    'gap-3',
  )
  expect(within(singleLabel).getByText('扫码查看箱内物品')).not.toHaveClass('hidden', 'xl:block')
})

test('keeps a failed QR local to its label while another succeeds', async () => {
  const failed = deferred<string>()
  const ready = deferred<string>()
  mockBoxQrPng.mockReturnValueOnce(failed.promise).mockReturnValueOnce(ready.promise)
  render(<PrintSheetPreview boxes={[box(1), box(2)]} mode="a4" />)

  await act(async () => {
    failed.reject(new Error('QR failed'))
    ready.resolve('data:image/png;base64,second')
    await Promise.all([failed.promise.catch(() => undefined), ready.promise])
  })

  expect(within(screen.getByRole('group', { name: '箱子 1标签' })).getByText('二维码预览生成失败')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: '箱子 2标签' })).getByRole('img', { name: '箱子 2二维码' }))
    .toHaveAttribute('src', 'data:image/png;base64,second')
})

test('never shows a stale QR after rapidly switching boxes', async () => {
  const first = deferred<string>()
  const second = deferred<string>()
  mockBoxQrPng.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const view = render(<PrintSheetPreview boxes={[box(1)]} mode="single" />)

  view.rerender(<PrintSheetPreview boxes={[box(2)]} mode="single" />)
  await act(async () => {
    first.resolve('data:image/png;base64,stale')
    await first.promise
  })
  const current = screen.getByRole('group', { name: '箱子 2标签' })
  expect(within(current).queryByRole('img')).not.toBeInTheDocument()
  expect(within(current).getByText('正在生成二维码…')).toBeInTheDocument()

  await act(async () => {
    second.resolve('data:image/png;base64,current')
    await second.promise
  })
  expect(within(current).getByRole('img', { name: '箱子 2二维码' }))
    .toHaveAttribute('src', 'data:image/png;base64,current')
})

test('keeps the committed QR identity when a speculative transition is suspended', async () => {
  const firstQr = deferred<string>()
  const suspended = deferred<void>()
  const renderedSuspendingSibling = vi.fn()
  mockBoxQrPng.mockReturnValueOnce(firstQr.promise)

  function Suspender({ active }: { active: boolean }) {
    if (active) {
      renderedSuspendingSibling()
      throw suspended.promise
    }
    return null
  }

  function Harness() {
    const [current, setCurrent] = useState(box(1))
    return (
      <>
        <button type="button" onClick={() => startTransition(() => setCurrent(box(2)))}>切换</button>
        <Suspense fallback={<p>切换中</p>}>
          <PrintSheetPreview boxes={[current]} mode="single" />
          <Suspender active={current.id === 'box-2'} />
        </Suspense>
      </>
    )
  }

  render(<Harness />)
  expect(screen.getByRole('group', { name: '箱子 1标签' })).toHaveTextContent('正在生成二维码…')

  fireEvent.click(screen.getByRole('button', { name: '切换' }))
  await waitFor(() => expect(renderedSuspendingSibling).toHaveBeenCalled())
  expect(screen.getByRole('group', { name: '箱子 1标签' })).toBeInTheDocument()

  await act(async () => {
    firstQr.resolve('data:image/png;base64,committed-a')
    await firstQr.promise
  })
  expect(await screen.findByRole('img', { name: '箱子 1二维码' }))
    .toHaveAttribute('src', 'data:image/png;base64,committed-a')
})

test('treats a changed public id as a distinct QR identity even when the box id stays the same', async () => {
  const oldQr = deferred<string>()
  const newQr = deferred<string>()
  mockBoxQrPng.mockReturnValueOnce(oldQr.promise).mockReturnValueOnce(newQr.promise)
  const view = render(<PrintSheetPreview boxes={[box(1)]} mode="single" />)

  view.rerender(<PrintSheetPreview boxes={[box(1, { public_id: 'public-new' })]} mode="single" />)
  await act(async () => {
    oldQr.resolve('data:image/png;base64,old')
    await oldQr.promise
  })
  expect(screen.queryByRole('img')).not.toBeInTheDocument()

  await act(async () => {
    newQr.resolve('data:image/png;base64,new')
    await newQr.promise
  })
  expect(screen.getByRole('img', { name: '箱子 1二维码' })).toHaveAttribute('src', 'data:image/png;base64,new')
  expect(mockBoxQrPng).toHaveBeenNthCalledWith(2, 'http://localhost:5173/b/public-new')
})

test('reuses ready QR results when the same boxes are rendered again', async () => {
  const view = render(<PrintSheetPreview boxes={[box(1), box(2)]} mode="a4" />)
  expect(await screen.findByRole('img', { name: '箱子 1二维码' })).toBeInTheDocument()
  expect(await screen.findByRole('img', { name: '箱子 2二维码' })).toBeInTheDocument()
  expect(mockBoxQrPng).toHaveBeenCalledTimes(2)

  view.rerender(<PrintSheetPreview boxes={[box(1), box(2)]} mode="a4" />)
  expect(mockBoxQrPng).toHaveBeenCalledTimes(2)
})

test('generates only a newly added QR when ready cached boxes remain', async () => {
  const view = render(<PrintSheetPreview boxes={[box(1)]} mode="a4" />)
  expect(await screen.findByRole('img', { name: '箱子 1二维码' })).toBeInTheDocument()
  expect(mockBoxQrPng).toHaveBeenCalledOnce()

  view.rerender(<PrintSheetPreview boxes={[box(1), box(2)]} mode="a4" />)
  expect(await screen.findByRole('img', { name: '箱子 2二维码' })).toBeInTheDocument()
  expect(mockBoxQrPng).toHaveBeenCalledTimes(2)
  expect(mockBoxQrPng).toHaveBeenNthCalledWith(2, 'http://localhost:5173/b/public-2')
})

test('retries a failed QR after its identity leaves and returns', async () => {
  mockBoxQrPng.mockRejectedValueOnce(new Error('first attempt failed')).mockResolvedValueOnce('data:image/png;base64,retry')
  const view = render(<PrintSheetPreview boxes={[box(1)]} mode="single" />)
  expect(await screen.findByText('二维码预览生成失败')).toBeInTheDocument()

  view.rerender(<PrintSheetPreview boxes={[]} mode="single" />)
  view.rerender(<PrintSheetPreview boxes={[box(1)]} mode="single" />)

  expect(await screen.findByRole('img', { name: '箱子 1二维码' })).toHaveAttribute('src', 'data:image/png;base64,retry')
  expect(mockBoxQrPng).toHaveBeenCalledTimes(2)
})

test('evicts a ready QR after its identity leaves the preview', async () => {
  mockBoxQrPng.mockResolvedValueOnce('data:image/png;base64,first').mockResolvedValueOnce('data:image/png;base64,second')
  const view = render(<PrintSheetPreview boxes={[box(1)]} mode="single" />)
  expect(await screen.findByRole('img', { name: '箱子 1二维码' })).toHaveAttribute('src', 'data:image/png;base64,first')

  view.rerender(<PrintSheetPreview boxes={[]} mode="single" />)
  view.rerender(<PrintSheetPreview boxes={[box(1)]} mode="single" />)

  expect(await screen.findByRole('img', { name: '箱子 1二维码' })).toHaveAttribute('src', 'data:image/png;base64,second')
  expect(mockBoxQrPng).toHaveBeenCalledTimes(2)
})

test('settles pending QR success and failure safely after unmount', async () => {
  const success = deferred<string>()
  const failure = deferred<string>()
  mockBoxQrPng.mockReturnValueOnce(success.promise).mockReturnValueOnce(failure.promise)
  const view = render(<PrintSheetPreview boxes={[box(1), box(2)]} mode="a4" />)

  view.unmount()
  await expect(act(async () => {
    success.resolve('data:image/png;base64,after-unmount')
    failure.reject(new Error('failed after unmount'))
    await Promise.allSettled([success.promise, failure.promise])
  })).resolves.toBeUndefined()
})

test('shows an empty A4 sheet outline without generating a QR', () => {
  render(<PrintSheetPreview boxes={[]} mode="a4" />)

  const preview = screen.getByRole('region', { name: 'A4 标签预览' })
  expect(within(preview).getByText('共 0 页 · 0 张标签')).toBeInTheDocument()
  const emptySheet = within(preview).getByTestId('a4-sheet')
  expect(emptySheet).toHaveTextContent('选择箱子后将在这里生成 A4 预览')
  expect(emptySheet).toHaveClass('aspect-[210/297]', 'bg-surface', 'shadow-soft')
  expect(within(preview).queryByRole('img')).not.toBeInTheDocument()
  expect(mockBoxQrPng).not.toHaveBeenCalled()
})

test('single mode renders only the first full label without A4 chrome', async () => {
  render(<PrintSheetPreview boxes={[box(1), box(2)]} mode="single" />)

  const preview = screen.getByRole('region', { name: '单个标签预览' })
  expect(within(preview).getByRole('heading', { name: '单个标签预览' })).toBeInTheDocument()
  expect(within(preview).getByRole('group', { name: '箱子 1标签' })).toBeInTheDocument()
  expect(within(preview).queryByRole('group', { name: '箱子 2标签' })).not.toBeInTheDocument()
  expect(within(preview).queryByTestId('a4-sheet')).not.toBeInTheDocument()
  expect(within(preview).queryByText(/共 \d+ 页/)).not.toBeInTheDocument()
  expect(await within(preview).findByRole('img', { name: '箱子 1二维码' })).toBeInTheDocument()
  expect(mockBoxQrPng).toHaveBeenCalledOnce()
})

test('single mode renders nothing when no box is supplied', () => {
  const { container } = render(<PrintSheetPreview boxes={[]} mode="single" />)
  expect(container).toBeEmptyDOMElement()
  expect(mockBoxQrPng).not.toHaveBeenCalled()
})
