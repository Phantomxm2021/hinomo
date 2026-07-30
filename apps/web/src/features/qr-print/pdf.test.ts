import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import { buildLabels, paginateLabels, renderLabelsPdf } from './pdf'

const { mockAddImage, mockAddPage, mockBoxQrPng, mockSave } = vi.hoisted(() => ({
  mockAddImage: vi.fn(),
  mockAddPage: vi.fn(),
  mockBoxQrPng: vi.fn().mockResolvedValue('data:image/png;base64,qr'),
  mockSave: vi.fn(),
}))

vi.mock('./qr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./qr')>()
  return { ...actual, boxQrPng: mockBoxQrPng }
})

vi.mock('jspdf', () => ({
  jsPDF: function MockPdf() {
    return { addImage: mockAddImage, addPage: mockAddPage, save: mockSave }
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  mockAddImage.mockClear()
  mockAddPage.mockClear()
  mockBoxQrPng.mockClear()
  mockSave.mockClear()
})

const box = {
  id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  space_name: '家', location: '衣柜上层', visibility: 'private' as const,
}

test('maps selected boxes to printable labels', () => {
  expect(buildLabels([box], 'https://nomo.example/')).toEqual([{
    code: 'BX-00001', name: '冬季衣物', space: '家', location: '衣柜上层',
    qrUrl: 'https://nomo.example/b/public-1',
  }])
})

test('paginates labels eight per A4 page', () => {
  const labels = Array.from({ length: 17 }, (_, index) => ({
    code: `BX-${index}`, name: `箱子 ${index}`, space: '家', location: null,
    qrUrl: `https://nomo.example/b/${index}`,
  }))
  expect(paginateLabels(labels).map((page) => page.length)).toEqual([8, 8, 1])
})

test('uses the warm label palette instead of the old purple accent', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/features/qr-print/pdf.ts'), 'utf8')
  for (const color of ['#fffdf8', '#e3d5c5', '#30271e', '#756a5e', '#df6538']) {
    expect(source).toContain(color)
  }
  expect(source).not.toMatch(/#(?:7c3aed|111827|374151|6b7280)/i)
})

test('renders every label across pages and reports progress', async () => {
  const context = {
    drawImage: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), measureText: vi.fn(() => ({ width: 100 })),
    strokeRect: vi.fn(), fillStyle: '', font: '', lineWidth: 0, strokeStyle: '',
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,label')
  class InstantImage {
    onload: null | (() => void) = null
    onerror: null | (() => void) = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  }
  vi.stubGlobal('Image', InstantImage)
  const labels = Array.from({ length: 9 }, (_, index) => ({
    code: `BX-${index}`, name: `箱子 ${index}`, space: '家', location: null,
    qrUrl: `https://nomo.example/b/${index}`,
  }))
  const progress = vi.fn()

  await renderLabelsPdf(labels, progress)

  expect(mockBoxQrPng).toHaveBeenCalledTimes(9)
  expect(mockAddImage).toHaveBeenCalledTimes(9)
  expect(mockAddPage).toHaveBeenCalledOnce()
  expect(progress).toHaveBeenLastCalledWith(9, 9)
  expect(mockSave).toHaveBeenCalledOnce()
})
