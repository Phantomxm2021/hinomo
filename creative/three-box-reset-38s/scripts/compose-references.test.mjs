import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { composeReferences } from './compose-references.mjs'

const packageRoot = path.resolve(import.meta.dirname, '..')

async function rawRegion(file, region) {
  return sharp(file).extract(region).removeAlpha().raw().toBuffer()
}

async function rawImage(file) {
  return sharp(file).removeAlpha().raw().toBuffer()
}

test('keeps the closed carton free of a QR label in Pictures 8 and 10', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'nomo-video-label-'))
  try {
    const formerLabelArea = {
      left: 845,
      top: 700,
      width: 350,
      height: 242,
    }

    await composeReferences({ packageRoot, outputDir })

    const picture7 = path.join(outputDir, '07-box-1-closed-unlabeled.png')
    const picture8 = path.join(outputDir, '08-box-1-closed-labeled.png')
    const picture10 = path.join(outputDir, '10-iphone-scanning-label.png')

    assert.deepEqual(
      await rawImage(picture8),
      await rawImage(picture7),
      'Picture 8 must remain the same clean, unlabeled carton',
    )
    assert.deepEqual(
      await rawRegion(picture10, formerLabelArea),
      await rawRegion(picture7, formerLabelArea),
      'Picture 10 must not place a QR label in the former label area',
    )
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
