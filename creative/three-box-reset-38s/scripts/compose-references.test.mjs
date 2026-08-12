import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { composeReferences } from './compose-references.mjs'

const packageRoot = path.resolve(import.meta.dirname, '..')

async function rawImage(file) {
  return sharp(file).removeAlpha().raw().toBuffer()
}

test('uses the user-supplied labeled carton unchanged in Picture 9', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'nomo-video-label-'))
  try {
    await composeReferences({ packageRoot, outputDir })

    const picture8 = path.join(outputDir, '08-box-1-closed-unlabeled.png')
    const picture9 = path.join(outputDir, '09-box-1-closed-labeled.png')
    const supplied = path.join(packageRoot, 'source', 'physical', 'box-1-closed-labeled-user.png')

    assert.deepEqual(
      await rawImage(picture9),
      await rawImage(await sharp(supplied).resize(1920, 1080, { fit: 'cover', position: 'centre' }).png().toBuffer()),
      'Picture 9 must use the supplied labeled-carton image without regenerated label art',
    )
    assert.notDeepEqual(await rawImage(picture9), await rawImage(picture8), 'Picture 9 must remain visibly labeled after closure')
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
