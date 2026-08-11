# Three-Box Reset content production sheet

## Master demo: 38 seconds

Use only self-owned household objects and a self-owned device. Record the Nomo UI in English. Before recording, sign out of unrelated accounts; hide email addresses, physical addresses, browser/account chrome, notifications, and all user data. Use a fresh controlled account and the objects below only.

| Time | Visual | On-screen English copy |
| --- | --- | --- |
| 0–3s | Three identical closed storage boxes | `Which box has the HDMI cable?` |
| 3–9s | Put real objects into Box 1 | `Pack normally.` |
| 9–15s | Take two in-app packing photos | `Photograph what went in.` |
| 15–22s | Show AI checklist, correct one result | `Nomo builds the list.` |
| 22–27s | Download/print and attach QR label | `Label the box.` |
| 27–33s | Search `HDMI cable`; show the box/space result | `Find anything later.` |
| 33–38s | Scan the label, then campaign CTA | `Try the free 3-Box Reset.` |

### Production and export checklist

- [ ] Use three plain, matching boxes; Box 1 contains an HDMI cable, power adapter, and one non-identifying household object.
- [ ] Film hands only; no faces, personal papers, mail, screens with accounts, or identifiable locations.
- [ ] Use a clean English Nomo account seeded solely for this recording; do not use customer data.
- [ ] Keep each action readable at normal playback speed and show the corrected AI result rather than claiming perfect recognition.
- [ ] Export H.264 video with AAC audio, 1080 × 1920, 30 fps, 38 seconds ±3 seconds, and fast-start enabled.
- [ ] Verify duration, video codec, audio codec, frame size, frame rate, and `moov` atom placement with `ffprobe` before publishing.
- [ ] Put the approved file at `apps/web/public/marketing/three-box-reset-demo.mp4`; do not replace it with stock footage, an AI simulation, or a still-image animation.

## Source scripts

Every source video is no-face, uses only controlled household objects and the English UI, includes the disclosure in its caption, and sends every channel to `/3-box-reset`. Do not promise AI accuracy, use personal data, or make a different offer on another platform.

### 1. I packed 37 items without typing their names.

- Exact hook: `I packed 37 items without typing their names.`
- Six-shot sequence:
  1. Hands place a mixed pile beside a plain storage box; hook appears as large text.
  2. Hands place ordinary controlled objects into the box.
  3. Show two quick in-app packing-photo captures with account chrome cropped out.
  4. Show the generated checklist count and scroll once.
  5. Correct one item name in the checklist and save.
  6. Show the labeled box, then the `/3-box-reset` CTA.
- Caption: `I packed 37 items without manually typing a list. Nomo turns packing photos into a checklist, and I still review it before saving. Start with three boxes free: /3-box-reset`
- Community disclosure: `Demo uses a controlled account and my own household objects. AI results are reviewed before saving.`
- CTA: `Try the free 3-Box Reset at /3-box-reset.`
- TikTok/Reels/Shorts (9:16): Keep the hook in the first second, use 0.8–1.5-second cuts, and keep the final CTA card on screen for 2 seconds.
- Pinterest (2:3): Crop to 1000 × 1500. Use a static first-frame title card with the exact hook, retain shots 2–6, and add `Free 3-Box Reset → /3-box-reset` as the final card.

### 2. Which box has the HDMI cable?

- Exact hook: `Which box has the HDMI cable?`
- Six-shot sequence:
  1. Three identical closed boxes fill the frame; the hook is the only text.
  2. Place an HDMI cable into Box 1 with two ordinary accessories.
  3. Capture two packing photos in the English Nomo UI.
  4. Show the reviewed checklist containing `HDMI cable`.
  5. Attach the downloaded QR label to Box 1.
  6. Search `HDMI cable`, reveal Box 1 and its space, then show the CTA.
- Caption: `The cable is in Box 1, not a mystery drawer. Photograph what goes in, review the list, label the box, and search later. /3-box-reset`
- Community disclosure: `Controlled product demo with my own objects; the search result is from the recorded setup.`
- CTA: `Organize 3 boxes free at /3-box-reset.`
- TikTok/Reels/Shorts (9:16): Use the three-box opening as the first frame, preserve the search-result proof, and end on the one-path CTA card.
- Pinterest (2:3): Crop to 1000 × 1500; hold the three-box question card for 2 seconds and retain the label and search-result shots with the same CTA.

### 3. The system I wish I had before moving.

- Exact hook: `The system I wish I had before moving.`
- Six-shot sequence:
  1. Controlled moving-day objects sit beside three unlabeled boxes; hook appears.
  2. Put a cable, adapter, and tape measure into one box.
  3. Show two in-app packing photos.
  4. Show Nomo’s generated checklist and correct one entry.
  5. Print/download a QR label and attach it.
  6. Search an item and show its box and space; end on the CTA.
- Caption: `I do not need a perfect inventory before moving. I need to know where essentials went later. Nomo’s free 3-Box Reset is a simple start: /3-box-reset`
- Community disclosure: `Controlled demo with my own objects. The AI checklist is reviewed and edited before use.`
- CTA: `Start the free 3-Box Reset at /3-box-reset.`
- TikTok/Reels/Shorts (9:16): Make the first scene feel like a reset, not a stressful relocation claim; use large English captions and the same final CTA.
- Pinterest (2:3): Crop to 1000 × 1500, use `The system I wish I had before moving.` as a title card, and retain all proof shots with the single CTA.

### 4. QR labels are useless if setup takes hours.

- Exact hook: `QR labels are useless if setup takes hours.`
- Six-shot sequence:
  1. Show an unhelpful blank QR label beside a closed box; hook appears.
  2. Put controlled objects into the box naturally.
  3. Take two packing photos in Nomo.
  4. Show the AI checklist, edit one result, and save.
  5. Download/print and attach the Nomo QR label.
  6. Scan the label, show the box’s saved contents, and end on the CTA.
- Caption: `A label only helps if making it does not become another project. Photograph, review, label, then find it later. /3-box-reset`
- Community disclosure: `Controlled Nomo demo using my own objects. AI output is reviewed; it is not presented as automatic truth.`
- CTA: `Try the free 3-Box Reset at /3-box-reset.`
- TikTok/Reels/Shorts (9:16): Use a close crop for the opening label, then show the full scan-to-box payoff before the CTA.
- Pinterest (2:3): Crop to 1000 × 1500; preserve legible QR-label and scan shots, with `Free 3-Box Reset → /3-box-reset` on the last card.

## Publishing controls

- [ ] Captions, profile links, pinned comments, and end cards use `/3-box-reset` only.
- [ ] Do not publish until the real approved MP4 passes the export checklist and its on-page fallback was tested.
- [ ] Archive the approved source project, original recordings, export checksum, channel copy, posting time, and operator outside analytics.
