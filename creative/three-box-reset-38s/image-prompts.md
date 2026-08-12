# 3-Box Reset ImageGen prompts

These prompts define the physical-scene source images used to build `<Picture 0>` through `<Picture 11>`. The scene family must retain the same warm room, carton construction, controlled objects, and morning light.

## 00 — Three open boxes (master)

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

## 01 — Box 1 open and empty

```text
Edit the referenced master image into a matching product-video keyframe. Preserve the exact warm minimalist room, light-oak floor, cream wall, cardboard color and texture, Box 1 proportions, four attached fold-over flaps with scored hinge lines, and soft morning light from camera left. Change only the framing: move to a slightly elevated close overhead view centered on the same left-hand Box 1. The carton is fully open and completely empty, and all four attached flaps remain naturally folded outward. Keep a small amount of the same floor and room context visible around it. Horizontal 16:9 composition. No hands, phone, QR label, text, logo, watermark, detached lid, impossible hinge, duplicate carton, or object inside the box.
```

## 02 — Box 1 open and packed

```text
Edit the referenced open-empty Box 1 image while preserving the exact camera, room, floor, carton identity, proportions, cardboard texture, four attached flaps, shadows, and lighting. Change only the contents: place exactly three separate household items neatly at the bottom of the open carton—a coiled black braided HDMI cable, one compact white wall power adapter, and one small beige tape measure. All four flaps stay fully open, stationary, and unchanged. The objects must sit naturally under gravity with correct scale and no overlap that hides their identity. Horizontal 16:9 product-video keyframe. No hands, phone, QR label, text, logo, watermark, extra items, duplicate objects, closed flap, detached lid, or impossible geometry.
```

## 07 — Box 1 closed and unlabeled

```text
Edit the referenced open-packed Box 1 image into the physically completed packing state. Preserve the exact camera, warm room, floor, carton identity, proportions, cardboard texture, location, shadows, and lighting. Keep the three packed objects inside and fully hidden by the carton. Change only the flap state: the two short attached flaps are folded inward first, then the two long attached flaps fold over them to form a flat, believable closed top along the natural scored hinge lines. The top is held closed without tape and remains structurally plausible. No QR label is attached yet. Horizontal 16:9 product-video keyframe. No hands, phone, text, logo, watermark, open flap, detached lid, floating cardboard, inverted fold direction, extra box, or visible object.
```

## Continuity invariants

- The boxes are standard one-piece corrugated cartons with four attached flaps, never separate lids.
- Box 1 is the same physical carton in 01, 02, and 07.
- The only packed objects are one HDMI cable, one power adapter, and one tape measure.
- A QR label first appears later in composed `<Picture 8>`; ImageGen must not invent one.
- No identifiable person, face, address, personal paper, third-party mark, or generated typography appears.
