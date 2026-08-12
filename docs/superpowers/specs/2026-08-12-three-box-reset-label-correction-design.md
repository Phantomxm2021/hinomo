# 3-Box Reset Nomo Box Label Correction Design

**Date:** 2026-08-12
**Status:** Approved design awaiting written-spec review
**Branch:** `codex/three-box-reset-ai-video`

## Problem

The current `<Picture 8>` and `<Picture 10>` use a standalone square QR sticker. That does not match Nomo's printable product label, which is a horizontal information card containing the QR code, box identity, storage metadata, and scan instruction. The square overlay also appears visually pasted over the carton rather than physically attached to its surface.

## Approved outcome

Replace the square sticker with one complete Nomo Box label attached naturally to the front-right face of the same closed Box 1.

The label content is fixed to:

- `Nomo Box`
- `BX-00038`
- `Space: Living room`
- `Location: Not set`
- `Scan to view box items`
- the existing repository QR image from `apps/web/public/landing/nomo-qr.png`

The label uses the production print-label proportions and colors: 925 × 640 source canvas, `#fffdf8` surface, `#e3d5c5` border, `#30271e` ink, `#df6538` box code, and `#756a5e` secondary copy.

## Placement and physical treatment

- Attach the label to the front-right vertical face of Box 1, not the top or side face.
- Scale it to remain plausible for a printed 92.5 × 64 mm product label while keeping the QR and identity readable in a 1920 × 1080 video.
- Match the carton face with an approximately seven-degree clockwise slope and modest vertical compression.
- Add a restrained contact shadow and visible paper edge so the card reads as adhered paper, not a floating graphic.
- Preserve the existing room, carton, closure seam, lighting, camera, and all other pixels.
- Do not ask a generative model to recreate the QR code or typography. Generate the label deterministically and composite the exact raster layer.

## Continuity rules

- `<Picture 7>` remains the closed, unlabeled carton.
- The complete horizontal label appears for the first time during Clip 08.
- `<Picture 8>` contains exactly one complete Nomo Box label.
- `<Picture 10>` contains the identical label pixels in the identical location because it reuses `<Picture 8>` as its physical background.
- No square QR-only sticker remains anywhere in the reference set.
- The scanner transition still opens the matching Box 1 inventory directly; no additional product action is introduced.

## Files and behavior affected

- Add a deterministic full-label source under `creative/three-box-reset-38s/source/labels/`.
- Update `creative/three-box-reset-38s/scripts/compose-references.mjs` to render and attach the full label.
- Regenerate `<Picture 8>` and `<Picture 10>` only through the composition pipeline.
- Update the locked label region and wording in `creative/three-box-reset-38s/README.md`.
- Update Clip 08, Clip 09, Clip 10, and the master edit sheet so they explicitly refer to the complete horizontal Nomo Box label.
- Keep all reference indices, filenames, clip durations, UI sources, phone geometry, and the 38-second edit unchanged.

## Verification

The correction is accepted only when automated and visual checks establish all of the following:

1. A test fails against the current square QR-only implementation and passes after the correction.
2. The composed label source has the approved 925 × 640 dimensions and required visible copy.
3. `<Picture 8>` and `<Picture 10>` retain identical pixels throughout the full transformed label region.
4. `<Picture 7>` does not contain the label layer.
5. All twelve references remain 1920 × 1080 and all eleven prompt durations still total 38 seconds.
6. Full-resolution inspection confirms the label follows the carton face, does not float, remains unique, and is legible enough for the intended shot.
7. Existing web tests, typecheck, lint, package verification, and diff checks remain green.

## Out of scope

- Changing the QR destination or Box 1 inventory data.
- Redesigning the production print-label component.
- Moving the label to the carton top or side.
- Adding another label reference index or changing the video duration.
- Rendering the final MiniMax H3 MP4 inside this repository.
