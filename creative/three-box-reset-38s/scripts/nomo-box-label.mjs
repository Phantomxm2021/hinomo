import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

export const LABEL_CANVAS = { width: 925, height: 640 }

export const LABEL_COPY = {
  title: 'Nomo Box',
  code: 'BX-00038',
  space: 'Space: Living room',
  location: 'Location: Not set',
  instruction: 'Scan to view box items',
}

export async function renderNomoBoxLabel({ qrPath }) {
  const qr = await sharp(qrPath)
    .resize(390, 390, { fit: 'contain' })
    .png()
    .toBuffer()

  const plate = Buffer.from(`
    <svg width="925" height="640" viewBox="0 0 925 640" xmlns="http://www.w3.org/2000/svg">
      <rect width="925" height="640" rx="28" fill="#fffdf8"/>
      <rect x="2" y="2" width="921" height="636" rx="27" fill="none" stroke="#e3d5c5" stroke-width="4"/>
      <rect x="55" y="110" width="390" height="390" fill="#f7f0e7"/>
      <text x="490" y="180" fill="#30271e" font-family="Arial, sans-serif" font-size="48" font-weight="700">${LABEL_COPY.title}</text>
      <text x="490" y="245" fill="#df6538" font-family="Arial, sans-serif" font-size="34" font-weight="700">${LABEL_COPY.code}</text>
      <text x="490" y="330" fill="#30271e" font-family="Arial, sans-serif" font-size="32">${LABEL_COPY.space}</text>
      <text x="490" y="385" fill="#30271e" font-family="Arial, sans-serif" font-size="32">${LABEL_COPY.location}</text>
      <text x="490" y="485" fill="#756a5e" font-family="Arial, sans-serif" font-size="24" font-weight="700">${LABEL_COPY.instruction}</text>
    </svg>
  `)

  return sharp(plate)
    .composite([{ input: qr, left: 55, top: 110 }])
    .ensureAlpha()
    .png()
    .toBuffer()
}

export async function writeNomoBoxLabel({ qrPath, outputPath }) {
  const label = await renderNomoBoxLabel({ qrPath })
  await mkdir(path.dirname(outputPath), { recursive: true })
  await sharp(label).png().toFile(outputPath)
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const packageRoot = path.resolve(scriptDir, '..')
  const repositoryRoot = path.resolve(packageRoot, '..', '..')
  await writeNomoBoxLabel({
    qrPath: path.join(repositoryRoot, 'apps', 'web', 'public', 'landing', 'nomo-qr.png'),
    outputPath: path.join(packageRoot, 'source', 'labels', 'nomo-box-bx-00038.png'),
  })
  process.stdout.write('rendered nomo-box-bx-00038.png\n')
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
