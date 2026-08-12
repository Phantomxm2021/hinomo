import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(scriptDir, '..')
const outputDir = path.join(packageRoot, 'source', 'ui')
const baseUrl = process.env.NOMO_CAPTURE_ORIGIN ?? 'http://127.0.0.1:4173'

const states = new Map([
  ['capture', 'ui-packing-capture.png'],
  ['ai-before', 'ui-ai-results-before.png'],
  ['ai-after', 'ui-ai-results-after.png'],
  ['inventory', 'ui-box-1-inventory.png'],
  ['scanner', 'ui-scanner.png'],
])

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    colorScheme: 'light',
    locale: 'en-US',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.localStorage.setItem('nomo-locale', 'en-US')
    window.localStorage.setItem('nomo-analytics-consent', 'declined')
  })

  for (const [state, filename] of states) {
    await page.goto(`${baseUrl}/creative-capture.html?state=${state}`, { waitUntil: 'networkidle' })
    const captureRoot = page.locator('[data-video-capture-root]')
    await captureRoot.waitFor({ state: 'visible' })
    await captureRoot.screenshot({
      path: path.join(outputDir, filename),
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
    })
    process.stdout.write(`captured ${filename}\n`)
  }
  await context.close()
} finally {
  await browser.close()
}
