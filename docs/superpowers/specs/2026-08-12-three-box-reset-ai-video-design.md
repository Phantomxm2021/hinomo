# 3-Box Reset AI Video Design

## Goal

Produce a 38-second, 16:9 English product video that demonstrates the complete 3-Box Reset workflow in a believable household setting. The video must explain the real problem first, then prove how Nomo solves it through the mobile interface.

The production uses two source types only:

1. Image-generation keyframes for the room, boxes, hands, objects, phone, QR-label interaction, and end card.
2. Screenshots captured from the real Nomo mobile web interface for every visible product screen.

No live-action recording and no manually recorded phone screen are required.

## Selected direction

The approved direction is **A: scenario-driven**, with approximately 60% physical context and 40% product proof.

The rejected alternatives were an app-heavy tutorial and a lifestyle-heavy brand film. The selected balance keeps the real organizing story understandable while showing enough of the product to prove the result.

## Visual system

- Final format: 1920 × 1080, 16:9, 30 fps, exactly 38 seconds.
- Generation clips: no longer than 5 seconds each.
- Physical environment: clean, warm-neutral household storage area with three matching corrugated-cardboard cartons.
- Human presence: hands only; no face, personal documents, addresses, emails, notifications, or unrelated brands.
- Phone: silver iPhone 17 Pro Max, presented visually as a white/silver device.
- Product UI: English Nomo mobile web interface captured at a consistent mobile viewport and composited into the phone without redesigning text, controls, colors, spacing, or navigation.
- Captions and logo: added as controlled graphic layers or image-generation end-card assets, never invented by the video model.
- Editing: direct cuts; no elaborate transitions.

## Product story and continuity

The binding product flow is:

1. Three cartons begin open and unlabeled.
2. Household objects are placed into Box 1 while it remains open.
3. Nomo photographs the open carton and analyzes its contents.
4. The AI Result List appears.
5. The user taps the real `Add to list` action; the selected item disappears from the AI results after success.
6. Box 1 inventory shows the saved items.
7. Box 1 is closed through physically correct flap movements.
8. One QR label is attached only after the carton is completely closed.
9. Nomo Scanner scans that same label.
10. Nomo opens the matching Box 1 inventory.

There is no search scene and no invented Review or item-view action.

## Final timeline

| Clip | Time | Duration | Story beat | Generation mode |
| --- | ---: | ---: | --- | --- |
| 1 | 0–3s | 3s | Three open, unlabeled cartons; HDMI-cable hook | I2VA |
| 2 | 3–7s | 4s | Place HDMI cable, adapter, and household item into Box 1 | FL2VA |
| 3 | 7–11s | 4s | Silver iPhone photographs the open carton in Nomo | I2VA |
| 4 | 11–15s | 4s | Nomo finishes analysis and shows the AI Result List | I2VA |
| 5 | 15–19s | 4s | Tap `Add to list`; the selected row disappears | FL2VA |
| 6 | 19–22s | 3s | Box 1 inventory proves that the items were saved | I2VA |
| 7 | 22–26s | 4s | Close Box 1 using correct flap directions | FL2VA |
| 8 | 26–30s | 4s | Attach one QR label to the fully closed carton | FL2VA |
| 9 | 30–34s | 4s | Open Nomo Scanner and align the phone with the label | FL2VA |
| 10 | 34–36s | 2s | The scan opens the matching Box 1 inventory | FL2VA |
| 11 | 36–38s | 2s | Nomo end card and campaign CTA | I2VA |

## Raw Nomo screenshot sources

The screenshot files are source layers and are not numbered as H3 references:

1. `ui-packing-capture.png` — Nomo packing-photo capture state.
2. `ui-ai-results-before.png` — AI Result List with `HDMI cable` and its real `Add to list` action visible.
3. `ui-ai-results-after.png` — the same list immediately after successful addition, with the selected row gone and remaining rows moved naturally.
4. `ui-box-1-inventory.png` — Box 1 inventory containing `HDMI cable` and `Power adapter`.
5. `ui-scanner.png` — the real Nomo scanner state.

All screenshots use a controlled account, controlled household-object names, English UI, and no personal data.

## Fixed ComfyUI/H3 reference manifest

The final reference list is frozen and uses zero-based ComfyUI indexing:

| Reference | File | Required state |
| --- | --- | --- |
| `<Picture 0>` | `00-three-open-boxes.png` | Three matching cartons, all open, all empty, no QR labels |
| `<Picture 1>` | `01-box-1-open-empty.png` | Box 1 open and empty; four flaps and scored hinges clearly visible |
| `<Picture 2>` | `02-box-1-open-packed.png` | Same open Box 1 containing the HDMI cable, adapter, and household item |
| `<Picture 3>` | `03-iphone-capturing-box.png` | Silver iPhone 17 Pro Max aimed at the open packed carton; real capture screenshot composited on screen |
| `<Picture 4>` | `04-iphone-ai-results-before.png` | Silver iPhone with the exact pre-add AI Result List screenshot |
| `<Picture 5>` | `05-iphone-ai-results-after.png` | Same phone and UI after the selected item row disappears |
| `<Picture 6>` | `06-iphone-box-1-inventory.png` | Same phone showing the saved Box 1 inventory |
| `<Picture 7>` | `07-box-1-closed-unlabeled.png` | Same carton fully closed with no QR label |
| `<Picture 8>` | `08-box-1-closed-labeled.png` | Same closed carton with one QR label attached in the approved position |
| `<Picture 9>` | `09-iphone-scanner.png` | Same silver iPhone showing the exact Nomo scanner screenshot |
| `<Picture 10>` | `10-iphone-scanning-label.png` | Phone held in front of the same QR label on Box 1, with scanner UI composited |
| `<Picture 11>` | `11-nomo-cta.png` | Final 16:9 Nomo campaign end card |

No reference may be inserted, removed, reordered, or renumbered after asset production begins.

## Reference reuse by clip

- Clip 1 uses `<Picture 0>`.
- Clip 2 transitions from `<Picture 1>` to `<Picture 2>`.
- Clip 3 uses `<Picture 3>`.
- Clip 4 uses `<Picture 4>`.
- Clip 5 transitions from `<Picture 4>` to `<Picture 5>`.
- Clip 6 uses `<Picture 6>`.
- Clip 7 transitions from `<Picture 2>` to `<Picture 7>`.
- Clip 8 transitions from `<Picture 7>` to `<Picture 8>`.
- Clip 9 transitions from `<Picture 9>` to `<Picture 10>`.
- Clip 10 transitions from `<Picture 10>` to `<Picture 6>`.
- Clip 11 uses `<Picture 11>`.

## Screen and interaction safeguards

- Web screenshots remain pixel-faithful when composited into the phone.
- The video model may animate the hand, phone, camera, shallow depth of field, or small reflections, but may not redraw the Nomo interface.
- Clip 5 uses explicit start and end screenshots so the only UI state change is the successful disappearance of the selected AI-result row.
- Clip 10 uses the scanner composition as the first frame and the existing Box 1 inventory reference as the final frame.
- The QR pattern remains a fixed source layer. It may not morph, duplicate, rotate, detach, or become a different code.
- If the video model distorts UI or QR pixels, the locked screenshot or QR layer is composited again during editing; no new asset is introduced.

## Physical-action safeguards

- Box 1 stays open throughout packing, photography, AI analysis, addition, and inventory confirmation.
- Clip 7 begins from the same packed-open state used earlier.
- Every flap rotates only around its actual scored cardboard hinge and only while a hand is touching it.
- The two short flaps fold inward first; the two long flaps follow.
- The QR label first appears in Clip 8, after the carton is fully closed.
- Only one label is attached, and Clip 9 scans that same label.

## Copy and audio

The controlled on-screen copy is:

- `Which box has the HDMI cable?`
- `Pack normally.`
- `Photograph what went in.`
- `Nomo finds the items.`
- `Add it to your list.`
- `Saved to Box 1.`
- `Label the box.`
- `Scan the label.`
- `See what’s inside.`
- `Pack once. Find anything later.`
- `Start at /3-box-reset`

The soundscape uses restrained household handling sounds, phone taps, a shutter cue, cardboard movement, label placement, and one scan-confirmation cue. Background music is a clean, restrained modern instrumental added once across the final edit rather than generated separately for every clip.

## Failure handling

- UI drift: shorten the clip, reduce phone motion, and reapply the original screenshot layer.
- Incorrect item disappearance: regenerate Clip 5 using only `<Picture 4>` and `<Picture 5>` as locked endpoints.
- Incorrect carton physics: regenerate Clip 7 without changing either keyframe and reduce the action to one flap sequence.
- QR drift: keep the QR label static and composite it from `<Picture 8>` during the shot.
- Phone inconsistency: reuse the same silver-device master and screen-mask geometry for every phone asset.

## Acceptance checks

1. Final runtime is exactly 38 seconds at 30 fps and 1920 × 1080.
2. Every clip is no longer than 5 seconds.
3. The phone and physical environment remain visually consistent.
4. All visible Nomo screens match captured product states.
5. `Add to list` causes the selected row to disappear.
6. There is no search or invented Review/view action.
7. Box 1 closes only after inventory confirmation.
8. The QR label appears only after closure and is attached once.
9. Scanning opens the corresponding Box 1 inventory.
10. No personal data, notifications, unrelated logos, or unverifiable claims appear.
