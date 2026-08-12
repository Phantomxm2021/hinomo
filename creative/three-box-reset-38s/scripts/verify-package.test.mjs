import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { verifyManifestFiles, verifyPromptText } from './verify-package.mjs'

test('requires the frozen zero-based reference set', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nomo-video-'))
  await mkdir(path.join(root, 'references'), { recursive: true })
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify({
    format: { width: 1920, height: 1080, fps: 30, duration_seconds: 38 },
    ui_sources: [],
    references: Array.from({ length: 12 }, (_, index) => ({
      index,
      file: `${String(index).padStart(2, '0')}-frame.png`,
    })),
  }))

  await assert.rejects(() => verifyManifestFiles(root), /missing reference 0/)
})

test('rejects forbidden story actions and unresolved references', () => {
  assert.throws(() => verifyPromptText('Search from the AI result list.'), /forbidden story action/)
  assert.throws(() => verifyPromptText('Use <Picture 12>.'), /out-of-range picture/)
})

test('accepts ordered H3 sections and a duration no longer than five seconds', () => {
  const prompt = `Duration: 4 seconds
subject_definitions:
<Picture 0> is the first-frame anchor.
summary:
[keyframe completion] A short product clip.
retention_analysis:
<Picture 0>: fully_preserved - the frame is retained.
detailed_description:
[Shot 1] The frame remains stable.
overall_soundscape:
Quiet room tone.
non_diegetic_music:
N/A`

  assert.doesNotThrow(() => verifyPromptText(prompt))
})

test('rejects clips longer than five seconds', () => {
  const prompt = `Duration: 6 seconds
subject_definitions:
summary:
retention_analysis:
detailed_description:
overall_soundscape:
non_diegetic_music:`
  assert.throws(() => verifyPromptText(prompt), /clip exceeds five seconds/)
})
