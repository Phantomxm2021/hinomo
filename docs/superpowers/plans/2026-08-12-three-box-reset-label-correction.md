# 3-Box Reset Natural Nomo Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating square QR sticker in Pictures 8 and 10 with the complete production-shaped Nomo Box label naturally attached to the front-right face of Box 1.

**Architecture:** Extract deterministic label rendering and carton-face composition into an importable module, then keep the existing reference composer as the orchestration entry point. The full 925 × 640 label is rendered from the repository QR and fixed campaign metadata, transformed as one protected raster layer, and reused without regeneration in Pictures 8 and 10. Tests inspect the real rendered outputs and composited pixels before prompts and operator documentation are synchronized.

**Tech Stack:** Node.js ESM, Sharp/libvips, SVG rasterization, Node test runner, Vitest, TypeScript, Markdown H3 Ref2VA prompts.

## Global Constraints

- Preserve the existing Picture 0–11 zero-based indexing, filenames, 1920 × 1080 dimensions, 30 fps target, and exact 38-second duration.
- The label source is exactly 925 × 640 pixels and contains `Nomo Box`, `BX-00038`, `Space: Living room`, `Location: Not set`, and `Scan to view box items`.
- Use `apps/web/public/landing/nomo-qr.png`; never ask H3 or ImageGen to redraw the QR or label typography.
- Picture 7 remains closed and unlabeled; the complete label first appears during Clip 08 and appears exactly once thereafter.
- Attach the label to the front-right vertical face, with approximately seven-degree clockwise slope, modest vertical compression, paper edge, and contact shadow.
- Picture 8 and Picture 10 reuse the exact same protected label raster and placement.
- Do not add search, a review/view action, another label, another Picture index, another clip, or any new product behavior.

---

### Task 1: Render and test the complete Nomo Box label

**Files:**
- Create: `creative/three-box-reset-38s/scripts/nomo-box-label.mjs`
- Create: `creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs`
- Create: `creative/three-box-reset-38s/source/labels/nomo-box-bx-00038.png`
- Modify: `creative/three-box-reset-38s/manifest.json`
- Modify: `creative/three-box-reset-38s/scripts/verify-package.mjs`

**Interfaces:**
- Consumes: repository QR PNG path and fixed campaign label metadata.
- Produces: `LABEL_CANVAS`, `LABEL_COPY`, `renderNomoBoxLabel({ qrPath }): Promise<Buffer>`, and `writeNomoBoxLabel({ qrPath, outputPath }): Promise<void>`.
- Produces for Task 2: one transparent-free 925 × 640 PNG whose entire content is treated as a protected raster layer.

- [ ] **Step 1: Write the failing label-renderer test**

Create `nomo-box-label.test.mjs` with literal expectations independent of the renderer:

```js
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { LABEL_CANVAS, LABEL_COPY, renderNomoBoxLabel } from './nomo-box-label.mjs'

const packageRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(packageRoot, '..', '..')
const qrPath = path.join(repositoryRoot, 'apps/web/public/landing/nomo-qr.png')

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
```

The production mutation caught by this test is replacing the full label renderer with the previous QR-only square or emitting the wrong physical source size.

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
node --test creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs
```

Expected: FAIL because `nomo-box-label.mjs` does not exist.

- [ ] **Step 3: Implement the minimal label renderer**

Create `nomo-box-label.mjs` with these exports:

```js
export const LABEL_CANVAS = { width: 925, height: 640 }
export const LABEL_COPY = {
  title: 'Nomo Box',
  code: 'BX-00038',
  space: 'Space: Living room',
  location: 'Location: Not set',
  instruction: 'Scan to view box items',
}

export async function renderNomoBoxLabel({ qrPath }) {
  const qr = await sharp(qrPath).resize(390, 390, { fit: 'contain' }).png().toBuffer()
  const plate = Buffer.from(`
    <svg width="925" height="640" xmlns="http://www.w3.org/2000/svg">
      <rect width="925" height="640" rx="28" fill="#fffdf8"/>
      <rect x="2" y="2" width="921" height="636" rx="27" fill="none" stroke="#e3d5c5" stroke-width="4"/>
      <rect x="55" y="110" width="390" height="390" fill="#f7f0e7"/>
      <text x="490" y="180" fill="#30271e" font-family="Arial, sans-serif" font-size="48" font-weight="700">Nomo Box</text>
      <text x="490" y="245" fill="#df6538" font-family="Arial, sans-serif" font-size="34" font-weight="700">BX-00038</text>
      <text x="490" y="330" fill="#30271e" font-family="Arial, sans-serif" font-size="32">Space: Living room</text>
      <text x="490" y="385" fill="#30271e" font-family="Arial, sans-serif" font-size="32">Location: Not set</text>
      <text x="490" y="485" fill="#756a5e" font-family="Arial, sans-serif" font-size="24" font-weight="700">Scan to view box items</text>
    </svg>
  `)
  return sharp(plate).composite([{ input: qr, left: 55, top: 110 }]).png().toBuffer()
}
```

Add `writeNomoBoxLabel` as a thin filesystem boundary around `renderNomoBoxLabel`, and execute it only when the module is called as a script. Use `apply_patch` for the source file and the script itself to generate the PNG.

- [ ] **Step 4: Run GREEN and generate the committed source PNG**

Run:

```bash
node --test creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs
node creative/three-box-reset-38s/scripts/nomo-box-label.mjs
```

Expected: test PASS and `source/labels/nomo-box-bx-00038.png` at 925 × 640.

- [ ] **Step 5: Extend manifest verification**

Add:

```json
"label_sources": [
  { "file": "nomo-box-bx-00038.png", "width": 925, "height": 640 }
]
```

Update `verifyManifestFiles` to require the one declared label source and validate its literal dimensions from the manifest. Do not infer expected dimensions from the generated file.

- [ ] **Step 6: Verify and commit Task 1**

Run:

```bash
node --test creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs --assets-only
git diff --check
```

Expected: all PASS.

Commit:

```bash
git add creative/three-box-reset-38s/scripts/nomo-box-label.mjs \
  creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs \
  creative/three-box-reset-38s/source/labels/nomo-box-bx-00038.png \
  creative/three-box-reset-38s/manifest.json \
  creative/three-box-reset-38s/scripts/verify-package.mjs
git commit -m "feat: render complete Nomo box label"
```

---

### Task 2: Attach the full label naturally and lock its reuse

**Files:**
- Create: `creative/three-box-reset-38s/scripts/compose-references.test.mjs`
- Modify: `creative/three-box-reset-38s/scripts/compose-references.mjs`
- Regenerate: `creative/three-box-reset-38s/references/08-box-1-closed-labeled.png`
- Regenerate: `creative/three-box-reset-38s/references/10-iphone-scanning-label.png`

**Interfaces:**
- Consumes: `source/labels/nomo-box-bx-00038.png` from Task 1 and unchanged Picture 7 background.
- Produces: `FULL_LABEL_PLACEMENT`, `createAttachedLabel({ labelPath }): Promise<{ image: Buffer, left: number, top: number, width: number, height: number }>` and regenerated Pictures 8/10.
- Guarantees: exact transformed label pixels at the same 1920 × 1080 coordinates in Pictures 8 and 10.

- [ ] **Step 1: Write the failing composition test**

Create a real-output integration test. It runs the compositor in a temporary output directory, then asserts observable image behavior:

```js
test('places one full horizontal label on the front face and reuses it in Picture 10', async () => {
  const result = await composeReferences({ packageRoot, outputDir })
  assert.deepEqual(result.labelPlacement, {
    left: 845,
    top: 700,
    width: 350,
    height: 242,
  })

  const region = result.labelPlacement
  const picture7 = await rawRegion(path.join(outputDir, '07-box-1-closed-unlabeled.png'), region)
  const picture8 = await rawRegion(path.join(outputDir, '08-box-1-closed-labeled.png'), region)
  const picture10 = await rawRegion(path.join(outputDir, '10-iphone-scanning-label.png'), region)

  assert.notDeepEqual(picture8, picture7, 'Picture 8 must add the complete label')
  assert.deepEqual(picture10, picture8, 'Picture 10 must reuse identical transformed label pixels')
})
```

The production mutation caught is reverting to a small QR-only square, moving the label between shots, or re-rendering different pixels in Picture 10.

- [ ] **Step 2: Run the test and observe RED**

Run:

```bash
node --test creative/three-box-reset-38s/scripts/compose-references.test.mjs
```

Expected: FAIL because the current composer exports no testable `composeReferences` API and still creates a 150 × 150 square QR label.

- [ ] **Step 3: Refactor the compositor boundary**

Export:

```js
export const FULL_LABEL_PLACEMENT = {
  left: 845,
  top: 735,
  width: 350,
  height: 242,
}

export async function composeReferences({ packageRoot: root = packageRoot, outputDir = referenceDir } = {}) {
  // Existing orchestration moved here without behavior changes outside the label.
  return { labelPlacement: FULL_LABEL_PLACEMENT }
}
```

Keep the existing command-line behavior by invoking `composeReferences()` only when the module is executed directly.

- [ ] **Step 4: Implement the attached-paper raster**

Remove `createQrLabel`. Load the complete label source and create a protected attached layer:

```js
const label = await sharp(labelPath)
  .resize(330, 228, { fit: 'fill' })
  .affine([1, 0.12, -0.035, 0.78], {
    background: '#00000000',
    interpolator: sharp.interpolators.bicubic,
  })
  .extend({ top: 7, right: 10, bottom: 10, left: 8, background: '#00000000' })
  .composite([{ input: contactShadow, left: 0, top: 0, blend: 'dest-over' }])
  .png()
  .toBuffer()
```

Normalize the output to exactly 350 × 242 transparent pixels without stretching the label content. The clockwise slope follows the box face; the vertical compression keeps the card attached to the front face. The contact shadow is a two-to-four-pixel soft brown edge below and right, never a floating drop shadow.

- [ ] **Step 5: Compose Pictures 8 and 10 from the same background**

Composite the one `attachedLabel` buffer at `left=845`, `top=700` on Picture 7 to create Picture 8. Continue deriving Picture 10 by placing the phone over Picture 8, so the label-region pixels outside the phone remain byte-identical. The corrected top coordinate comes from the full-resolution carton-face audit: the visible paper occupies approximately x=865–1145 and y=710–920, inside the front face without touching the floor.

- [ ] **Step 6: Run GREEN, regenerate, and inspect full resolution**

Run:

```bash
node --test creative/three-box-reset-38s/scripts/compose-references.test.mjs
node creative/three-box-reset-38s/scripts/compose-references.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs --assets-only
```

Expected: all PASS. Inspect Pictures 8 and 10 at original resolution. If the label crosses the top/front seam, floats, clips, or becomes unreadable, adjust only `FULL_LABEL_PLACEMENT` and affine values, update the literal test expectation, and rerun RED/GREEN for the corrected approved placement.

- [ ] **Step 7: Commit Task 2**

Run `git diff --check`, then commit:

```bash
git add creative/three-box-reset-38s/scripts/compose-references.mjs \
  creative/three-box-reset-38s/scripts/compose-references.test.mjs \
  creative/three-box-reset-38s/references/08-box-1-closed-labeled.png \
  creative/three-box-reset-38s/references/10-iphone-scanning-label.png
git commit -m "fix: attach natural Nomo box label"
```

---

### Task 3: Synchronize H3 prompts, operator documentation, and final QA

**Files:**
- Modify: `creative/three-box-reset-38s/prompts/clip-08.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-09.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-10.md`
- Modify: `creative/three-box-reset-38s/prompts/master-edit.md`
- Modify: `creative/three-box-reset-38s/README.md`

**Interfaces:**
- Consumes: final label placement and exact raster behavior from Task 2.
- Produces: copy-paste-ready H3 prompts and compositor instructions that refer to the full horizontal label rather than a square QR sticker.

- [ ] **Step 1: Update Clip 08**

Replace QR-only language with these explicit constraints:

```text
The hand holds one complete horizontal Nomo Box information label, not a square QR-only sticker. The protected label contains the QR code at left and the fixed box identity and storage copy at right. Align the full card to the front-right vertical carton face, keep the card under continuous finger contact until adhered, then press the paper from center toward its edges. End exactly on <Picture 8>. Do not crop the information panel, move the label to the carton top, separate the QR from its metadata, bend it across an edge, or regenerate any glyph or QR module.
```

- [ ] **Step 2: Update Clips 09–10 and master edit**

State that the scanner approaches the QR area inside the same complete horizontal Nomo Box label. The full card and all printed metadata remain fixed while the QR region is scanned. Keep Clip durations unchanged.

- [ ] **Step 3: Update README lock-layer instructions**

Replace the square `x=1110, y=570, w=150, h=150` instruction with the tested full-label placement `x=845, y=700, w=350, h=242`. Explain that the entire transformed card—not only its QR area—is the protected overlay.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx
npm run typecheck --workspace=@nomo/web
npm run lint --workspace=@nomo/web
node --test creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs
node --test creative/three-box-reset-38s/scripts/compose-references.test.mjs
node --test creative/three-box-reset-38s/scripts/verify-package.test.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs
git diff --check
```

Expected: all PASS, eleven clip durations total 38 seconds, and twelve references remain 1920 × 1080.

- [ ] **Step 5: Perform final visual and scope QA**

Inspect at full resolution:

- `source/labels/nomo-box-bx-00038.png`
- `references/07-box-1-closed-unlabeled.png`
- `references/08-box-1-closed-labeled.png`
- `references/10-iphone-scanning-label.png`

Confirm full label copy, front-right placement, physical contact, no seam crossing, one label only, no square QR-only sticker, and the same label in Pictures 8 and 10. Run `git status --short` and `git log --oneline -8` to confirm scope.

- [ ] **Step 6: Commit Task 3**

```bash
git add creative/three-box-reset-38s/prompts/clip-08.md \
  creative/three-box-reset-38s/prompts/clip-09.md \
  creative/three-box-reset-38s/prompts/clip-10.md \
  creative/three-box-reset-38s/prompts/master-edit.md \
  creative/three-box-reset-38s/README.md
git commit -m "docs: align video prompts with Nomo label"
```

## Plan self-review

- **Spec coverage:** Complete label copy and source size are Task 1; natural front-face treatment and exact reuse are Task 2; prompt/document synchronization and full QA are Task 3.
- **Placeholder scan:** No TBD, TODO, unspecified test, or deferred implementation remains.
- **Type consistency:** Task 1 exports the label renderer consumed by Task 2; Task 2 exports the one placement used by the integration test and Task 3 documentation.
- **Scope:** No production print-label redesign, new reference index, new clip, or final H3 render is introduced.
