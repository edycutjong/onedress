# Asset licences — `public/refs/`

Every image committed to this repository must be licensed for **redistribution**, not
merely for use inside the app, because this repository is public. This file is the
record for the 30 garment/jewellery reference images that the render pipeline uploads
as `ref_file_id` (see `lib/pipeline/asset-refs.ts`).

**Rule:** a file with no row in this table must not be committed.

Sources used: **Pexels only.** No Adobe Stock, Getty, Shutterstock, or any source whose
licence bars redistributing the asset as a standalone file.

## Licence terms in force

| Licence | Terms relied on | Text |
|---|---|---|
| Pexels License | Free for commercial and non-commercial use; attribution not required; **modification permitted**; redistribution as part of a product permitted. Prohibited uses we do not engage in: reselling unaltered copies, redistributing on another stock-photo platform, and using identifiable people to imply endorsement. | <https://www.pexels.com/license/> |

Attribution is not required by the Pexels License; it is recorded below anyway so the
provenance of every pixel in this repo is auditable.

## Colorway references — `public/refs/colorways/<id>.jpg`

All 24 colorway references are **derived works** built from a single licensed base
photograph. Ids and target hexes are taken from `lib/colorway/data.ts`, which is the
source of truth.

**Base photograph (one, for all 24):**

| Field | Value |
|---|---|
| Source URL | <https://www.pexels.com/photo/red-dress-on-hanger-19895956/> |
| CDN file | `https://images.pexels.com/photos/19895956/pexels-photo-19895956.jpeg` |
| Photographer | Marcelo Verfe |
| Licence | Pexels License — redistribution and modification permitted |
| Why this one | Single garment, front, hanging, plain studio backdrop, simple cut, no print, no retailer logo or brand label anywhere in frame |

**Derivation applied (identical for all 24 files, only the target colour differs):**

1. The garment is segmented from the studio muslin by CIELAB chroma distance; the
   wooden hanger is removed and the frame is cut at the shoulder line.
2. The blue muslin backdrop is replaced with a flat neutral `#EFEEEC` so `cloth-v3`
   sees a plain background.
3. The garment is remapped in CIELAB to the target colorway: lightness is recentred on
   the target `L*` with a gamut-safe contrast factor, chroma is scaled proportionally,
   and hue variation is flattened onto the target hue. The fabric's own shading, folds
   and pleat structure are preserved — only its colour is changed.

**These 24 files are recoloured derivatives, not unmodified originals.** They are not
photographs of 24 physically distinct dresses and must never be presented as such.

| File | Target hex | Source | Photographer | Licence | Status |
|---|---|---|---|---|---|
| `colorways/terracotta.jpg` | `#C86B4E` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/rust.jpg` | `#B7410E` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/marigold.jpg` | `#EAA221` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/warm-champagne.jpg` | `#E4C591` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/caramel.jpg` | `#AF6E4D` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/warm-burgundy.jpg` | `#7B2D3A` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/tomato-red.jpg` | `#E64A32` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/amber.jpg` | `#D89A3A` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/dusty-blue.jpg` | `#7C97B0` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/slate.jpg` | `#55677A` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/navy.jpg` | `#26364F` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/emerald.jpg` | `#1F7A5A` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/eucalyptus.jpg` | `#7D9B86` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/plum.jpg` | `#6E4A6E` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/wine.jpg` | `#5E2233` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/cool-berry.jpg` | `#8E3B5A` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/lavender.jpg` | `#B7A9D0` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/amethyst.jpg` | `#7B5EA7` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/dusty-rose.jpg` | `#C6929E` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/mauve.jpg` | `#9E7E90` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/taupe.jpg` | `#8A7B6E` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/stormy-grey.jpg` | `#7C8288` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/blush-neutral.jpg` | `#E5C1BC` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |
| `colorways/dusty-sage.jpg` | `#9CAF88` | [pexels 19895956](https://www.pexels.com/photo/red-dress-on-hanger-19895956/) | Marcelo Verfe | Pexels License | derived / recoloured |

## Earring references — `public/refs/earrings/<silhouette>-<metal>.jpg`

All six are **unmodified natural photographs** — cropped to a tight product framing and
re-encoded as JPEG, with no colour alteration whatsoever.

| File | Source | Photographer | Licence | Status |
|---|---|---|---|---|
| `earrings/stud-gold.jpg` | [pexels 29193421](https://www.pexels.com/photo/elegant-star-shaped-gold-earrings-for-fashion-jewelry-29193421/) | The Glorious Studio | Pexels License | natural photo — cropped only |
| `earrings/stud-silver.jpg` | [pexels 5370642](https://www.pexels.com/photo/silver-diamond-stud-earrings-on-white-background-5370642/) | The Glorious Studio | Pexels License | natural photo — cropped only |
| `earrings/hoop-gold.jpg` | [pexels 12194348](https://www.pexels.com/photo/close-up-shot-of-gold-earrings-on-white-surface-12194348/) | Melike B | Pexels License | natural photo — cropped only |
| `earrings/hoop-silver.jpg` | [pexels 15799266](https://www.pexels.com/photo/earrings-close-up-15799266/) | COPPERTIST WU | Pexels License | natural photo — cropped only |
| `earrings/drop-gold.jpg` | [pexels 19869443](https://www.pexels.com/photo/display-of-gold-earrings-19869443/) | Atul Mohan | Pexels License | natural photo — cropped only |
| `earrings/drop-silver.jpg` | [pexels 14558499](https://www.pexels.com/photo/earrings-on-white-surface-14558499/) | Eugenia Remark | Pexels License | natural photo — cropped only |

## Compliance checks performed

- **Redistribution.** Every source is Pexels, whose licence permits redistribution and
  modification. No Adobe Stock, Getty or Shutterstock asset is present.
- **No retailer logos / trademarked colour names.** Every frame was inspected; the base
  dress carries no brand label (a candidate shot bearing a visible brand tag was
  rejected for this reason). Colorway names in `lib/colorway/data.ts` are original and
  descriptive.
- **Single garment, front, plain background.** No collages and no multiple garments in
  any frame.
- **Format.** JPEG, longest side ≤ 1611 px (limit 4096), largest file 216 KB
  (limit 10 MB; internal budget 400 KB). 30 files, 3,206,605 bytes (3.06 MB) total.

## Render-fidelity check (target hex vs. the committed file)

Measured on the committed JPEGs: median CIELAB of the garment pixels (everything more
than ΔE00 8 from the flat background) against the target from `lib/colorway/data.ts`,
using `hexToLab` and `deltaE2000` from `lib/color/lab.ts`.

Mean ΔE00 **0.51**, max **2.65** — every colorway is inside the ΔE00 ≤ 3 "not a visible
mismatch" band. The three largest residuals (`marigold`, `blush-neutral`, `amber`) are
gamut-clipping in bright, high-chroma fabric highlights, not a mislabelled swatch.
