import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MobileFeedbackProvider } from '../../components/MobileFeedbackProvider'
import { ScannerPage } from './ScannerPage'

const { mockCaptureGrowthEvent, mockFirstGrowthOccurrence, mockNavigate, mockReaderCreate, mockScannerStart } = vi.hoisted(() => ({
  mockCaptureGrowthEvent: vi.fn(),
  mockFirstGrowthOccurrence: vi.fn(),
  mockNavigate: vi.fn(),
  mockReaderCreate: vi.fn(),
  mockScannerStart: vi.fn(),
}))

type ScanResult = { getText: () => string }
type ScanCallback = (result: ScanResult | undefined, error?: unknown, controls?: { stop: () => void }) => void

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
vi.mock('../../lib/analytics', () => ({
  captureGrowthEvent: mockCaptureGrowthEvent,
  firstGrowthOccurrence: mockFirstGrowthOccurrence,
}))

beforeEach(() => {
  mockNavigate.mockReset()
  mockReaderCreate.mockReset()
  mockScannerStart.mockReset()
  mockCaptureGrowthEvent.mockReset()
  mockFirstGrowthOccurrence.mockReset().mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderScanner() {
  return render(<MobileFeedbackProvider><ScannerPage /></MobileFeedbackProvider>)
}

test('uses compact mobile page titles with a desktop scale-up', () => {
  mockScannerStart.mockResolvedValue({ stop: vi.fn() })
  renderScanner()

  expect(screen.getByRole('heading', { name: '扫码查看' })).toHaveClass(
    'text-page-title',
    'font-extrabold',
  )
})

test('shows only the camera scanner without manual URL controls', () => {
  mockScannerStart.mockResolvedValue({ stop: vi.fn() })
  renderScanner()

  expect(screen.queryByLabelText('手动输入二维码地址')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '打开箱子' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '重新尝试相机' })).not.toBeInTheDocument()
})

test('uses a tall full-width camera card on mobile and video aspect ratio on desktop', () => {
  mockScannerStart.mockResolvedValue({ stop: vi.fn() })
  renderScanner()

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
  expect(screen.getByTestId('scanner-feedback')).toBeInTheDocument()
  expect(screen.getByTestId('scanner-feedback').querySelector('.scanner-beam')).toBeInTheDocument()
})

test.each([
  [new DOMException('denied', 'NotAllowedError'), '相机权限被拒绝，请在浏览器站点设置中允许相机'],
  [new DOMException('missing', 'NotFoundError'), '没有找到可用的相机'],
  [new Error('boom'), '相机启动失败，请检查浏览器设置后重新进入扫码页'],
])('shows camera failures without a retry-camera action for %s', async (error, message) => {
  mockScannerStart.mockRejectedValue(error)
  renderScanner()

  const alert = await screen.findByRole('alertdialog', { name: message })
  expect(alert).toHaveTextContent(message)
  expect(within(alert).getByRole('button', { name: '好' })).toBeInTheDocument()
  expect(within(alert).queryByRole('button', { name: '重新尝试相机' })).not.toBeInTheDocument()
  expect(screen.queryByText(/手动输入/)).not.toBeInTheDocument()
})

test('stops scanner controls that resolve after the page unmounts', async () => {
  const lateStop = vi.fn()
  let resolveStart: ((controls: { stop: () => void }) => void) | undefined
  mockScannerStart.mockImplementation(() => new Promise((resolve) => {
    resolveStart = resolve
  }))
  const { unmount } = renderScanner()
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  unmount()
  resolveStart?.({ stop: lateStop })

  await waitFor(() => expect(lateStop).toHaveBeenCalledOnce())
  expect(mockNavigate).not.toHaveBeenCalled()
  expect(mockCaptureGrowthEvent).not.toHaveBeenCalled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('does not start a reader on a non-HTTPS remote host', async () => {
  const insecureWindow = Object.create(window) as Window & typeof globalThis
  Object.defineProperties(insecureWindow, {
    isSecureContext: { value: false },
    location: { value: { hostname: 'nomo.example' } },
  })
  vi.stubGlobal('window', insecureWindow)

  renderScanner()

  expect(await screen.findByRole('alertdialog', { name: '当前页面不是 HTTPS，无法使用相机' })).toBeInTheDocument()
  expect(mockReaderCreate).not.toHaveBeenCalled()
  expect(mockScannerStart).not.toHaveBeenCalled()
})

test('keeps scanning after an invalid code and navigates for the next valid Nomo URL', async () => {
  const stop = vi.fn()
  let emitScan: ScanCallback | undefined
  mockScannerStart.mockImplementation(async (_constraints: unknown, _video: HTMLVideoElement | undefined, callback: ScanCallback) => {
    emitScan = callback
    return { stop }
  })
  renderScanner()
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  emitScan?.({ getText: () => 'https://evil.example/b/123e4567-e89b-12d3-a456-426614174000' })
  expect(await screen.findByRole('status', { name: '未识别到有效的 Nomo 箱子二维码，请继续扫描' })).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByTestId('scanner-feedback')).toBeInTheDocument()
  expect(mockScannerStart).toHaveBeenCalledOnce()
  expect(stop).not.toHaveBeenCalled()
  expect(mockNavigate).not.toHaveBeenCalled()
  emitScan?.(
    { getText: () => 'http://localhost:5173/b/123e4567-e89b-12d3-a456-426614174000' },
    undefined,
    { stop },
  )

  expect(stop).toHaveBeenCalledOnce()
  expect(mockNavigate).toHaveBeenCalledWith('/b/123e4567-e89b-12d3-a456-426614174000')
  expect(mockCaptureGrowthEvent).toHaveBeenCalledWith('qr_scanned', { destination: 'box', first: true })
  expect(mockCaptureGrowthEvent.mock.calls.flat()).not.toContain('http://localhost:5173/b/123e4567-e89b-12d3-a456-426614174000')
})

test('stops active scanner controls when unmounted', async () => {
  const stop = vi.fn()
  mockScannerStart.mockResolvedValue({ stop })
  const { unmount } = renderScanner()
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  unmount()

  expect(stop).toHaveBeenCalledOnce()
})
