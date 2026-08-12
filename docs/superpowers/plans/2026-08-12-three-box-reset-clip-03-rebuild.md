# 3-Box Reset Clip 03–10 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Clip 03–10 reference assets and H3 prompts around the confirmed Nomo photo, AI-list, label, scanner, and Box-details interaction loop.

**Architecture:** Controlled React capture states produce six 1290 × 2796 UI source images. The reference composer places those protected screens into the 16:9 iPhone scenes and shares one transformed label layer between the labeled carton and scanner composition. The prompt set only animates real physical interaction between locked reference states.

**Tech Stack:** React/TypeScript, Vitest, Playwright capture, Node.js test runner, Sharp, MiniMax H3 Ref2VA prompt files.

## Global Constraints

- Preserve Clip 01, Clip 02, Clip 11, 1920 × 1080, 30 fps, and total duration of exactly 38 seconds.
- Use six UI source files at 1290 × 2796: `ui-camera-capture.png`, `ui-photo-confirmation.png`, `ui-ai-pending.png`, `ui-ai-after-add.png`, `ui-box-details.png`, and `ui-scanner.png`.
- Camera capture and confirmation must use the same physical Box 1 photo; confirmation visibly exposes `Retake` and `Use Photo`.
- Use a consistent three-item set through physical scene, AI list, and inventory; Clip 06 mutates exactly one item.
- Show the complete Nomo Box QR information label once, only after closure in Clip 08; reuse its exact transformed pixels in Clip 10.
- H3 never generates Nomo UI text, controls, label text, QR modules, a search flow, a review action, or automatic carton motion.

---

### Task 1: Rebuild Controlled UI Capture States

**Files:**
- Modify: `apps/web/src/creative-video/CaptureStates.tsx`
- Modify: `apps/web/src/creative-video/main.tsx`
- Modify: `apps/web/src/creative-video/CaptureStates.test.tsx`
- Modify: `creative/three-box-reset-38s/scripts/capture-ui.mjs`

**Interfaces:**
- Consumes: `CaptureStateName` query string in `main.tsx`.
- Produces: six renderable state names and six corresponding source PNG captures.

- [ ] **Step 1: Write failing state assertions**

```tsx
render(<CaptureState state="photo-confirmation" />)
expect(screen.getByRole('button', { name: 'Retake photo' })).toBeVisible()
expect(screen.getByRole('button', { name: 'Use photo' })).toBeVisible()

rerender(<CaptureState state="ai-after-add" />)
expect(screen.getByText('2 items pending')).toBeVisible()
expect(screen.queryByText('HDMI cable')).not.toBeInTheDocument()
expect(screen.getByText(/submitted and being added/i)).toBeVisible()
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx`

Expected: FAIL because `photo-confirmation` and `ai-after-add` are not valid controlled states.

- [ ] **Step 3: Implement the six controlled states**

```tsx
export type CaptureStateName =
  | 'camera-capture'
  | 'photo-confirmation'
  | 'ai-pending'
  | 'ai-after-add'
  | 'box-details'
  | 'scanner'
```

Render the same prepared carton photo in `CameraCaptureState` and `PhotoConfirmationState`. Render `Retake` left and `Use Photo` right only in confirmation. Render all three item cards as pending in `AiSmartListState`, then remove the selected HDMI cable and show the submission notice in the after-add state. Use the same saved HDMI cable in Box details. Update the browser state allowlist and capture map to the six required filenames.

- [ ] **Step 4: Run focused state test to verify GREEN**

Run: `npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx`

Expected: PASS; each state exposes only the approved real interaction copy.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/creative-video/CaptureStates.tsx apps/web/src/creative-video/main.tsx apps/web/src/creative-video/CaptureStates.test.tsx creative/three-box-reset-38s/scripts/capture-ui.mjs
git commit -m "feat: rebuild controlled video capture states"
```

### Task 2: Compose Corrected 16:9 References

**Files:**
- Modify: `creative/three-box-reset-38s/scripts/compose-references.mjs`
- Modify: `creative/three-box-reset-38s/scripts/compose-references.test.mjs`
- Modify: `creative/three-box-reset-38s/manifest.json`
- Modify: `creative/three-box-reset-38s/references/03-iphone-capturing-box.png`
- Modify: `creative/three-box-reset-38s/references/04-iphone-ai-results-before.png`
- Modify: `creative/three-box-reset-38s/references/05-iphone-ai-results-after.png`
- Modify: `creative/three-box-reset-38s/references/06-iphone-box-1-inventory.png`
- Modify: `creative/three-box-reset-38s/references/08-box-1-closed-labeled.png`
- Modify: `creative/three-box-reset-38s/references/09-iphone-scanner.png`
- Modify: `creative/three-box-reset-38s/references/10-iphone-scanning-label.png`

**Interfaces:**
- Consumes: the six UI assets from Task 1 and existing physical Box 1 source images.
- Produces: the existing fixed, zero-indexed 12-picture reference set.

- [ ] **Step 1: Write failing composition assertions**

```js
assert.notDeepEqual(
  await rawImage(path.join(outputDir, '08-box-1-closed-labeled.png')),
  await rawImage(path.join(outputDir, '07-box-1-closed-unlabeled.png')),
)
assert.deepEqual(
  await rawRegion(picture10, FULL_LABEL_PLACEMENT),
  await rawRegion(picture8, FULL_LABEL_PLACEMENT),
)
```

Add a second assertion that the chosen camera and photo-confirmation screen assets are different files but each contains the same controlled physical image fixture.

- [ ] **Step 2: Run composer test to verify RED**

Run: `node --test creative/three-box-reset-38s/scripts/compose-references.test.mjs`

Expected: FAIL because the current composer deliberately emits an unlabeled Picture 08 and lacks the new UI source names.

- [ ] **Step 3: Implement shared label and new UI composition**

```js
const attachedLabel = await createAttachedLabel({ labelPath })
const picture8 = await sharp(picture7)
  .composite([{ input: attachedLabel, left: FULL_LABEL_PLACEMENT.left, top: FULL_LABEL_PLACEMENT.top }])
  .png().toBuffer()
const picture10 = await placePhone(picture8, ui('ui-scanner.png'), 180, 20)
```

Map Picture 03 to camera capture; Picture 04 to confirmation; Picture 05 to AI pending; Picture 06 to Box details; Picture 09 to scanner on the neutral background. Restore `FULL_LABEL_PLACEMENT` and use the exact transformed label in both Pictures 08 and 10. Update manifest UI source names while retaining the 12 reference indexes and 38-second total.

- [ ] **Step 4: Re-capture and compose assets**

Run:

```bash
node creative/three-box-reset-38s/scripts/capture-ui.mjs
node creative/three-box-reset-38s/scripts/compose-references.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs --assets-only
```

Expected: all six source captures and all 12 references are present at their required dimensions.

- [ ] **Step 5: Run composer and package tests to verify GREEN**

Run: `node --test creative/three-box-reset-38s/scripts/compose-references.test.mjs creative/three-box-reset-38s/scripts/verify-package.test.mjs creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs`

Expected: PASS; label placement and UI source constraints are enforced.

- [ ] **Step 6: Commit**

```bash
git add creative/three-box-reset-38s
git commit -m "feat: rebuild three-box video references"
```

### Task 3: Rewrite Clip 03–10 H3 Prompts and Editorial Documentation

**Files:**
- Modify: `creative/three-box-reset-38s/prompts/clip-03.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-04.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-05.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-06.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-07.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-08.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-09.md`
- Modify: `creative/three-box-reset-38s/prompts/clip-10.md`
- Modify: `creative/three-box-reset-38s/prompts/master-edit.md`
- Modify: `creative/three-box-reset-38s/README.md`

**Interfaces:**
- Consumes: locked Picture 03–10 reference roles from Task 2.
- Produces: compliant English Ref2VA prompts with six sections and an operator-ready 38-second edit guide.

- [ ] **Step 1: Write failing prompt-policy tests**

```js
assert.throws(
  () => verifyPromptText('Duration: 4 seconds\nsubject_definitions:\n...\ndetailed_description:\nScan an unlabeled carton.\noverall_soundscape:\n...\nnon_diegetic_music:\n...'),
  /unlabeled scanner target/,
)
```

Extend `verifyPromptText` so it rejects an unlabeled scan target and rejects confirmation prompts missing either `Retake` or `Use Photo`.

- [ ] **Step 2: Run prompt-policy test to verify RED**

Run: `node --test creative/three-box-reset-38s/scripts/verify-package.test.mjs`

Expected: FAIL because the current validator does not enforce the new confirmed interaction contract.

- [ ] **Step 3: Implement minimal validator policy and rewrite prompts**

```md
subject_definitions:
- `<Picture 4>` is the locked photo-confirmation screen; `Retake` remains untouched at lower left and `Use Photo` is the only tapped control at lower right.
```

Use the H3 six-section format. Clip 03 must tap shutter once, Clip 04 only taps `Use Photo`, Clip 05 holds three pending items, Clip 06 removes exactly one named item, Clip 07 holds saved Box details, Clip 08 closes then applies one label, Clip 09 targets that label with the scanner, and Clip 10 uses one scan cue then a hard cut to Box details. Update README’s zero-based upload table, generation order, UI-lock instructions, and QA checklist to match.

- [ ] **Step 4: Run prompt and package validation to verify GREEN**

Run: `node --test creative/three-box-reset-38s/scripts/verify-package.test.mjs && node creative/three-box-reset-38s/scripts/verify-package.mjs`

Expected: PASS; all 11 prompts follow the contract and total 38 seconds.

- [ ] **Step 5: Commit**

```bash
git add creative/three-box-reset-38s/prompts creative/three-box-reset-38s/README.md creative/three-box-reset-38s/scripts/verify-package.mjs creative/three-box-reset-38s/scripts/verify-package.test.mjs
git commit -m "docs: rebuild three-box H3 prompt flow"
```

### Task 4: Full Verification and Visual Review

**Files:**
- Verify: `apps/web/src/creative-video/CaptureStates.test.tsx`
- Verify: `creative/three-box-reset-38s/references/03-iphone-capturing-box.png`
- Verify: `creative/three-box-reset-38s/references/04-iphone-ai-results-before.png`
- Verify: `creative/three-box-reset-38s/references/05-iphone-ai-results-after.png`
- Verify: `creative/three-box-reset-38s/references/06-iphone-box-1-inventory.png`
- Verify: `creative/three-box-reset-38s/references/08-box-1-closed-labeled.png`
- Verify: `creative/three-box-reset-38s/references/10-iphone-scanning-label.png`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: fresh, evidence-based readiness report for user review.

- [ ] **Step 1: Run the focused automated suite**

Run:

```bash
npm test --workspace=@nomo/web -- --run src/creative-video/CaptureStates.test.tsx
npm run typecheck --workspace=@nomo/web
npm run lint --workspace=@nomo/web
node --test creative/three-box-reset-38s/scripts/compose-references.test.mjs creative/three-box-reset-38s/scripts/verify-package.test.mjs creative/three-box-reset-38s/scripts/nomo-box-label.test.mjs
node creative/three-box-reset-38s/scripts/verify-package.mjs
git diff --check
```

- [ ] **Step 2: Inspect the seven critical rendered references**

Confirm the camera screen contains the actual packed-box image; confirmation shows the same photo plus `Retake`/`Use Photo`; AI states change one item only; Box details contains the saved item; the label is on the carton only after closure; and the scanner reference visibly faces that same complete label.

- [ ] **Step 3: Commit any final package-only fixes**

```bash
git add creative/three-box-reset-38s apps/web/src/creative-video
git commit -m "fix: verify three-box video flow"
```

