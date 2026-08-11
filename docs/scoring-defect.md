# A defect in our own undertone term — found, quantified, published

**Status: known, unfixed, and deliberately so. Read §5 before judging that choice.**

We found a real bug in the heaviest-weighted half of our scoring engine. It inflates the
headline number in our README, our Devpost description and our demo video. Rather than
quietly patch it four days before the deadline — which would invalidate every proof
artifact in this repo and leave a published video speaking numbers the code no longer
produces — we are publishing the defect, the algebra, the full recomputation under three
candidate corrections, and our reasoning for not shipping any of them yet.

Everything below is reproducible from this repo.

---

## 1. What is wrong

`lib/colorway/engine.ts` computes the undertone-harmony term `U` (weight **0.50**) as:

```ts
const dressWarmth = warmthFromHue(hueAngle(dressLab));   // cos(h_d − 50°)     line 52
const U = 100 * (1 - Math.abs(skin.warmth - dressWarmth) / 2);
//                          ^^^^^^^^^^^^ clamp((h_s − 52) / 20, −1, 1)        line 59
```

The two sides use **different transfer functions**. Skin warmth is a *linear ramp in hue*;
dress warmth is a *cosine of hue*. They are then subtracted as if they were the same
quantity. This is a units error — the same class of mistake as adding metres to feet.

`U` is maximised when `skin.warmth == dressWarmth`, i.e.

```
cos(h_d − 50°) = clamp((h_s − 52)/20, −1, 1)
⇒  h_d = 50° ± arccos((h_s − 52)/20)
```

so the optimum is **not** the skin's own hue, and because `arccos` is two-valued there are
always **two** spurious optima mirrored about the 50° warm axis.

### Worked example — Person 1 of the measured party

`#be9e87`, skin hue **63.04°**:

| | |
|---|---|
| `U` optima | **106.5°** and **353.5°** |
| `U` at her *own* hue (63.04°) | **78.88** |
| Cool Berry `#8E3B5A`, hue 358.8° (magenta, 5° from a spurious peak) | **96.29** |
| Caramel `#AF6E4D`, hue 52.4° (nearest her real hue) | **77.64** |

A magenta beats the caramel nearest her actual undertone by **18.65 U points**. The
function whose own comment reads *"reward matching warm/cool character"* penalises
matching.

### The pathology that settles it

A skin at hue exactly **52°** — the stated neutral centre, ramp warmth `0` — has `U`
maximised at dress hues **140° (green)** and **320° (blue-violet)**, and minimised at warm
golds *and* cool blues simultaneously. No one would defend that as a model of undertone.

### It contradicts our own spec, and the correct primitive is already here

`specs/scoring.md` §Step 2 specifies:

> Compute the circular hue distance … `U = 100 · (1 − Δh / 180)`, so **smaller hue distance
> to the harmony target → higher U**.

The shipped expression does not reduce to that under any reading. Worse: `hueDistance()`
exists in `lib/color/lab.ts:87`, is exported, is unit-tested in `__tests__/lab.test.ts:71-88`
— and **is called from nowhere in production code**. The right primitive was written,
tested, and never wired up. This is unimplemented spec, not an alternative model.

---

## 2. How much of our headline is the bug

Our lead claim is that the by-eye pick scores Esi **38.8** and ours scores **65.3** — a
**26.5-point swing**. Decomposing Esi under Rust:

| | |
|---|---|
| Esi skin hue | **51.20°** |
| Rust hue | **48.17°** |
| circular hue distance | **3.03°** — essentially the same hue |
| shipped `U` | **48.01** (scored as a clash) |
| spec-faithful `U` | **98.32** |
| `C` (contrast) | **0.00** |
| `S` (saturation) | 73.72 |
| shipped `flatter` | **38.75** |
| `flatter` with corrected `U`, C and S untouched | **63.90** |

> **25.15 of the published 26.51-point swing is the defect's own magnitude on one person.**
> `0.5 × (98.32 − 48.01) = 25.15`

**What survives.** Esi's `C` term is genuinely **0.00** — a dark dress on dark skin falls
below the `CONTRAST.low = 12` threshold and the contrast band collapses. That is real
physics and it is the honest core of the counterfactual. But it is worth ~1.4 points, not
26.5. The *direction* of our claim survives; the *magnitude* does not.

**The identity of the most-hurt person is also not robust** — under corrected variants it
moves from Esi to Dania, Bea or Person 3. `README.md` already hedged this
("party-dependent, not structural"); that hedge was doing more work than we knew.

---

## 3. Three candidate corrections

All keep `C`, `S`, the weights, the maximin objective and the tie-breaks untouched.

| | definition |
|---|---|
| **A — minimal/symmetric** | `w_s = cos(h_s − 50°)`; identical hue → `U = 100`. One line. |
| **B — spec-literal** | `U = 100(1 − hueDistance(h_d, h_s)/180)`; target = the skin hue itself. |
| **C — spec-faithful target** | `h_target = 50° + 90°(1 − w)` from the disclosed ramp `w`; `U = 100(1 − hueDistance(h_d, h_target)/180)`. |

### Why B is wrong despite being the literal reading

Human skin hue occupies a narrow warm arc — **51.2°–73.8°** across all 19 profiles in this
project. Sweeping synthetic skin hue 30°→80° and asking which colorway family wins `U`:

| variant | warm | cool | neutral |
|---|---|---|---|
| shipped | 24 | 50 | 27 |
| **A** | 76 | **0** | 25 |
| **B** | 68 | **0** | 33 |
| **C** | 36 | 31 | 34 |

Under A and B **a cool colorway can never top the undertone term for any human being** —
all ten cool colorways become dead weight. That contradicts `scoring.md`'s "cool skin's in
the opposing arc", which is only satisfiable by a mapping that *amplifies* the narrow skin
band. Amplification is exactly what `UNDERTONE.spread` was for.

### Why A is worse than it looks

Under A, on the measured party, `U` varies by **under 1 point across seven different
people** — half the score becomes a person-independent constant. A also makes
`cos(h_s − 50°) ≥ −0.15` for every possible skin hue, so `lib/earring/selector.ts:39` can
**never reach silver again** and half the earring asset set dies silently.

---

## 4. Full recomputation — both shipped parties

Reproduce with the harness in `scripts/scoring-variants.ts`:
`npx tsx scripts/scoring-variants.ts` (pure maths, no network, zero API units).

### Synthetic party (`lib/demo/demo-party.ts`)

| variant | winner | floor | mean | by-eye | differs | most hurt | lift |
|---|---|---|---|---|---|---|---|
| **shipped** | **Marigold** | **57.81** | **65.17** | **Rust** | **yes** | **Esi 38.75** | **+26.51** |
| A | Tomato Red | 64.67 | 77.04 | Rust | yes | Dania 63.19 | +1.48 |
| B | Marigold | 63.13 | 72.10 | Rust | yes | Dania 60.47 | +6.13 |
| C | Marigold | 59.08 | 65.93 | Marigold | **no** | Bea 59.08 | +0.00 |

### Measured party (`lib/demo/measured-party.ts`)

| variant | winner | floor | mean | by-eye | differs | most hurt | lift |
|---|---|---|---|---|---|---|---|
| **shipped** | **Wine** | **56.94** | **72.87** | **Wine** | **no** | P7 56.94 | +0.00 |
| A | Tomato Red | 66.09 | 66.66 | Wine | yes | P7 56.21 | +10.05 |
| B | Rust | 61.40 | 66.01 | Rust | no | P6 61.40 | +0.00 |
| C | Marigold | 56.81 | 64.87 | Marigold | no | P3 56.81 | +0.00 |

**No candidate preserves both published verdicts.** Every candidate also fails
`__tests__/engine.test.ts:99` (`expect(result.differsFromByEye).toBe(true)`) on the test
party — the assertion whose own comment reads *"If this ever fails, the party or weights
changed."* Under **C**, the maximin/mean divergence collapses on **all three** parties: the
counterfactual, this project's central visual proof, ceases to exist.

---

## 5. Why we are not shipping a fix before the deadline

Not cost. **There is no defensible replacement to choose yet.**

`specs/scoring.md` §Validation already commits these constants to being *fit against a blind
human-preference study*. That study is pre-registered
(`../submission/study/preregistration.md`) and **has not been run**. And the corrected
answer swings violently on choices the spec never pins down:

| knob | consequence |
|---|---|
| lobe direction (green vs magenta) | C → Marigold, no divergence · C2 → Blush Neutral, +16.9 divergence |
| `spread` 10 / 20 / 40 | lift +31.75 / +0.00 / +0.00 |
| `center` 52 / 58 | floor 59.08 / 55.02 |

Replacing a demonstrably-wrong guess with an undemonstrated guess — at the cost of every
proof artifact here, six real `cloth-v3` renders, a published video that speaks the numbers
aloud, and the stimuli of a dated pre-registration — is worse engineering than shipping the
wrong one fully explained.

**What we changed instead:** this document, Limitation 4 in the README, the headline
demoted from "26.5-point swing" to the claim that survives every variant, a note under the
video, and an addendum to the study pre-registration. **We did not change `engine.ts`
behaviour, re-render anything, or regenerate the study stimuli.**

### The claim that survives all four variants

The objective you choose changes the winner, and the maximin winner's floor is **never
below** the mean-maximiser's floor. That is a theorem, asserted in
`__tests__/engine.test.ts:69-72`, and it holds under shipped, A, B and C alike. It was
always the real thesis. The 26.5 was only ever its illustration — and a bad one.

---

*Found 2026-08-11 during an independent adversarial review of this repo, four days before
the submission deadline. Published the same day.*
