# 3-Box Reset Clip 03–10 Rebuild Design

## Goal

Rebuild every reference image, UI capture state, H3 prompt, and timeline entry from Clip 03 onward so the 38-second 16:9 campaign video shows Nomo's real packing and retrieval loop without invented controls or fabricated interface text.

## Scope

Clips 01 and 02 remain unchanged: three open cartons, then the user places the selected items in Box 1. Clips 03–10 are replaced. Clip 11 remains the existing protected CTA.

The supplied screenshots are the authoritative interaction and visual references:

- Camera capture: a real phone-camera composition showing the open carton and its contents, with a shutter control.
- Photo confirmation: the exact captured carton photo, `Retake` at lower left, and `Use Photo` at lower right.
- AI smart list before mutation: recognized items are pending and each has `Add to list`.
- AI smart list after one mutation: one selected item is no longer pending; the submission notice and remaining pending items remain.
- Box details: a saved inventory list with Nomo's warm white, charcoal, and orange visual system.
- Scanner: Nomo's `Scan to view` view and its camera framing region.
- Physical label: one complete horizontal Nomo Box information label attached naturally to the carton front-right face after the carton is closed.

No supplied screenshot is copied verbatim as a claim about specific inventory contents. The campaign uses a planned, internally consistent set of three packing items; every physical-frame item, camera photo, AI candidate, pending state, and saved inventory row must describe the same set.

## Locked Story and Timeline

| Clip | Duration | Required action and output |
| --- | ---: | --- |
| 03 | 4 s | A white iPhone 17 Pro Max displays the authentic camera capture state over the same open, packed Box 1. One finger presses the shutter once. |
| 04 | 3 s | The exact captured photo appears in the confirmation state. A finger presses `Use Photo` once; `Retake` is visible but untouched. |
| 05 | 4 s | The authentic AI smart list presents the three planned items as pending, each with one `Add to list` action. |
| 06 | 3 s | The first planned item is submitted once. It disappears from the pending list; the remaining two stay pending and the matching background-submission notice appears. |
| 07 | 4 s | The authentic Box details state shows the saved first item in the same Box 1 inventory. This makes the single supported mutation legible. |
| 08 | 4 s | Hands close Box 1 using its attached flaps, then attach one complete horizontal Nomo Box QR information label to the front-right vertical carton face. |
| 09 | 4 s | The authentic Nomo scanner is shown on the phone. A match cut places the phone in the room facing the same visible carton label. |
| 10 | 4 s | A restrained scan confirmation is followed by a direct cut to the matching Box details inventory. |

Clip 11 remains 2 seconds, so the total duration stays exactly 38 seconds.

## Asset Architecture

`source/ui/` will contain six controlled mobile UI captures: camera capture, photo confirmation, AI pending, AI after one addition, Box details, and scanner. These captures must use the same controlled seed data and page viewport. The camera capture and confirmation image must depict the real physical Box 1 state rather than a generic placeholder.

`source/generated/` remains the source of the physical room and carton continuity. The reference composer will place the protected UI capture inside the supplied white/silver iPhone 17 Pro Max treatment. It will compose a labeled closed-carton output and a scanning-in-room output from the exact same transformed label layer.

The label source remains a single complete horizontal information card; no QR-only sticker, duplicated label, label before Clip 08, or regenerated label text is permitted.

## H3 Prompt Contract

Every prompt uses the six required Ref2VA sections in English. Clips use concrete `<Picture N>` first/end frames and explicitly lock all supplied Nomo interface pixels. H3 may produce physical motion only: a shutter tap, one `Use Photo` tap, one `Add to list` action, attached-flap closure, physical label placement, phone match move, and minimal scanner confirmation. It must not generate UI typography, controls, page navigation, extra devices, unsupported search or review interactions, or automatic carton closure.

The editor will re-composite protected phone-screen or label layers when a generated frame distorts them. Direct cuts replace any ambiguous browser or app animation.

## Tests and Acceptance Criteria

- The capture route renders all six named state fixtures at the expected 1290 × 2796 mobile source dimensions.
- The reference composer has regression tests proving the camera and confirmation states use the same physical source image; the Box 1 item transition contains one supported removal; and the label appears only in the post-closure references.
- The package validator continues to enforce exactly 12 zero-indexed 1920 × 1080 references, the six UI sources, one label source, 11 prompts with the six H3 sections, a five-second maximum per clip, and exactly 38 seconds total.
- Manual frame review confirms physical item continuity; accurate photo confirmation affordances; one `Add to list` mutation; single label placement after closure; one label scan; and direct final Box-details retrieval.

## Non-goals

This change does not alter the live Nomo product, create a real video file, add a search flow, or change the campaign CTA. It produces controlled reference assets and H3 prompts for the user's ComfyUI/MiniMax workflow only.
