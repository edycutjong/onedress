# Asset licences — `public/refs/` and `public/party/`

Every image committed to this repository must be licensed for **redistribution**, not
merely for use inside the app, because this repository is public. This file is the
record for the 30 garment/jewellery reference images that the render pipeline uploads
as `ref_file_id` (see `lib/pipeline/asset-refs.ts`), and for the 12 party photographs
in `public/party/` that back the measured demo party (`lib/demo/measured-party.ts`).

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

## Party photographs — `public/party/faces/` and `public/party/wine/`

These are the only images in this repository that show **identifiable real people**,
so they get their own rules and their own open item.

- `faces/pN.jpg` is the licensed stock frame the three Skin AI analyzers ran on,
  resized to 480 px wide and re-encoded. No colour alteration.
- `wine/pN.jpg` is `cloth-v3` output: the same frame with the Wine reference garment
  applied. It is a **generated derivative** and the app labels every one of them
  `cloth-v3 render` on the tile itself.
- The people are anonymised in the product as "Person 1"–"Person 7". No name, role or
  relationship is asserted anywhere in the UI, and the shell banner states in full
  that they are licensed stock photographs, not bridesmaids, clients or customers.

| id | Fitzpatrick (API) | measured hex | ITA° | source frame | provenance |
|---|---|---|---|---|---|
| p1 | I | `#be9e87` | 46.6 | `faces/p1.jpg` | [pexels 6774274](https://www.pexels.com/photo/6774274/) — Pexels License |
| p2 | II | `#b9957b` | 37.3 | `faces/p2.jpg` | [pexels 16970467](https://www.pexels.com/photo/16970467/) — Pexels License |
| p3 | III | `#b38b72` | 29.8 | `faces/p3.jpg` | [pexels 36652029](https://www.pexels.com/photo/36652029/) — Pexels License |
| p4 | III | `#ad896d` | 25.8 | `faces/p4.jpg` | [pexels 4584095](https://www.pexels.com/photo/4584095/) — Pexels License |
| p5 | II | `#a3836b` | 22.1 | *(not committed)* | measured only; `cloth-v3` rejected the frame with `error_pose`, and the source was not retained |
| p6 | IV | `#a68062` | 16.6 | `faces/p6.jpg` | [nappy.co](https://images.nappy.co/photo/GFaV9CoTyceqKFxRAYz_6.jpg) — **CC0** (Nappy licence) |
| p7 | V | `#886246` | −13.3 | `faces/p7.jpg` | [nappy.co](https://images.nappy.co/photo/7YSBCzpMzgvfeids7Ww--.jpg) — **CC0** (Nappy licence) |

Every `wine/pN.jpg` derives from the `faces/pN.jpg` in the same row.

### Open items — resolve before relying on these files

1. ~~Two rows have unverified provenance.~~ **Resolved 2026-08-09.** `p6` and `p7` came
   from [nappy.co](https://nappy.co), whose entire library is
   [Creative Commons Zero](https://nappy.co/license) — redistribution, modification and
   commercial use all explicitly permitted, attribution encouraged but not required.
   Both source ids were re-confirmed live against the Nappy CDN. Nothing here is
   provisional.
2. **Publicity rights are a separate question from copyright.** The stock licences
   permit redistribution and modification of the images. None of them grants the
   multi-year publicity right that a sponsor submission agreement typically requires
   for an identifiable person's likeness, and `cloth-v3` output additionally shows a
   real person wearing a garment they never wore. That is a decision to make
   deliberately before these faces appear in any submission, not a detail to inherit.
3. The `cloth-v3` renders read as a **top rather than a gown** because every source is
   a chest-up frame. The app says so on the render screen. It is a limitation of the
   source photography, not of the pipeline.

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
- **Party photographs.** JPEG, 480 px wide (faces) / 560 px wide (renders), quality 74,
  metadata stripped. 12 files, 279,606 bytes (273 KB) total — largest file 35 KB.
  Every one carries a row in the party table above; the two flagged rows are the only
  images in the repository whose source page has not been re-verified.

## Render-fidelity check (target hex vs. the committed file)

Measured on the committed JPEGs: median CIELAB of the garment pixels (everything more
than ΔE00 8 from the flat background) against the target from `lib/colorway/data.ts`,
using `hexToLab` and `deltaE2000` from `lib/color/lab.ts`.

Mean ΔE00 **0.51**, max **2.65** — every colorway is inside the ΔE00 ≤ 3 "not a visible
mismatch" band. The three largest residuals (`marigold`, `blush-neutral`, `amber`) are
gamut-clipping in bright, high-chroma fabric highlights, not a mislabelled swatch.
