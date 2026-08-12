import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { LABEL_CANVAS, LABEL_COPY, renderNomoBoxLabel } from './nomo-box-label.mjs'

const packageRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(packageRoot, '..', '..')
const qrPath = path.join(repositoryRoot, 'apps', 'web', 'public', 'landing', 'nomo-qr.png')

test('renders the complete production-shaped Nomo Box label', async () => {
  assert.deepEqual(LABEL_CANVAS, { width: 925, height: 640 })
  assert.deepEqual(LABEL_COPY, {
    title: 'Nomo Box',
    code: 'BX-00038',
    space: 'Space: Living room',
    location: 'Location: Not set',
    instruction: 'Scan to view box items',
  })

  const png = await renderNomoBoxLabel({ qrPath })
  const metadata = await sharp(png).metadata()
  assert.equal(metadata.width, 925)
  assert.equal(metadata.height, 640)
  assert.equal(metadata.channels, 4)

  const stats = await sharp(png).stats()
  assert.ok(stats.channels[0].min < 20, 'QR and text must contribute black pixels')
  assert.ok(stats.channels[0].max > 245, 'label must retain its warm white paper')
  assert.ok(stats.channels[1].min < 70, 'brand and QR detail must be present')
})
