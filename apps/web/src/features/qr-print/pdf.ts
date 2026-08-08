import type { BoxSummary } from '../boxes/boxes.api'
import { formatStoragePath } from '../../lib/format-storage-path'
import { messages } from '../../i18n/messages'
import {
  PRINT_LABEL_CANVAS_PX,
  PRINT_LABEL_COLORS,
  PRINT_LABEL_MM,
  PRINT_SHEET_MM,
  labelPlacementMm,
} from './print-label-layout'
import { boxQrPng, boxQrUrl } from './qr'

export type PrintableLabel = {
  code: string
  name: string
  space: string
  location: string | null
  qrUrl: string
}

export type PdfGenerationFailure = {
  key: 'print.errors.staleAssets' | 'print.errors.generationFailed'
  requiresReload: boolean
}

export type PdfLabelCopy = {
  spacePrefix: string
  locationPrefix: string
  scanToView: string
  locationUnset: string
}

const DEFAULT_PDF_LABEL_COPY: PdfLabelCopy = {
  spacePrefix: messages['zh-CN'].print.pdfSpacePrefix,
  locationPrefix: messages['zh-CN'].print.pdfLocationPrefix,
  scanToView: messages['zh-CN'].print.pdfScanToView,
  locationUnset: messages['zh-CN'].print.pdfLocationUnset,
}

export function describePdfGenerationFailure(error: unknown): PdfGenerationFailure {
  const detail = error instanceof Error ? error.message : String(error)
  const requiresReload = /dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(detail)
  return requiresReload
    ? { key: 'print.errors.staleAssets', requiresReload: true }
    : { key: 'print.errors.generationFailed', requiresReload: false }
}

type LabelSource = Pick<BoxSummary, 'public_id' | 'box_code' | 'name' | 'venue_name' | 'space_name' | 'location'>

export function buildLabels(boxes: LabelSource[], origin: string): PrintableLabel[] {
  return boxes.map((box) => ({
    code: box.box_code,
    name: box.name,
    space: formatStoragePath([box.venue_name, box.space_name]),
    location: box.location,
    qrUrl: boxQrUrl(origin, box.public_id),
  }))
}

export function paginateLabels(labels: PrintableLabel[]) {
  return Array.from(
    { length: Math.ceil(labels.length / PRINT_LABEL_MM.perPage) },
    (_, page) => labels.slice(page * PRINT_LABEL_MM.perPage, page * PRINT_LABEL_MM.perPage + PRINT_LABEL_MM.perPage),
  )
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('QR image could not be rendered'))
    image.src = src
  })
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text
  let shortened = text
  while (shortened && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1)
  }
  return `${shortened}…`
}

async function renderLabelPng(label: PrintableLabel, copy: PdfLabelCopy) {
  const canvas = document.createElement('canvas')
  canvas.width = PRINT_LABEL_CANVAS_PX.width
  canvas.height = PRINT_LABEL_CANVAS_PX.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  const textX = 490
  const textMaxWidth = canvas.width - textX - 55

  context.fillStyle = PRINT_LABEL_COLORS.surface
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = PRINT_LABEL_COLORS.line
  context.lineWidth = 4
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
  const qrImage = await loadImage(await boxQrPng(label.qrUrl))
  context.drawImage(qrImage, 55, 110, 390, 390)

  context.fillStyle = PRINT_LABEL_COLORS.ink
  context.font = '700 48px system-ui, sans-serif'
  context.fillText(fitText(context, label.name, textMaxWidth), textX, 180)
  context.font = '700 34px ui-monospace, monospace'
  context.fillStyle = PRINT_LABEL_COLORS.brand
  context.fillText(fitText(context, label.code, textMaxWidth), textX, 245)
  context.font = '32px system-ui, sans-serif'
  context.fillStyle = PRINT_LABEL_COLORS.ink
  context.fillText(fitText(context, `${copy.spacePrefix}${label.space}`, textMaxWidth), textX, 330)
  context.fillText(fitText(context, `${copy.locationPrefix}${label.location || copy.locationUnset}`, textMaxWidth), textX, 385)
  context.font = '24px system-ui, sans-serif'
  context.fillStyle = PRINT_LABEL_COLORS.muted
  context.fillText(copy.scanToView, textX, 485)
  return canvas.toDataURL('image/png')
}

type PdfProgress = (completed: number, total: number) => void

export function renderLabelsPdf(labels: PrintableLabel[], onProgress?: PdfProgress): Promise<void>
export function renderLabelsPdf(labels: PrintableLabel[], copy: PdfLabelCopy, onProgress?: PdfProgress): Promise<void>
export async function renderLabelsPdf(
  labels: PrintableLabel[],
  copyOrProgress: PdfLabelCopy | PdfProgress = DEFAULT_PDF_LABEL_COPY,
  maybeProgress?: PdfProgress,
) {
  const copy = typeof copyOrProgress === 'function' ? DEFAULT_PDF_LABEL_COPY : copyOrProgress
  const onProgress = typeof copyOrProgress === 'function' ? copyOrProgress : maybeProgress
  if (labels.length === 0) throw new Error('Select at least one box')
  const { jsPDF } = await import('jspdf')
  const documentPdf = new jsPDF({
    unit: 'mm',
    format: [PRINT_SHEET_MM.width, PRINT_SHEET_MM.height],
  })
  const pages = paginateLabels(labels)
  let completed = 0

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    if (pageIndex > 0) documentPdf.addPage()
    for (let labelIndex = 0; labelIndex < pages[pageIndex].length; labelIndex += 1) {
      const image = await renderLabelPng(pages[pageIndex][labelIndex], copy)
      const placement = labelPlacementMm(labelIndex)
      documentPdf.addImage(image, 'PNG', placement.left, placement.top, placement.width, placement.height)
      completed += 1
      onProgress?.(completed, labels.length)
    }
  }
  documentPdf.save(`nomo-labels-${new Date().toISOString().slice(0, 10)}.pdf`)
}
