import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { BoxSummary } from '../boxes/boxes.api'
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

const boxes: BoxSummary[] = [{
  id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  space_id: 'space-1', space_name: '家', location: '衣柜上层', visibility: 'private',
  cover_object_key: null, item_count: 8, updated_at: '2026-07-29T10:00:00Z',
}, {
  id: 'box-2', public_id: 'public-2', box_code: 'BX-00002', name: '露营装备',
  space_id: 'space-2', space_name: '储藏室', location: null, visibility: 'public',
  cover_object_key: null, item_count: 4, updated_at: '2026-07-28T10:00:00Z',
}]

let desktopViewport = true
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>()

function setDesktopViewport(matches: boolean) {
  desktopViewport = matches
  act(() => {
    for (const listener of mediaListeners) {
      listener({ matches, media: '(min-width: 64rem)' } as MediaQueryListEvent)
    }
  })
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

function renderPrint() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={client}><PrintPage /></QueryClientProvider>
    </MemoryRouter>,
  )
  return { ...view, client }
}

function getPageHeader() {
  return screen.getByText('打印中心').closest('header') as HTMLElement
}

beforeEach(() => {
  desktopViewport = true
  mediaListeners.clear()
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({
    matches: desktopViewport,
    media,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as MediaQueryList))
  mockListBoxes.mockReset().mockResolvedValue(boxes)
  mockRenderLabelsPdf.mockReset().mockResolvedValue(undefined)
  mockBoxQrPng.mockReset().mockImplementation((url: string) => Promise.resolve(`data:${url}`))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('uses the warm print-center header with one accessible page heading', async () => {
  renderPrint()

  expect(screen.getByText('打印中心')).toHaveClass('tracking-eyebrow', 'text-muted')
  const headings = screen.getAllByRole('heading', { level: 1 })
  expect(headings).toHaveLength(1)
  expect(headings[0]).not.toHaveAttribute('aria-label')
  expect(within(headings[0]).getByText('下载箱子标签')).toHaveClass('lg:hidden')
  expect(within(headings[0]).getByText('下载箱子标签')).not.toHaveAttribute('aria-hidden')
  expect(within(headings[0]).getByText('打印二维码标签')).toHaveClass('hidden', 'lg:inline')
  expect(within(headings[0]).getByText('打印二维码标签')).not.toHaveAttribute('aria-hidden')
  expect(screen.getByText('选择箱子，预览 A4 排版并下载可打印 PDF')).toHaveClass('hidden', 'lg:block')
  expect(screen.getByText('移动设备每次处理一张标签')).toHaveClass('lg:hidden')
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  expect(within(getPageHeader()).getByText('A4 · 双列 · 已选 0 张')).toHaveClass('hidden', 'lg:block')
  expect(within(desktop).queryByText('批量打印')).not.toBeInTheDocument()
  expect(within(desktop).queryByText('勾选多个箱子并检查分页效果')).not.toBeInTheDocument()
  expect(screen.getAllByText('移动设备每次处理一张标签')).toHaveLength(1)
})

test('connects desktop selection to the summary and A4 preview', async () => {
  const user = userEvent.setup()
  renderPrint()

  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  expect(within(getPageHeader()).getByText('A4 · 双列 · 已选 0 张')).toBeInTheDocument()
  const preview = within(desktop).getByRole('region', { name: 'A4 标签预览' })
  expect(within(preview).getByTestId('a4-sheet')).toBeInTheDocument()

  await user.click(within(desktop).getByRole('checkbox', { name: /露营装备/ }))

  expect(within(getPageHeader()).getByText('A4 · 双列 · 已选 1 张')).toBeInTheDocument()
  const label = within(preview).getByRole('group', { name: '露营装备标签' })
  expect(within(label).getByText('空间：储藏室')).toBeInTheDocument()
  expect(within(label).getByText('位置：未填写')).toBeInTheDocument()
})

test('filters real desktop results and visible selection preserves hidden choices', async () => {
  const user = userEvent.setup()
  renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  const selector = within(desktop).getByRole('region', { name: '选择要打印的箱子' })

  await user.click(within(selector).getByRole('checkbox', { name: /冬季衣物/ }))
  await user.type(within(selector).getByRole('searchbox', { name: '搜索箱子' }), '露营')

  expect(within(selector).queryByRole('checkbox', { name: /冬季衣物/ })).not.toBeInTheDocument()
  expect(within(selector).getByRole('checkbox', { name: /露营装备/ })).toBeInTheDocument()
  await user.click(within(selector).getByRole('button', { name: '全选当前结果' }))

  expect(within(getPageHeader()).getByText('A4 · 双列 · 已选 2 张')).toBeInTheDocument()
  const preview = within(desktop).getByRole('region', { name: 'A4 标签预览' })
  expect(within(preview).getByRole('group', { name: '冬季衣物标签' })).toBeInTheDocument()
  expect(within(preview).getByRole('group', { name: '露营装备标签' })).toBeInTheDocument()
})

test('builds desktop PDF labels in source order instead of click order', async () => {
  const user = userEvent.setup()
  renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })

  await user.click(within(desktop).getByRole('checkbox', { name: /露营装备/ }))
  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  await user.click(within(desktop).getByRole('button', { name: '下载 PDF' }))

  expect(mockRenderLabelsPdf).toHaveBeenCalledOnce()
  expect(mockRenderLabelsPdf.mock.calls[0][0].map((label: { code: string }) => label.code))
    .toEqual(['BX-00001', 'BX-00002'])
})

test('reports progress, prevents duplicate generation, and preserves selection for retry after failure', async () => {
  const user = userEvent.setup()
  const firstAttempt = deferred<void>()
  mockRenderLabelsPdf
    .mockImplementationOnce(async (_labels, onProgress) => {
      onProgress?.(1, 1)
      return firstAttempt.promise
    })
    .mockResolvedValueOnce(undefined)
  renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  await user.click(within(desktop).getByRole('button', { name: '下载 PDF' }))

  const generating = within(desktop).getByRole('button', { name: '生成中…' })
  expect(generating).toBeDisabled()
  expect(screen.getByRole('status', { name: '二维码渲染进度：1/1' })).toBeInTheDocument()
  await user.click(generating)
  expect(mockRenderLabelsPdf).toHaveBeenCalledOnce()

  await act(async () => {
    firstAttempt.reject(new Error('failed'))
    await firstAttempt.promise.catch(() => undefined)
  })

  expect(screen.getByRole('alert')).toHaveTextContent('PDF 生成失败，请重试')
  expect(within(desktop).getByRole('checkbox', { name: /冬季衣物/ })).toBeChecked()
  expect(within(desktop).getByRole('group', { name: '冬季衣物标签' })).toBeInTheDocument()
  await user.click(within(desktop).getByRole('button', { name: '下载 PDF' }))
  expect(mockRenderLabelsPdf).toHaveBeenCalledTimes(2)
})

test('offers a separate mobile radio choice, single preview, and single-box download', async () => {
  const user = userEvent.setup()
  setDesktopViewport(false)
  renderPrint()
  const mobile = await screen.findByRole('region', { name: '单个标签下载' })

  expect(within(mobile).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(within(mobile).getByText('选择一个箱子查看标签预览')).toBeInTheDocument()
  const download = within(mobile).getByRole('button', { name: '下载单个标签' })
  expect(download).toBeDisabled()
  await user.click(within(mobile).getByRole('radio', { name: /露营装备.*BX-00002.*储藏室.*未填写位置/ }))

  const preview = within(mobile).getByRole('region', { name: '单个标签预览' })
  expect(within(preview).getByRole('group', { name: '露营装备标签' })).toBeInTheDocument()
  expect(download).toBeEnabled()
  await user.click(download)
  expect(mockRenderLabelsPdf.mock.calls[0][0].map((label: { code: string }) => label.code)).toEqual(['BX-00002'])
})

test('keeps desktop and mobile selection independent', async () => {
  const user = userEvent.setup()
  renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  const mobile = screen.getByRole('region', { name: '单个标签下载' })

  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  await user.click(within(mobile).getByRole('radio', { name: /露营装备/ }))

  expect(within(desktop).getByRole('checkbox', { name: /冬季衣物/ })).toBeChecked()
  expect(within(desktop).getByRole('checkbox', { name: /露营装备/ })).not.toBeChecked()
  expect(within(mobile).getByRole('radio', { name: /露营装备/ })).toBeChecked()
  expect(within(getPageHeader()).getByText('A4 · 双列 · 已选 1 张')).toBeInTheDocument()
})

test('permanently removes stale desktop and mobile selections when query data drops a box', async () => {
  const user = userEvent.setup()
  const { client } = renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  const mobile = screen.getByRole('region', { name: '单个标签下载' })
  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  await user.click(within(mobile).getByRole('radio', { name: /冬季衣物/ }))

  act(() => client.setQueryData(['boxes'], [boxes[1]]))

  await waitFor(() => expect(within(getPageHeader()).getByText('A4 · 双列 · 已选 0 张')).toBeInTheDocument())
  expect(within(desktop).queryByRole('group', { name: '冬季衣物标签' })).not.toBeInTheDocument()
  expect(within(desktop).getByRole('button', { name: '下载 PDF' })).toBeDisabled()

  act(() => client.setQueryData(['boxes'], boxes))

  await waitFor(() => expect(within(desktop).getByRole('checkbox', { name: /冬季衣物/ })).not.toBeChecked())
  expect(within(mobile).getByRole('radio', { name: /冬季衣物/ })).not.toBeChecked()
  expect(within(getPageHeader()).getByText('A4 · 双列 · 已选 0 张')).toBeInTheDocument()
})

test('keeps retained catalogue data and the current preview visible after a refetch error', async () => {
  const user = userEvent.setup()
  const { client } = renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  expect(within(desktop).getByRole('group', { name: '冬季衣物标签' })).toBeInTheDocument()

  mockListBoxes.mockRejectedValueOnce(new Error('refresh failed'))
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['boxes'] })
  })

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('箱子列表刷新失败，正在显示上次结果')
  expect(within(desktop).getByRole('checkbox', { name: /冬季衣物/ })).toBeChecked()
  expect(within(desktop).getByRole('group', { name: '冬季衣物标签' })).toBeInTheDocument()

  mockListBoxes.mockResolvedValueOnce(boxes)
  await user.click(within(alert).getByRole('button', { name: '重试' }))
  await waitFor(() => expect(screen.queryByText('箱子列表刷新失败，正在显示上次结果')).not.toBeInTheDocument())
})

test('mounts only the active breakpoint preview and replaces it when the breakpoint changes', async () => {
  const user = userEvent.setup()
  const view = renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  const mobile = screen.getByRole('region', { name: '单个标签下载' })

  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  await user.click(within(mobile).getByRole('radio', { name: /冬季衣物/ }))

  expect(screen.getByRole('region', { name: 'A4 标签预览' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: '单个标签预览' })).not.toBeInTheDocument()
  expect(await screen.findByRole('img', { name: '冬季衣物二维码' })).toBeInTheDocument()
  expect(mockBoxQrPng).toHaveBeenCalledOnce()

  setDesktopViewport(false)

  expect(screen.queryByRole('region', { name: 'A4 标签预览' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: '单个标签预览' })).toBeInTheDocument()
  expect(await screen.findByRole('img', { name: '冬季衣物二维码' })).toBeInTheDocument()
  expect(mockBoxQrPng).toHaveBeenCalledTimes(2)

  view.unmount()
  expect(mediaListeners.size).toBe(0)
})

test('ignores PDF progress and settlement safely after unmount', async () => {
  const user = userEvent.setup()
  const pdf = deferred<void>()
  let reportProgress: ((completed: number, total: number) => void) | undefined
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const unhandledRejection = vi.fn()
  window.addEventListener('unhandledrejection', unhandledRejection)
  mockRenderLabelsPdf.mockImplementationOnce((_labels, onProgress) => {
    reportProgress = onProgress
    return pdf.promise
  })
  const view = renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  await user.click(within(desktop).getByRole('checkbox', { name: /冬季衣物/ }))
  await user.click(within(desktop).getByRole('button', { name: '下载 PDF' }))
  expect(reportProgress).toBeTypeOf('function')

  view.unmount()
  await act(async () => {
    reportProgress?.(1, 1)
    pdf.reject(new Error('late failure'))
    await pdf.promise.catch(() => undefined)
  })

  expect(consoleError).not.toHaveBeenCalled()
  expect(unhandledRejection).not.toHaveBeenCalled()
  window.removeEventListener('unhandledrejection', unhandledRejection)
  consoleError.mockRestore()
})

test('blocks workspaces while loading and on an initial error, then retries', async () => {
  const user = userEvent.setup()
  const pending = deferred<BoxSummary[]>()
  mockListBoxes.mockReturnValueOnce(pending.promise)
  const loadingView = renderPrint()

  expect(screen.getByRole('status')).toHaveTextContent('正在加载箱子…')
  expect(screen.queryByRole('region', { name: '批量标签工作台' })).not.toBeInTheDocument()
  loadingView.unmount()

  mockListBoxes.mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce(boxes)
  renderPrint()
  expect(await screen.findByRole('alert')).toHaveTextContent('箱子加载失败，请重试')
  expect(screen.queryByRole('region', { name: '单个标签下载' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '重试' }))
  expect(await screen.findByRole('region', { name: '批量标签工作台' })).toBeInTheDocument()
})

test('shows a warm empty state linking back to all boxes', async () => {
  mockListBoxes.mockResolvedValue([])
  renderPrint()

  expect(await screen.findByRole('heading', { name: '请先创建箱子' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '查看全部箱子' })).toHaveAttribute('href', '/app/boxes')
  expect(screen.queryByRole('region', { name: '批量标签工作台' })).not.toBeInTheDocument()
})

test('keeps responsive workspaces min-width safe at the lg breakpoint', async () => {
  renderPrint()
  const desktop = await screen.findByRole('region', { name: '批量标签工作台' })
  const mobile = screen.getByRole('region', { name: '单个标签下载' })

  expect(desktop).toHaveClass('hidden', 'min-w-0', 'gap-6', 'lg:grid', 'lg:grid-cols-[22rem_minmax(0,1fr)]')
  expect(desktop.className).not.toMatch(/\bw-screen\b/)
  expect(within(desktop).getByRole('region', { name: 'A4 标签预览' }).parentElement).toHaveClass('min-w-0')
  expect(mobile).toHaveClass('flex', 'min-w-0', 'lg:hidden')
  expect(mobile.className).not.toMatch(/\bw-screen\b/)
})
