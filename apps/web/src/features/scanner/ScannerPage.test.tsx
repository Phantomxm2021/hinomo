import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ScannerPage } from './ScannerPage'

const { mockNavigate, mockReaderCreate, mockScannerStart } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockReaderCreate: vi.fn(),
  mockScannerStart: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mockNavigate,
}))
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    constructor() {
      mockReaderCreate()
    }

    decodeFromConstraints = mockScannerStart
  },
}))

beforeEach(() => {
  mockNavigate.mockReset()
  mockReaderCreate.mockReset()
  mockScannerStart.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('uses compact mobile page titles with a desktop scale-up', () => {
  mockScannerStart.mockResolvedValue({ stop: vi.fn() })
  render(<ScannerPage />)

  expect(screen.getByRole('heading', { name: '扫码查看' })).toHaveClass(
    'text-page-title',
    'font-extrabold',
  )
})

test('shows only the camera scanner without manual URL controls', () => {
  mockScannerStart.mockResolvedValue({ stop: vi.fn() })
  render(<ScannerPage />)

  expect(screen.queryByLabelText('手动输入二维码地址')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '打开箱子' })).not.toBeInTheDocument()
})

test('uses a tall full-width camera card on mobile and video aspect ratio on desktop', () => {
  mockScannerStart.mockResolvedValue({ stop: vi.fn() })
  render(<ScannerPage />)

  expect(screen.getByLabelText('二维码扫描画面')).toHaveClass(
    'aspect-[4/5]',
    'w-full',
    'max-h-[65dvh]',
    'rounded-shell',
    'overflow-hidden',
    'bg-ink',
    'object-cover',
    'md:aspect-video',
  )
})

test.each([
  [new DOMException('denied', 'NotAllowedError'), '相机权限被拒绝，请在浏览器站点设置中允许相机后重试'],
  [new DOMException('missing', 'NotFoundError'), '没有找到可用的相机'],
  [new Error('boom'), '相机启动失败，请重新尝试'],
])('shows a clear camera error and retry action for %s', async (error, message) => {
  mockScannerStart.mockRejectedValue(error)
  render(<ScannerPage />)

  expect(await screen.findByRole('status')).toHaveTextContent(message)
  expect(screen.getByRole('button', { name: '重新尝试相机' })).toHaveClass(
    'min-h-12',
    'w-full',
    'sm:min-h-11',
    'sm:w-auto',
  )
  expect(screen.queryByText(/手动输入/)).not.toBeInTheDocument()
})

test('starts a new reader and scanner controls when retrying', async () => {
  const user = userEvent.setup()
  const retryStop = vi.fn()
  mockScannerStart
    .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    .mockResolvedValueOnce({ stop: retryStop })
  const { unmount } = render(<ScannerPage />)

  await user.click(await screen.findByRole('button', { name: '重新尝试相机' }))

  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledTimes(2))
  expect(mockReaderCreate).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  unmount()
  expect(retryStop).toHaveBeenCalledOnce()
})

test('stops successful scanner controls before starting a retry reader', async () => {
  const user = userEvent.setup()
  const firstStop = vi.fn()
  mockScannerStart
    .mockResolvedValueOnce({ stop: firstStop })
    .mockResolvedValueOnce({ stop: vi.fn() })
  render(<ScannerPage />)
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  await user.click(await screen.findByRole('button', { name: '重新尝试相机' }))

  await waitFor(() => expect(mockReaderCreate).toHaveBeenCalledTimes(2))
  expect(firstStop).toHaveBeenCalledOnce()
  expect(firstStop.mock.invocationCallOrder[0]).toBeLessThan(mockReaderCreate.mock.invocationCallOrder[1])
})

test('stops scanner controls that resolve after the page unmounts', async () => {
  const lateStop = vi.fn()
  let resolveStart: ((controls: { stop: () => void }) => void) | undefined
  mockScannerStart.mockImplementation(() => new Promise((resolve) => {
    resolveStart = resolve
  }))
  const { unmount } = render(<ScannerPage />)
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  unmount()
  resolveStart?.({ stop: lateStop })

  await waitFor(() => expect(lateStop).toHaveBeenCalledOnce())
  expect(mockNavigate).not.toHaveBeenCalled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('does not start a reader on a non-HTTPS remote host', async () => {
  const insecureWindow = Object.create(window) as Window & typeof globalThis
  Object.defineProperties(insecureWindow, {
    isSecureContext: { value: false },
    location: { value: { hostname: 'nomo.example' } },
  })
  vi.stubGlobal('window', insecureWindow)

  render(<ScannerPage />)

  expect(await screen.findByRole('status')).toHaveTextContent('当前页面不是 HTTPS，无法使用相机')
  expect(mockReaderCreate).not.toHaveBeenCalled()
  expect(mockScannerStart).not.toHaveBeenCalled()
})

test('navigates only for a valid same-origin Nomo box URL', async () => {
  const stop = vi.fn()
  let emitScan: ((result: { getText: () => string }, error?: unknown, controls?: { stop: () => void }) => void) | undefined
  mockScannerStart.mockImplementation(async (_constraints, _video, callback) => {
    emitScan = callback
    return { stop }
  })
  render(<ScannerPage />)
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  emitScan?.({ getText: () => 'https://evil.example/b/123e4567-e89b-12d3-a456-426614174000' })
  expect(await screen.findByRole('status')).toHaveTextContent('识别到的二维码不是有效的 Nomo 箱子地址')
  expect(mockNavigate).not.toHaveBeenCalled()
  emitScan?.(
    { getText: () => 'http://localhost:5173/b/123e4567-e89b-12d3-a456-426614174000' },
    undefined,
    { stop },
  )

  expect(stop).toHaveBeenCalledOnce()
  expect(mockNavigate).toHaveBeenCalledWith('/b/123e4567-e89b-12d3-a456-426614174000')
})

test('stops active scanner controls when unmounted', async () => {
  const stop = vi.fn()
  mockScannerStart.mockResolvedValue({ stop })
  const { unmount } = render(<ScannerPage />)
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  unmount()

  expect(stop).toHaveBeenCalledOnce()
})
