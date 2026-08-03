import { validateNormalizedBox } from './bbox.ts'

Deno.test('normalizes Qwen 1000-grid bounding boxes', () => {
  const box = validateNormalizedBox([120, 250, 800, 900])
  if (JSON.stringify(box) !== JSON.stringify([0.12, 0.25, 0.8, 0.9])) {
    throw new Error(`unexpected normalized box: ${JSON.stringify(box)}`)
  }
})

Deno.test('preserves already normalized bounding boxes', () => {
  const box = validateNormalizedBox([0.12, 0.25, 0.8, 0.9])
  if (JSON.stringify(box) !== JSON.stringify([0.12, 0.25, 0.8, 0.9])) {
    throw new Error(`unexpected normalized box: ${JSON.stringify(box)}`)
  }
})

Deno.test('rejects invalid Qwen grid bounding boxes', () => {
  let rejected = false
  try { validateNormalizedBox([120, 250, 1100, 900]) } catch { rejected = true }
  if (!rejected) throw new Error('out-of-range Qwen box was accepted')
})
