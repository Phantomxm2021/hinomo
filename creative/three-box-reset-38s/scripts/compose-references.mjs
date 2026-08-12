import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const repositoryRoot = path.resolve(packageRoot, '..', '..')
const generatedDir = path.join(packageRoot, 'source', 'generated')
const uiDir = path.join(packageRoot, 'source', 'ui')
const referenceDir = path.join(packageRoot, 'references')
const qrPath = path.join(repositoryRoot, 'apps', 'web', 'public', 'landing', 'nomo-qr.png')

const canvas = { width: 1920, height: 1080 }
const phone = { width: 520, height: 1040, screenX: 20, screenY: 20, screenWidth: 480, screenHeight: 1000 }

const files = {
  master: '00-three-open-boxes-source.png',
  empty: '01-box-1-open-empty-source.png',
  packed: '02-box-1-open-packed-source.png',
  closed: '07-box-1-closed-unlabeled-source.png',
}

const output = (name) => path.join(referenceDir, name)
const generated = (name) => path.join(generatedDir, name)
const ui = (name) => path.join(uiDir, name)

const normalizePhysical = (source) => sharp(source)
  .resize(canvas.width, canvas.height, { fit: 'cover', position: 'centre' })
  .png()
  .toBuffer()

const neutralBackground = Buffer.from(`
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#faf6ef"/>
        <stop offset="0.58" stop-color="#f2e9dc"/>
        <stop offset="1" stop-color="#e9d9c5"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.28" cy="0.26" r="0.7">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="42"/></filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#base)"/>
    <rect width="1920" height="1080" fill="url(#glow)"/>
    <ellipse cx="960" cy="1050" rx="560" ry="86" fill="#8d6849" fill-opacity="0.11" filter="url(#blur)"/>
    <circle cx="1620" cy="185" r="240" fill="#e76535" fill-opacity="0.055"/>
    <circle cx="310" cy="920" r="290" fill="#2f281f" fill-opacity="0.035"/>
  </svg>
`)

const phoneBody = Buffer.from(`
  <svg width="${phone.width}" height="${phone.height}" viewBox="0 0 ${phone.width} ${phone.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="silver" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#bfc1c3"/>
        <stop offset="0.09" stop-color="#f7f7f5"/>
        <stop offset="0.48" stop-color="#d8d9da"/>
        <stop offset="0.91" stop-color="#fbfbfa"/>
        <stop offset="1" stop-color="#aeb1b3"/>
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="518" height="1038" rx="96" fill="url(#silver)" stroke="#8f9295" stroke-width="2"/>
    <rect x="10" y="10" width="500" height="1020" rx="89" fill="#0b0b0b"/>
    <rect x="0" y="210" width="6" height="118" rx="3" fill="#8e9194"/>
    <rect x="0" y="358" width="6" height="190" rx="3" fill="#8e9194"/>
    <rect x="514" y="270" width="6" height="170" rx="3" fill="#8e9194"/>
    <rect x="514" y="610" width="6" height="118" rx="3" fill="#8e9194"/>
  </svg>
`)

const phoneShadow = Buffer.from(`
  <svg width="580" height="1080" viewBox="0 0 580 1080" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="shadow" x="-30%" y="-20%" width="170%" height="160%"><feGaussianBlur stdDeviation="22"/></filter></defs>
    <rect x="42" y="25" width="520" height="1035" rx="98" fill="#261c14" fill-opacity="0.23" filter="url(#shadow)"/>
  </svg>
`)

async function createPhone(screenPath) {
  const mask = Buffer.from(`<svg width="${phone.screenWidth}" height="${phone.screenHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="${phone.screenWidth}" height="${phone.screenHeight}" rx="80" fill="#fff"/></svg>`)
  const screen = await sharp(screenPath)
    .resize(phone.screenWidth, phone.screenHeight, { fit: 'cover', position: 'north' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const island = Buffer.from(`
    <svg width="154" height="45" viewBox="0 0 154 45" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="154" height="45" rx="23" fill="#050505"/>
      <circle cx="127" cy="22.5" r="5.5" fill="#182128"/>
    </svg>
  `)

  return sharp(phoneBody)
    .composite([
      { input: screen, left: phone.screenX, top: phone.screenY },
      { input: island, left: 183, top: 34 },
    ])
    .png()
    .toBuffer()
}

async function placePhone(background, screenPath, x, y) {
  const device = await createPhone(screenPath)
  return sharp(background)
    .composite([
      { input: phoneShadow, left: x - 30, top: 0 },
      { input: device, left: x, top: y },
    ])
    .png()
    .toBuffer()
}

async function createQrLabel() {
  const qr = await sharp(qrPath).resize(126, 126, { fit: 'contain' }).png().toBuffer()
  return sharp({ create: { width: 150, height: 150, channels: 4, background: '#fffdf9' } })
    .composite([
      { input: qr, left: 12, top: 12 },
      { input: Buffer.from('<svg width="150" height="150" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="148" height="148" rx="8" fill="none" stroke="#d8cbbb" stroke-width="2"/></svg>'), left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}

const cta = Buffer.from(`
  <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ctaBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9f3ea"/><stop offset="1" stop-color="#ead9c5"/></linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="38"/></filter>
    </defs>
    <rect width="1920" height="1080" fill="url(#ctaBg)"/>
    <circle cx="1570" cy="180" r="300" fill="#e76535" fill-opacity="0.13"/>
    <circle cx="260" cy="930" r="370" fill="#30271f" fill-opacity="0.07"/>
    <ellipse cx="960" cy="910" rx="520" ry="52" fill="#2f281f" fill-opacity="0.08" filter="url(#soft)"/>
    <g transform="translate(660 125)">
      <rect x="0" y="88" width="168" height="128" rx="16" fill="#e76535" opacity="0.92"/>
      <path d="M0 90 L84 40 L168 90 L84 142 Z" fill="#ef805b"/>
      <rect x="216" y="62" width="168" height="154" rx="16" fill="#31291f"/>
      <path d="M216 65 L300 15 L384 65 L300 117 Z" fill="#57493b"/>
      <rect x="432" y="96" width="168" height="120" rx="16" fill="#c9b099"/>
      <path d="M432 98 L516 48 L600 98 L516 150 Z" fill="#dfc9b4"/>
    </g>
    <text x="960" y="465" text-anchor="middle" fill="#2f281f" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="800" letter-spacing="-4">Nomo</text>
    <text x="960" y="565" text-anchor="middle" fill="#766a5d" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="600">Pack once. Find anything later.</text>
    <rect x="645" y="630" width="630" height="92" rx="46" fill="#e76535"/>
    <text x="960" y="690" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="39" font-weight="800">Organize 3 boxes free</text>
    <text x="960" y="812" text-anchor="middle" fill="#2f281f" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">Start at /3-box-reset</text>
  </svg>
`)

await mkdir(referenceDir, { recursive: true })

const picture0 = await normalizePhysical(generated(files.master))
const picture1 = await normalizePhysical(generated(files.empty))
const picture2 = await normalizePhysical(generated(files.packed))
const picture7 = await normalizePhysical(generated(files.closed))

const picture3 = await placePhone(picture2, ui('ui-packing-capture.png'), 1240, 20)
const picture4 = await placePhone(neutralBackground, ui('ui-ai-results-before.png'), 700, 20)
const picture5 = await placePhone(neutralBackground, ui('ui-ai-results-after.png'), 700, 20)
const picture6 = await placePhone(neutralBackground, ui('ui-box-1-inventory.png'), 700, 20)
const picture9 = await placePhone(neutralBackground, ui('ui-scanner.png'), 700, 20)

const qrLabel = await createQrLabel()
const picture8 = await sharp(picture7)
  .composite([{ input: qrLabel, left: 1110, top: 570 }])
  .png()
  .toBuffer()
const picture10 = await placePhone(picture8, ui('ui-scanner.png'), 180, 20)

const pictures = [
  ['00-three-open-boxes.png', picture0],
  ['01-box-1-open-empty.png', picture1],
  ['02-box-1-open-packed.png', picture2],
  ['03-iphone-capturing-box.png', picture3],
  ['04-iphone-ai-results-before.png', picture4],
  ['05-iphone-ai-results-after.png', picture5],
  ['06-iphone-box-1-inventory.png', picture6],
  ['07-box-1-closed-unlabeled.png', picture7],
  ['08-box-1-closed-labeled.png', picture8],
  ['09-iphone-scanner.png', picture9],
  ['10-iphone-scanning-label.png', picture10],
  ['11-nomo-cta.png', await sharp(cta).png().toBuffer()],
]

for (const [filename, data] of pictures) {
  await sharp(data).png().toFile(output(filename))
  process.stdout.write(`composed ${filename}\n`)
}
