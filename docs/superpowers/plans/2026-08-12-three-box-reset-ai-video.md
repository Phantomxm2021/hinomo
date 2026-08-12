# 3-Box Reset AI Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fixed 12-image ComfyUI reference pack, five real Nomo mobile-web screenshots, and eleven MiniMax H3 prompts for the approved 38-second 3-Box Reset video.

**Architecture:** A development-only mobile capture page renders controlled Nomo UI states with the production visual system. Playwright captures those states, ImageGen creates the physical scene keyframes, and a Sharp-based compositor embeds screenshots into a consistent silver iPhone 17 Pro Max frame and adds the fixed QR layer. Prompt and asset verification scripts enforce zero-based indexing, dimensions, duration, and story continuity.

**Tech Stack:** React 19, Vite, Tailwind CSS, Vitest, Playwright, Sharp, Node.js, built-in ImageGen, MiniMax H3 Ref2VA prompt format.

---

## File structure

### Development capture surface

- Create `apps/web/creative-capture.html` — Vite development entry for screenshot capture.
- Create `apps/web/src/creative-video/main.tsx` — mounts the selected capture state.
- Create `apps/web/src/creative-video/CaptureStates.tsx` — renders the five controlled mobile Nomo states.
- Create `apps/web/src/creative-video/CaptureStates.test.tsx` — verifies exact text and state differences.

### Video-production package

- Create `creative/three-box-reset-38s/README.md` — operator instructions and fixed reference map.
- Create `creative/three-box-reset-38s/manifest.json` — machine-readable source and reference manifest.
- Create `creative/three-box-reset-38s/image-prompts.md` — exact ImageGen prompts and invariants.
- Create `creative/three-box-reset-38s/source/ui/*.png` — five raw mobile-web screenshots.
- Create `creative/three-box-reset-38s/source/generated/*.png` — generated physical master frames.
- Create `creative/three-box-reset-38s/references/*.png` — final `<Picture 0>` through `<Picture 11>` assets.
- Create `creative/three-box-reset-38s/prompts/clip-01.md` through `clip-11.md` — complete H3 Ref2VA prompts.
- Create `creative/three-box-reset-38s/prompts/master-edit.md` — final timing, copy, audio, and assembly instructions.
- Create `creative/three-box-reset-38s/scripts/capture-ui.mjs` — Playwright screenshot runner.
- Create `creative/three-box-reset-38s/scripts/compose-references.mjs` — deterministic iPhone, UI, QR, and CTA compositor.
- Create `creative/three-box-reset-38s/scripts/verify-package.mjs` — file, dimension, index, and prompt verification.
- Create `creative/three-box-reset-38s/scripts/verify-package.test.mjs` — RED/GREEN tests for package verification.

No production router entry, public asset, database migration, or live customer data is added.

---

### Task 1: Create the fixed package manifest and verifier

**Files:**
- Create: `creative/three-box-reset-38s/manifest.json`
- Create: `creative/three-box-reset-38s/scripts/verify-package.mjs`
- Create: `creative/three-box-reset-38s/scripts/verify-package.test.mjs`

- [ ] **Step 1: Write the failing manifest-verifier test**

Create a temporary package with a missing reference and assert that verification fails, then create all expected empty files and assert that reference names and indices pass while invalid dimensions still fail.

```js
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
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node --test creative/three-box-reset-38s/scripts/verify-package.test.mjs
```

Expected: FAIL because `verify-package.mjs` does not exist.

- [ ] **Step 3: Create the frozen manifest**

The JSON must contain the five raw screenshots and twelve references exactly:

```json
{
  "format": { "width": 1920, "height": 1080, "fps": 30, "duration_seconds": 38 },
  "ui_sources": [
    "ui-packing-capture.png",
    "ui-ai-results-before.png",
    "ui-ai-results-after.png",
    "ui-box-1-inventory.png",
    "ui-scanner.png"
  ],
  "references": [
    { "index": 0, "file": "00-three-open-boxes.png" },
    { "index": 1, "file": "01-box-1-open-empty.png" },
    { "index": 2, "file": "02-box-1-open-packed.png" },
    { "index": 3, "file": "03-iphone-capturing-box.png" },
    { "index": 4, "file": "04-iphone-ai-results-before.png" },
    { "index": 5, "file": "05-iphone-ai-results-after.png" },
    { "index": 6, "file": "06-iphone-box-1-inventory.png" },
    { "index": 7, "file": "07-box-1-closed-unlabeled.png" },
    { "index": 8, "file": "08-box-1-closed-labeled.png" },
    { "index": 9, "file": "09-iphone-scanner.png" },
    { "index": 10, "file": "10-iphone-scanning-label.png" },
    { "index": 11, "file": "11-nomo-cta.png" }
  ]
}
```

- [ ] **Step 4: Implement the verifier**

Export `verifyManifestFiles(root)`, `verifyPromptText(text)`, and `verifyPackage(root)`. Use `sharp(...).metadata()` to require every finished reference to be 1920 × 1080. Require prompt files to contain the six H3 sections in order, reject `<Picture 12>` or higher, reject the phrases `search from`, `Review button`, `view details`, and reject any generated clip duration above five seconds. The CLI accepts `--assets-only` before prompt creation and `--prompts-only` for prompt-focused checks; with no flag it verifies the complete package.

```js
export const REQUIRED_SECTIONS = [
  'subject_definitions:',
  'summary:',
  'retention_analysis:',
  'detailed_description:',
  'overall_soundscape:',
  'non_diegetic_music:',
]

export function verifyPromptText(text) {
  let cursor = -1
  for (const section of REQUIRED_SECTIONS) {
    const next = text.indexOf(section)
    if (next <= cursor) throw new Error(`missing or reordered section: ${section}`)
    cursor = next
  }
  if (/<Picture (?:1[2-9]|[2-9]\d)>/.test(text)) throw new Error('out-of-range picture')
  if (/search from|Review button|view details/i.test(text)) throw new Error('forbidden story action')
  const seconds = [...text.matchAll(/Duration:\s*(\d+(?:\.\d+)?) seconds/g)].map((match) => Number(match[1]))
  if (seconds.some((duration) => duration > 5)) throw new Error('clip exceeds five seconds')
}
```

- [ ] **Step 5: Run the verifier tests**

Run:

```bash
node --test creative/three-box-reset-38s/scripts/verify-package.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add creative/three-box-reset-38s/manifest.json creative/three-box-reset-38s/scripts
git commit -m "chore: define three-box video package"
```

---

### Task 2: Build the real mobile-web capture surface

**Files:**
- Create: `apps/web/creative-capture.html`
- Create: `apps/web/src/creative-video/main.tsx`
- Create: `apps/web/src/creative-video/CaptureStates.tsx`
- Create: `apps/web/src/creative-video/CaptureStates.test.tsx`

- [ ] **Step 1: Write RED component tests**

The tests render each named state and assert exact product behavior:

```tsx
test('pre-add and post-add states differ only by promoted item visibility', () => {
  const { rerender } = render(<CaptureState state="ai-before" />)
  expect(screen.getByText('HDMI cable')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Add to list' })).toBeVisible()

  rerender(<CaptureState state="ai-after" />)
  expect(screen.queryByText('HDMI cable')).not.toBeInTheDocument()
  expect(screen.getByText('Power adapter')).toBeVisible()
  expect(screen.queryByText(/search/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/review/i)).not.toBeInTheDocument()
})

test('inventory and scanner states contain only controlled product data', () => {
  const { rerender } = render(<CaptureState state="inventory" />)
  expect(screen.getByRole('heading', { name: 'Box 1' })).toBeVisible()
  expect(screen.getByText('HDMI cable')).toBeVisible()
  expect(screen.getByText('Power adapter')).toBeVisible()

  rerender(<CaptureState state="scanner" />)
  expect(screen.getByRole('heading', { name: 'Scan to view' })).toBeVisible()
  expect(screen.getByLabelText('QR scanner view')).toBeVisible()
})
```

- [ ] **Step 2: Run the tests and confirm RED**

Run:

```bash
npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx
```

Expected: FAIL because the capture components do not exist.

- [ ] **Step 3: Implement the capture states**

Define the state type exactly:

```tsx
export type CaptureStateName = 'capture' | 'ai-before' | 'ai-after' | 'inventory' | 'scanner'
```

Render a 430 × 932 mobile surface using the production classes and `AppIcon`. The AI states reuse one `DetectedItemCard` component; `ai-after` omits the HDMI item. The inventory state contains only `HDMI cable` and `Power adapter`. The scanner state reuses the production scanner target/corner class names. The capture state shows the actual Nomo packing controls and a neutral camera-preview field; the generated packed-box image is added later by the compositor.

`main.tsx` reads `new URLSearchParams(location.search).get('state')`, defaults to `capture`, stores `nomo-locale=en-US`, imports `../index.css`, and mounts `<CaptureState state={state} />`.

`creative-capture.html` contains only the Vite root and module entry:

```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body><div id="root"></div><script type="module" src="/src/creative-video/main.tsx"></script></body>
</html>
```

- [ ] **Step 4: Run focused tests, typecheck, and lint**

Run:

```bash
npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx
npm run typecheck --workspace=@nomo/web
npm run lint --workspace=@nomo/web
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/creative-capture.html apps/web/src/creative-video
git commit -m "feat: add controlled video capture states"
```

---

### Task 3: Capture and verify the five Nomo screenshots

**Files:**
- Create: `creative/three-box-reset-38s/scripts/capture-ui.mjs`
- Create: `creative/three-box-reset-38s/source/ui/ui-packing-capture.png`
- Create: `creative/three-box-reset-38s/source/ui/ui-ai-results-before.png`
- Create: `creative/three-box-reset-38s/source/ui/ui-ai-results-after.png`
- Create: `creative/three-box-reset-38s/source/ui/ui-box-1-inventory.png`
- Create: `creative/three-box-reset-38s/source/ui/ui-scanner.png`

- [ ] **Step 1: Implement deterministic screenshot capture**

Use Playwright Chromium with `viewport: { width: 430, height: 932 }`, `deviceScaleFactor: 3`, reduced motion, English locale, and hidden pointer. Visit the five query states and capture only `[data-video-capture-root]`.

```js
const states = new Map([
  ['capture', 'ui-packing-capture.png'],
  ['ai-before', 'ui-ai-results-before.png'],
  ['ai-after', 'ui-ai-results-after.png'],
  ['inventory', 'ui-box-1-inventory.png'],
  ['scanner', 'ui-scanner.png'],
])

for (const [state, filename] of states) {
  await page.goto(`http://127.0.0.1:4173/creative-capture.html?state=${state}`)
  await page.locator('[data-video-capture-root]').screenshot({
    path: path.join(outputDir, filename),
    animations: 'disabled',
  })
}
```

- [ ] **Step 2: Start Vite and capture screenshots**

Terminal A:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=capture-anon-key VITE_PUBLIC_APP_ORIGIN=http://127.0.0.1:4173 VITE_PUBLIC_SUPPORT_EMAIL=capture-support@example.com npm run dev --workspace=@nomo/web -- --host 127.0.0.1 --port 4173
```

Terminal B:

```bash
node creative/three-box-reset-38s/scripts/capture-ui.mjs
```

Expected: five PNG files at 1290 × 2796 physical pixels.

- [ ] **Step 3: Inspect all screenshots**

Open each PNG and verify exact English text, no browser chrome, no personal data, no search field, and no Review/view action. Confirm the before screenshot contains `HDMI cable` and the after screenshot does not.

- [ ] **Step 4: Commit**

```bash
git add creative/three-box-reset-38s/scripts/capture-ui.mjs creative/three-box-reset-38s/source/ui
git commit -m "feat: capture three-box mobile UI states"
```

---

### Task 4: Generate the physical keyframe family with ImageGen

**Files:**
- Create: `creative/three-box-reset-38s/image-prompts.md`
- Create: `creative/three-box-reset-38s/source/generated/00-three-open-boxes-source.png`
- Create: `creative/three-box-reset-38s/source/generated/01-box-1-open-empty-source.png`
- Create: `creative/three-box-reset-38s/source/generated/02-box-1-open-packed-source.png`
- Create: `creative/three-box-reset-38s/source/generated/07-box-1-closed-unlabeled-source.png`

- [ ] **Step 1: Save the exact image-generation prompts**

The master prompt is:

```text
Use case: ads-marketing
Asset type: 16:9 product-video keyframe
Primary request: A photorealistic hands-only household organizing scene for Nomo's 3-Box Reset, showing three identical plain corrugated-cardboard cartons arranged horizontally on a clean light-oak floor. All three cartons are fully open and empty. Every carton has four attached fold-over flaps with visible scored hinge lines. No QR label is present anywhere.
Scene/backdrop: warm minimalist living-room storage corner, cream wall, light-oak cabinet, soft window light from camera left, no identifiable address or personal papers
Composition/framing: horizontal 16:9, slightly elevated medium-wide camera, all three carton openings fully visible, Box 1 on the left, useful negative space above
Lighting/mood: warm natural morning light, calm and practical, realistic product-commercial photography
Constraints: identical carton proportions; physically correct cardboard construction; no faces; no people except optional hands outside the box openings; no phone; no labels; no text; no logos; no watermark
Avoid: closed lids, detached lids, self-moving flaps, impossible hinges, QR codes, duplicate objects, distorted hands
```

The empty close-up edit preserves the room and Box 1 identity while moving to an overhead close composition. The packed edit adds only a black HDMI cable, a compact white power adapter, and a small beige tape measure inside Box 1. The closed edit starts from the packed frame and changes only the flap state: two short flaps fold inward first, followed by the two long flaps; no QR label is added.

- [ ] **Step 2: Generate the master frame**

Use one built-in ImageGen call with the master prompt. Save the selected result as `00-three-open-boxes-source.png`. Inspect the image before proceeding.

- [ ] **Step 3: Generate the open-empty close-up**

Use the master as a reference image. Preserve the environment, carton material, Box 1 identity, lighting, and color. Change only the camera framing to a close overhead view of the open empty Box 1. Save as `01-box-1-open-empty-source.png`.

- [ ] **Step 4: Generate the open-packed state**

Edit the open-empty close-up. Add only the controlled HDMI cable, white power adapter, and beige tape measure at the bottom. Keep every flap open, stationary, and unchanged. Save as `02-box-1-open-packed-source.png`.

- [ ] **Step 5: Generate the closed-unlabeled state**

Edit the packed state. Preserve the box, scene, camera, and objects; close the carton with a flat physically plausible top. Do not add a QR label. Save as `07-box-1-closed-unlabeled-source.png`.

- [ ] **Step 6: Visual continuity inspection**

Inspect the four source images side by side. Reject any result where carton count, Box 1 material, floor, lighting, flap construction, or controlled objects drift.

- [ ] **Step 7: Commit**

```bash
git add creative/three-box-reset-38s/image-prompts.md creative/three-box-reset-38s/source/generated
git commit -m "feat: create three-box scene keyframes"
```

---

### Task 5: Compose the fixed `<Picture 0>`–`<Picture 11>` references

**Files:**
- Create: `creative/three-box-reset-38s/scripts/compose-references.mjs`
- Create: `creative/three-box-reset-38s/references/00-three-open-boxes.png`
- Create: `creative/three-box-reset-38s/references/01-box-1-open-empty.png`
- Create: `creative/three-box-reset-38s/references/02-box-1-open-packed.png`
- Create: `creative/three-box-reset-38s/references/03-iphone-capturing-box.png`
- Create: `creative/three-box-reset-38s/references/04-iphone-ai-results-before.png`
- Create: `creative/three-box-reset-38s/references/05-iphone-ai-results-after.png`
- Create: `creative/three-box-reset-38s/references/06-iphone-box-1-inventory.png`
- Create: `creative/three-box-reset-38s/references/07-box-1-closed-unlabeled.png`
- Create: `creative/three-box-reset-38s/references/08-box-1-closed-labeled.png`
- Create: `creative/three-box-reset-38s/references/09-iphone-scanner.png`
- Create: `creative/three-box-reset-38s/references/10-iphone-scanning-label.png`
- Create: `creative/three-box-reset-38s/references/11-nomo-cta.png`

- [ ] **Step 1: Implement the 1920 × 1080 normalizer**

Use Sharp `resize(1920, 1080, { fit: 'cover', position: 'centre' })` for all physical source frames. Do not stretch images.

- [ ] **Step 2: Implement the silver phone compositor**

Create one SVG phone master reused everywhere: a 520 × 1040 silver aluminum body, 20-pixel black inner bezel, 480 × 1000 rounded screen mask, and centered Dynamic Island. Composite the raw 1290 × 2796 web screenshot into the screen before placing the phone over a 1920 × 1080 warm-neutral background. The phone frame geometry must be byte-identical for Pictures 3, 4, 5, 6, and 9.

- [ ] **Step 3: Compose the mixed physical/UI frames**

- Picture 3: `<Picture 2>` as the background, phone at x=1240, y=20, capture screenshot in the screen.
- Picture 10: `<Picture 8>` as the background, phone at x=180, y=20, scanner screenshot in the screen.

Use soft, low-opacity phone shadows. Do not blur or redraw the UI screenshot.

- [ ] **Step 4: Add the fixed QR layer**

Use `apps/web/public/landing/nomo-qr.png` as the QR source. Composite one 150 × 150 white-backed label at x=1110, y=570 on Picture 7 to create Picture 8. The exact same QR pixels and placement must remain visible in Picture 10.

- [ ] **Step 5: Create the deterministic CTA**

Render Picture 11 from SVG at 1920 × 1080 using the Nomo brand colors and exact text:

```text
Nomo
Pack once. Find anything later.
Organize 3 boxes free
Start at /3-box-reset
```

- [ ] **Step 6: Run composition and verification**

Run:

```bash
node creative/three-box-reset-38s/scripts/compose-references.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs --assets-only
```

Expected: twelve PNG references at exactly 1920 × 1080 and no missing or renumbered file.

- [ ] **Step 7: Inspect a contact sheet**

Generate a 4 × 3 contact sheet in memory or as `creative/three-box-reset-38s/references/contact-sheet.png`, inspect it, and delete the contact sheet after approval so it does not become a thirteenth reference.

- [ ] **Step 8: Commit**

```bash
git add creative/three-box-reset-38s/scripts/compose-references.mjs creative/three-box-reset-38s/references
git commit -m "feat: compose three-box video references"
```

---

### Task 6: Write all eleven H3 Ref2VA prompts

**Files:**
- Create: `creative/three-box-reset-38s/prompts/clip-01.md`
- Create: `creative/three-box-reset-38s/prompts/clip-02.md`
- Create: `creative/three-box-reset-38s/prompts/clip-03.md`
- Create: `creative/three-box-reset-38s/prompts/clip-04.md`
- Create: `creative/three-box-reset-38s/prompts/clip-05.md`
- Create: `creative/three-box-reset-38s/prompts/clip-06.md`
- Create: `creative/three-box-reset-38s/prompts/clip-07.md`
- Create: `creative/three-box-reset-38s/prompts/clip-08.md`
- Create: `creative/three-box-reset-38s/prompts/clip-09.md`
- Create: `creative/three-box-reset-38s/prompts/clip-10.md`
- Create: `creative/three-box-reset-38s/prompts/clip-11.md`
- Create: `creative/three-box-reset-38s/prompts/master-edit.md`

- [ ] **Step 1: Write the prompt header contract**

Every clip file contains `Duration: N seconds`, then exactly these six sections in order:

```text
subject_definitions:
summary:
retention_analysis:
detailed_description:
overall_soundscape:
non_diegetic_music:
```

All prompt prose is English. Visible copy remains exact English. Reference labels use only `<Picture 0>` through `<Picture 11>`.

- [ ] **Step 2: Write Clips 1–3**

- Clip 1: 3 seconds, `<Picture 0>`, all three cartons remain open and unlabeled; only a small camera push occurs.
- Clip 2: 4 seconds, `<Picture 1>` to `<Picture 2>`, hands place three objects while all flaps remain open and still.
- Clip 3: 4 seconds, `<Picture 3>`, the phone steadies over the open packed carton and performs one shutter action; the composited screen pixels stay locked.

- [ ] **Step 3: Write Clips 4–6**

- Clip 4: 4 seconds, `<Picture 4>`, subtle loading completion followed by the fixed AI Result List; no search or invented action.
- Clip 5: 4 seconds, `<Picture 4>` to `<Picture 5>`, one finger taps the real `Add to list` button; only the HDMI row disappears and remaining rows move upward.
- Clip 6: 3 seconds, `<Picture 6>`, Box 1 inventory remains readable with restrained phone parallax.

- [ ] **Step 4: Write Clips 7–8**

- Clip 7: 4 seconds, `<Picture 2>` to `<Picture 7>`, short flaps fold inward first, then long flaps, always under direct hand contact; no QR exists.
- Clip 8: 4 seconds, `<Picture 7>` to `<Picture 8>`, one label is introduced, aligned, pressed, and released; QR appears for the first time.

- [ ] **Step 5: Write Clips 9–11**

- Clip 9: 4 seconds, `<Picture 9>` to `<Picture 10>`, the scanner phone moves toward the same fixed QR label and holds steady.
- Clip 10: 2 seconds, `<Picture 10>` to `<Picture 6>`, one scan-confirmation cue and a direct transition into the matching Box 1 inventory.
- Clip 11: 2 seconds, `<Picture 11>`, only a two-percent slow push; text remains static and exact.

- [ ] **Step 6: Write the master edit sheet**

Record the exact 38-second sequence, captions, audio cues, direct-cut policy, and export target. Explicitly state that the QR and UI layers may be re-composited during editing if the model distorts them; this does not create another reference.

- [ ] **Step 7: Verify all prompts**

Run:

```bash
node creative/three-box-reset-38s/scripts/verify-package.mjs
```

Expected: PASS for eleven prompt files, section order, reference range, duration, and forbidden actions.

- [ ] **Step 8: Commit**

```bash
git add creative/three-box-reset-38s/prompts
git commit -m "docs: add three-box H3 prompts"
```

---

### Task 7: Document and perform final package QA

**Files:**
- Create: `creative/three-box-reset-38s/README.md`
- Modify: `creative/three-box-reset-38s/manifest.json`

- [ ] **Step 1: Write operator instructions**

Document the fixed upload order, ComfyUI zero-based indexing, which clips use I2VA-like single anchors versus FL2VA-like endpoint pairs, how to keep UI/QR layers locked, and the exact final edit order.

- [ ] **Step 2: Run all automated checks**

Run:

```bash
npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx
npm run typecheck --workspace=@nomo/web
npm run lint --workspace=@nomo/web
node --test creative/three-box-reset-38s/scripts/verify-package.test.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs
git diff --check
```

Expected: all PASS.

- [ ] **Step 3: Perform visual QA**

Inspect all five raw screenshots and twelve references at full resolution. Confirm phone geometry, UI readability, carton identity, object identity, flap directions, QR timing, QR pixel stability, and exact CTA copy.

- [ ] **Step 4: Check worktree scope**

Run:

```bash
git status --short
git log --oneline --decorate -8
```

Expected: only the intended capture fixture and `creative/three-box-reset-38s` package are changed or committed.

- [ ] **Step 5: Commit final documentation**

```bash
git add creative/three-box-reset-38s/README.md creative/three-box-reset-38s/manifest.json
git commit -m "docs: complete three-box video package"
```

---

## Self-review result

- Spec coverage: all eleven clips, five UI sources, twelve zero-based references, phone consistency, product workflow, QR timing, and acceptance checks map to explicit tasks.
- Placeholder scan: every action, test, path, and expected result is explicit.
- Type consistency: the capture-state names, file names, Picture indices, dimensions, and duration match the approved design specification.
- Scope: the package does not create the final H3-rendered MP4 because no MiniMax/ComfyUI generation endpoint is available in this workspace; it produces every source asset and copy-paste-ready prompt needed to render and assemble it.
