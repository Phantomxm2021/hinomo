import type { BoxSummary } from '../boxes/boxes.api'
import { boxQrPng, boxQrUrl } from './qr'

export type PrintableLabel = {
  code: string
  name: string
  space: string
  location: string | null
  qrUrl: string
}

type LabelSource = Pick<BoxSummary, 'public_id' | 'box_code' | 'name' | 'space_name' | 'location'>

export function buildLabels(boxes: LabelSource[], origin: string): PrintableLabel[] {
  return boxes.map((box) => ({
    code: box.box_code,
    name: box.name,
    space: box.space_name,
    location: box.location,
    qrUrl: boxQrUrl(origin, box.public_id),
  }))
}

export function paginateLabels(labels: PrintableLabel[]) {
  return Array.from(
    { length: Math.ceil(labels.length / 8) },
    (_, page) => labels.slice(page * 8, page * 8 + 8),
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

async function renderLabelPng(label: PrintableLabel) {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 680
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')

  context.fillStyle = '#fffdf8'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#e3d5c5'
  context.lineWidth = 4
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
  const qrImage = await loadImage(await boxQrPng(label.qrUrl))
  context.drawImage(qrImage, 55, 110, 390, 390)

  context.fillStyle = '#30271e'
  context.font = '700 48px system-ui, sans-serif'
  context.fillText(fitText(context, label.name, 460), 490, 180)
  context.font = '700 34px ui-monospace, monospace'
  context.fillStyle = '#df6538'
  context.fillText(label.code, 490, 245)
  context.font = '32px system-ui, sans-serif'
  context.fillStyle = '#30271e'
  context.fillText(fitText(context, `空间：${label.space}`, 460), 490, 330)
  context.fillText(fitText(context, `位置：${label.location || '未填写'}`, 460), 490, 385)
  context.font = '24px system-ui, sans-serif'
  context.fillStyle = '#756a5e'
  context.fillText('扫码查看箱内物品', 490, 485)
  return canvas.toDataURL('image/png')
}

export async function renderLabelsPdf(
  labels: PrintableLabel[],
  onProgress?: (completed: number, total: number) => void,
) {
  if (labels.length === 0) throw new Error('Select at least one box')
  const { jsPDF } = await import('jspdf')
  const documentPdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pages = paginateLabels(labels)
  let completed = 0

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    if (pageIndex > 0) documentPdf.addPage()
    for (let labelIndex = 0; labelIndex < pages[pageIndex].length; labelIndex += 1) {
      const image = await renderLabelPng(pages[pageIndex][labelIndex])
      const column = labelIndex % 2
      const row = Math.floor(labelIndex / 2)
      documentPdf.addImage(image, 'PNG', 10 + column * 97.5, 10 + row * 69, 92.5, 64)
      completed += 1
      onProgress?.(completed, labels.length)
    }
  }
  documentPdf.save(`nomo-labels-${new Date().toISOString().slice(0, 10)}.pdf`)
}
