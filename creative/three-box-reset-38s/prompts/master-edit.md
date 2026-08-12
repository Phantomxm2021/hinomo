# 3-Box Reset — 38-second master edit

## Technical target

- Canvas: 1920 × 1080, 16:9
- Frame rate: 30 fps constant
- Duration: exactly 38.00 seconds
- Delivery: H.264 MP4, high profile, 15–25 Mbps, AAC 48 kHz
- Reference indexing: ComfyUI zero-based `<Picture 0>` through `<Picture 11>`
- Generation: render each clip separately with its own prompt, then assemble on the locked timeline below

## Locked timeline

| Time | Clip | References | Picture action | Post-production caption / voice-over |
| --- | --- | --- | --- | --- |
| 00:00–00:03 | 01 | `<Picture 0>` | Three open, empty, unlabeled cartons; restrained push | Three boxes. One simple reset. |
| 00:03–00:07 | 02 | `<Picture 1>` → `<Picture 2>` | Place HDMI cable, power adapter, and tape measure into Box 1 | Pack what belongs together. |
| 00:07–00:11 | 03 | `<Picture 3>` | One authentic Nomo `Take a photo` action | Photograph items as you pack. |
| 00:11–00:15 | 04 | `<Picture 4>` | Hold the authentic AI result list | AI turns photos into a list. |
| 00:15–00:19 | 05 | `<Picture 4>` → `<Picture 5>` | Tap `Add to list`; the HDMI row disappears | Add each item to Box 1. |
| 00:19–00:22 | 06 | `<Picture 6>` | Hold the completed three-item Box 1 inventory | Your inventory is saved. |
| 00:22–00:26 | 07 | `<Picture 2>` → `<Picture 7>` | Hands close short flaps first, then long flaps | Close the box. |
| 00:26–00:30 | 08 | `<Picture 7>` → `<Picture 8>` | Attach one complete horizontal Nomo Box label to the front-right face for the first time | Attach one Nomo Box label. |
| 00:30–00:34 | 09 | `<Picture 9>` → `<Picture 10>` | Bring the real scanner toward the QR area inside that same complete label | Scan the label later. |
| 00:34–00:36 | 10 | `<Picture 10>` → `<Picture 6>` | Single scan confirmation; direct cut to Box 1 | Open the matching inventory. |
| 00:36–00:38 | 11 | `<Picture 11>` | Protected Nomo CTA; two-percent push | Organize 3 boxes free. |

## Editorial rules

- Use direct cuts at all clip boundaries. Do not use dissolves, AI morphs, film-burns, or generic transition templates.
- Add captions and voice-over only in post-production; do not ask H3 to render typography. Keep captions in safe negative space and never cover a phone screen, QR label, packed object, or carton flap.
- Use one calm, clear English voice across the full edit. Read the timeline lines naturally; do not add claims, prices, subscription language, or unsupported functionality.
- Run one continuous warm minimal music bed at approximately 96–102 BPM under all clips. Start spare, add a light pulse on the AI result, lift slightly at the label and scan, then resolve cleanly under the CTA.
- Retain each generated clip's practical foley. Normalize dialogue/voice-over first, music second, and foley third; avoid loud whooshes and repeated notification sounds.
- Preserve the exact supplied Nomo screen pixels and the entire fixed horizontal Nomo Box label layer. If a generated clip distorts either the UI or any part of the label—QR, box identity, storage metadata, instruction, or paper edge—re-composite the corresponding protected layer from `<Picture 3>`–`<Picture 6>` or `<Picture 8>`–`<Picture 10>` during editing. This correction does not create a new reference index.
- The label is absent before 00:26, introduced once during Clip 08, and never duplicated. The carton remains open through 00:22 and closes only under continuous hand contact in Clip 07.
- Do not add any unsupported navigation, extra control, dialog, second phone, extra item, separate box lid, detached flap, person identity, or third-party mark.

## Final quality gate

Check the assembled 38-second timeline frame by frame at every cut. Confirm exact duration, zero-based reference mapping, one QR label, correct flap order, readable authentic UI, HDMI-row removal after one tap, three-item inventory, static CTA typography, synchronized foley, and no accidental personal data.
