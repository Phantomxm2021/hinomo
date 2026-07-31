import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ScannerPage } from './ScannerPage'

const { mockNavigate, mockScannerStart, mockStop } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockScannerStart: vi.fn(),
  mockStop: vi.fn(),
}))

type ScanResult = { getText: () => string }
type ScanCallback = (result: ScanResult | undefined, error?: unknown, controls?: { stop: () => void }) => void

vi.mock('react-router-dom', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-router-dom')>(),
  useNavigate: () => mockNavigate,
}))
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints = mockScannerStart
  },
}))

beforeEach(() => {
  mockNavigate.mockReset()
  mockStop.mockReset()
  mockScannerStart.mockReset()
})
afterEach(cleanup)

test('navigates only for a valid same-origin Nomo box URL', async () => {
  let emitScan: ScanCallback | undefined
  mockScannerStart.mockImplementation(async (_constraints: unknown, _video: HTMLVideoElement | undefined, callback: ScanCallback) => {
    emitScan = callback
    return { stop: mockStop }
  })
  render(<ScannerPage />)
  await waitFor(() => expect(mockScannerStart).toHaveBeenCalledOnce())

  emitScan?.({ getText: () => 'https://evil.example/b/123e4567-e89b-12d3-a456-426614174000' })
  expect(mockNavigate).not.toHaveBeenCalled()
  emitScan?.(
    { getText: () => 'http://localhost:5173/b/123e4567-e89b-12d3-a456-426614174000' },
    undefined,
    { stop: mockStop },
  )

  expect(mockStop).toHaveBeenCalledOnce()
  expect(mockNavigate).toHaveBeenCalledWith('/b/123e4567-e89b-12d3-a456-426614174000')
})

test('offers manual input when camera permission is denied', async () => {
  mockScannerStart.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
  render(<ScannerPage />)

  expect(await screen.findByText('相机权限被拒绝')).toBeInTheDocument()
  expect(screen.getByLabelText('手动输入二维码地址')).toBeInTheDocument()
})

test('validates a manually entered URL before navigating', async () => {
  const user = userEvent.setup()
  mockScannerStart.mockResolvedValue({ stop: mockStop })
  render(<ScannerPage />)
  const input = screen.getByLabelText('手动输入二维码地址')
  await user.type(input, 'not-a-box-url')
  await user.click(screen.getByRole('button', { name: '打开箱子' }))

  expect(screen.getByRole('alert')).toHaveTextContent('不是有效的 Nomo 箱子地址')
  expect(mockNavigate).not.toHaveBeenCalled()
})
