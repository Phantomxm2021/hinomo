import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

export const REQUIRED_SECTIONS = [
  'subject_definitions:',
  'summary:',
  'retention_analysis:',
  'detailed_description:',
  'overall_soundscape:',
  'non_diegetic_music:',
]

const EXPECTED_REFERENCE_COUNT = 13
const EXPECTED_UI_SOURCE_COUNT = 6
const EXPECTED_PROMPT_COUNT = 11

async function readManifest(root) {
  const text = await readFile(path.join(root, 'manifest.json'), 'utf8')
  return JSON.parse(text)
}

async function requireFile(file, message) {
  try {
    await access(file)
  } catch {
    throw new Error(message)
  }
}

async function requireDimensions(file, width, height) {
  const metadata = await sharp(file).metadata()
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`${path.basename(file)} must be ${width}x${height}; received ${metadata.width}x${metadata.height}`)
  }
}

export async function verifyManifestFiles(root) {
  const manifest = await readManifest(root)
  const { format, references, ui_sources: uiSources, physical_sources: physicalSources } = manifest

  if (format?.width !== 1920 || format?.height !== 1080 || format?.fps !== 30 || format?.duration_seconds !== 38) {
    throw new Error('manifest format must be 1920x1080, 30 fps, and 38 seconds')
  }
  if (!Array.isArray(references) || references.length !== EXPECTED_REFERENCE_COUNT) {
    throw new Error(`manifest must define ${EXPECTED_REFERENCE_COUNT} references`)
  }

  for (let index = 0; index < EXPECTED_REFERENCE_COUNT; index += 1) {
    const reference = references[index]
    if (reference?.index !== index || typeof reference.file !== 'string' || !reference.file.startsWith(String(index).padStart(2, '0'))) {
      throw new Error(`reference ${index} is reordered or renamed`)
    }
    const file = path.join(root, 'references', reference.file)
    await requireFile(file, `missing reference ${index}: ${reference.file}`)
    await requireDimensions(file, format.width, format.height)
  }

  if (!Array.isArray(uiSources) || uiSources.length !== EXPECTED_UI_SOURCE_COUNT) {
    throw new Error(`manifest must define ${EXPECTED_UI_SOURCE_COUNT} UI sources`)
  }
  for (const filename of uiSources) {
    const file = path.join(root, 'source', 'ui', filename)
    await requireFile(file, `missing UI source: ${filename}`)
    await requireDimensions(file, 1290, 2796)
  }

  if (!Array.isArray(physicalSources) || physicalSources.length !== 1 || physicalSources[0] !== 'box-1-closed-labeled-user.png') throw new Error('manifest must define the user-supplied labeled carton source')
  await requireFile(path.join(root, 'source', 'physical', physicalSources[0]), 'missing user-supplied labeled carton source')

  return manifest
}

export function verifyPromptText(text) {
  if (/<Picture (?:1[3-9]|[2-9]\d)>/.test(text)) throw new Error('out-of-range picture')
  if (/search from|Review button|view details/i.test(text)) throw new Error('forbidden story action')

  const durations = [...text.matchAll(/Duration:\s*(\d+(?:\.\d+)?) seconds/g)].map((match) => Number(match[1]))
  if (durations.some((duration) => duration > 5)) throw new Error('clip exceeds five seconds')

  let cursor = -1
  for (const section of REQUIRED_SECTIONS) {
    const next = text.indexOf(section)
    if (next <= cursor) throw new Error(`missing or reordered section: ${section}`)
    cursor = next
  }
}

export async function verifyPrompts(root) {
  const durations = []
  for (let index = 1; index <= EXPECTED_PROMPT_COUNT; index += 1) {
    const filename = `clip-${String(index).padStart(2, '0')}.md`
    const file = path.join(root, 'prompts', filename)
    await requireFile(file, `missing prompt: ${filename}`)
    const text = await readFile(file, 'utf8')
    verifyPromptText(text)
    const duration = text.match(/Duration:\s*(\d+(?:\.\d+)?) seconds/)
    if (!duration) throw new Error(`missing duration: ${filename}`)
    durations.push(Number(duration[1]))
  }
  const total = durations.reduce((sum, duration) => sum + duration, 0)
  if (total !== 38) throw new Error(`prompt durations must total 38 seconds; received ${total}`)
  await requireFile(path.join(root, 'prompts', 'master-edit.md'), 'missing prompt: master-edit.md')
}

export async function verifyPackage(root, options = {}) {
  const { assetsOnly = false, promptsOnly = false } = options
  if (!promptsOnly) await verifyManifestFiles(root)
  if (!assetsOnly) await verifyPrompts(root)
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const root = path.resolve(scriptDir, '..')
  const args = new Set(process.argv.slice(2))
  await verifyPackage(root, {
    assetsOnly: args.has('--assets-only'),
    promptsOnly: args.has('--prompts-only'),
  })
  process.stdout.write('three-box video package verified\n')
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
