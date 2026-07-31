import { afterEach, expect, test, vi } from 'vitest'
import { buildLabels, paginateLabels, renderLabelsPdf } from './pdf'
import { PRINT_LABEL_COLORS, PRINT_LABEL_MM, PRINT_SHEET_MM, labelPlacementMm } from './print-label-layout'

const { mockAddImage, mockAddPage, mockBoxQrPng, mockPdfConstructor, mockSave } = vi.hoisted(() => ({
  mockAddImage: vi.fn(),
  mockAddPage: vi.fn(),
  mockBoxQrPng: vi.fn().mockResolvedValue('data:image/png;base64,qr'),
  mockPdfConstructor: vi.fn(),
  mockSave: vi.fn(),
}))

vi.mock('./qr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./qr')>()
  return { ...actual, boxQrPng: mockBoxQrPng }
})

vi.mock('jspdf', () => ({
  jsPDF: function MockPdf(options: unknown) {
    mockPdfConstructor(options)
    return { addImage: mockAddImage, addPage: mockAddPage, save: mockSave }
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  mockAddImage.mockClear()
  mockAddPage.mockClear()
  mockBoxQrPng.mockClear()
  mockPdfConstructor.mockClear()
  mockSave.mockClear()
})

const box = {
  id: 'box-1', public_id: 'public-1', box_code: 'BX-00001', name: '冬季衣物',
  venue_name: '家里', space_name: '家', location: '衣柜上层', visibility: 'private' as const,
}

test('maps selected boxes to printable labels', () => {
  expect(buildLabels([box], 'https://nomo.example/')).toEqual([{
    code: 'BX-00001', name: '冬季衣物', space: '家里 · 家', location: '衣柜上层',
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

test('renders every label across pages and reports progress', async () => {
  const fillStyles: string[] = []
  const strokeStyles: string[] = []
  const context = {
    drawImage: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), measureText: vi.fn(() => ({ width: 100 })),
    strokeRect: vi.fn(), font: '', lineWidth: 0,
    get fillStyle() { return fillStyles.at(-1) ?? '' },
    set fillStyle(value: string) { fillStyles.push(value) },
    get strokeStyle() { return strokeStyles.at(-1) ?? '' },
    set strokeStyle(value: string) { strokeStyles.push(value) },
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  const toDataUrl = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,label')
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

  expect(mockPdfConstructor).toHaveBeenCalledWith({
    unit: 'mm',
    format: [PRINT_SHEET_MM.width, PRINT_SHEET_MM.height],
  })
  expect(toDataUrl.mock.instances[0]).toMatchObject({ width: 925, height: 640 })
  expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 55, 110, 390, 390)
  expect(fillStyles).toEqual(expect.arrayContaining(Object.values(PRINT_LABEL_COLORS).filter((color) => color !== PRINT_LABEL_COLORS.line)))
  expect(strokeStyles).toContain(PRINT_LABEL_COLORS.line)
  expect(mockBoxQrPng).toHaveBeenCalledTimes(9)
  expect(mockAddImage).toHaveBeenCalledTimes(9)
  const first = labelPlacementMm(0)
  expect(mockAddImage).toHaveBeenNthCalledWith(1, 'data:image/png;base64,label', 'PNG', first.left, first.top, first.width, first.height)
  const eighth = labelPlacementMm(7)
  expect(mockAddImage).toHaveBeenNthCalledWith(8, 'data:image/png;base64,label', 'PNG', eighth.left, eighth.top, eighth.width, eighth.height)
  expect(mockAddImage).toHaveBeenNthCalledWith(9, 'data:image/png;base64,label', 'PNG', first.left, first.top, first.width, first.height)
  expect(mockAddPage).toHaveBeenCalledOnce()
  expect(paginateLabels(labels)[0]).toHaveLength(PRINT_LABEL_MM.columns * PRINT_LABEL_MM.rows)
  expect(progress).toHaveBeenLastCalledWith(9, 9)
  expect(mockSave).toHaveBeenCalledOnce()
})
