import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { FULL_LABEL_PLACEMENT, composeReferences } from './compose-references.mjs'

const packageRoot = path.resolve(import.meta.dirname, '..')

async function rawRegion(file, region) {
  return sharp(file).extract(region).removeAlpha().raw().toBuffer()
}

async function rawImage(file) {
  return sharp(file).removeAlpha().raw().toBuffer()
}

test('places the complete QR label after closure and reuses it in Picture 10', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'nomo-video-label-'))
  try {
    await composeReferences({ packageRoot, outputDir })

    const picture7 = path.join(outputDir, '07-box-1-closed-unlabeled.png')
    const picture8 = path.join(outputDir, '08-box-1-closed-labeled.png')
    const picture10 = path.join(outputDir, '10-iphone-scanning-label.png')

    assert.notDeepEqual(
      await rawImage(picture8),
      await rawImage(picture7),
      'Picture 8 must add the complete Nomo Box label after closure',
    )
    assert.deepEqual(
      await rawRegion(picture10, FULL_LABEL_PLACEMENT),
      await rawRegion(picture8, FULL_LABEL_PLACEMENT),
      'Picture 10 must reuse the exact transformed label pixels from Picture 8',
    )
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
