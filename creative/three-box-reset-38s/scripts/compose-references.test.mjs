import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { FULL_LABEL_PLACEMENT, composeReferences, createAttachedLabel } from './compose-references.mjs'

const packageRoot = path.resolve(import.meta.dirname, '..')

async function rawRegion(file, region) {
  return sharp(file).extract(region).raw().toBuffer()
}

test('places one full horizontal label on the front face and reuses it in Picture 10', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'nomo-video-label-'))
  try {
    assert.deepEqual(FULL_LABEL_PLACEMENT, {
      left: 845,
      top: 700,
      width: 350,
      height: 242,
    })

    const attachedLabel = await createAttachedLabel({
      labelPath: path.join(packageRoot, 'source', 'labels', 'nomo-box-bx-00038.png'),
    })
    const foreground = await sharp(attachedLabel).trim({ background: '#00000000' }).metadata()
    assert.ok((foreground.width ?? 0) > 280, 'the attached paper must span the horizontal information card')
    assert.ok((foreground.width ?? 0) / (foreground.height ?? 1) > 1.35, 'the attached paper must not regress to a square QR-only sticker')

    const result = await composeReferences({ packageRoot, outputDir })
    assert.deepEqual(result.labelPlacement, FULL_LABEL_PLACEMENT)

    const picture7 = await rawRegion(path.join(outputDir, '07-box-1-closed-unlabeled.png'), FULL_LABEL_PLACEMENT)
    const picture8 = await rawRegion(path.join(outputDir, '08-box-1-closed-labeled.png'), FULL_LABEL_PLACEMENT)
    const picture10 = await rawRegion(path.join(outputDir, '10-iphone-scanning-label.png'), FULL_LABEL_PLACEMENT)

    assert.notDeepEqual(picture8, picture7, 'Picture 8 must add the complete label')
    assert.deepEqual(picture10, picture8, 'Picture 10 must reuse identical transformed label pixels')
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
