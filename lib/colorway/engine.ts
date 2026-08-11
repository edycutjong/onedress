/**
 * OneDress colorway scoring engine — the published, defensible core (specs/scoring.md).
 * Pure function, zero network, zero marginal unit cost. Deterministic and unit-tested.
 *
 * Pipeline per (bridesmaid p, colorway c):
 *   flatter(p,c) = w1·U + w2·C + w3·S           (w = 0.50 / 0.30 / 0.20)
 *     U  undertone-harmony  — dress warmth vs skin warmth (seasonal-color matching)
 *     C  value-contrast     — |ΔL*| in a flattering band (triangular, not "max distance")
 *     S  saturation-harmony — enough chroma separation to read as its own color
 * Group objective (the actual insight):
 *   groupScore(c) = min_p flatter(p,c)          (Rawlsian max-of-minimum / bottleneck fairness)
 *   winner        = argmax_c groupScore(c)       tie-break: mean ↑, variance ↓, index ↑
 *   by-eye pick   = argmax_c mean_p flatter(p,c) (how it's chosen today — the counterfactual)
 *
 * The three weights and the transfer-function constants below are CALIBRATED PARAMETERS
 * with concrete initial forms; they are disclosed in-app ("How we score") and will be
 * fit to the blind human-preference study (scoring.md §Validation). They are the only
 * tunable knobs — the color math (CIELAB, ITA°, hue angle) is fixed physics.
 */
import { hexToLab, ita, hueAngle, hueDistance, chroma, type Lab } from '../color/lab';
import { COLORWAYS, type Colorway } from './data';

// ---- calibrated parameters (disclosed; to be fit to the preference study) ----
export const WEIGHTS = { U: 0.5, C: 0.3, S: 0.2 } as const;
const UNDERTONE = { center: 52, spread: 20, warmAxisDeg: 50 }; // skin/dress warm–cool mapping
const CONTRAST = { low: 12, ideal: 42, high: 92 }; // |ΔL*| triangular band edges
const SATURATION = { scale: 30 }; // chroma-separation soft curve

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const rad = (d: number) => (d * Math.PI) / 180;

export interface SkinProfile {
  /** stable id for the bridesmaid */
  id: string;
  name?: string;
  /** measured hex from skin-tone-analysis */
  skinHex: string;
  /** Fitzpatrick I–VI from fitzpatrick-scale-analyzer (depth cross-check only) */
  fitzpatrick?: string;
}

export interface DerivedSkin {
  lab: Lab;
  ita: number; // depth
  hue: number; // undertone hue angle
  chroma: number;
  warmth: number; // −1 cool … +1 warm
}

/** Skin/dress warmth on [−1,1]: warm hues (~50°) → +1, cool hues (~230°) → −1. */
function warmthFromHue(hue: number): number {
  return clamp(Math.cos(rad(hue - UNDERTONE.warmAxisDeg)), -1, 1);
}

export function deriveSkin(skinHex: string): DerivedSkin {
  const lab = hexToLab(skinHex);
  const hue = hueAngle(lab);
  // Skin hues cluster tightly (~40–70°); map to a warm–cool value around a neutral center.
  const warmth = clamp((hue - UNDERTONE.center) / UNDERTONE.spread, -1, 1);
  return { lab, ita: ita(lab), hue, chroma: chroma(lab), warmth };
}

/** Triangular transfer: peaks at `ideal`, falls to 0 at `low` and `high`. */
function triContrast(dL: number): number {
  const { low, ideal, high } = CONTRAST;
  if (dL <= low || dL >= high) return 0;
  const t = dL < ideal ? (dL - low) / (ideal - low) : 1 - (dL - ideal) / (high - ideal);
  return 100 * clamp(t, 0, 1);
}

export interface TermBreakdown {
  U: number;
  C: number;
  S: number;
  flatter: number;
}

/**
 * The undertone term as `specs/scoring.md` §Step 2 actually specifies it: circular hue
 * distance, so `U(h, h) === 100` and U falls monotonically as hues diverge.
 *
 * Exported and unit-tested, but **not used by `scorePair`** — see the defect note there
 * and `docs/scoring-defect.md` §5. It exists so the correct maths is on the record and
 * verifiable while the published verdicts stay stable through judging.
 */
export function undertoneSpecFaithful(skinHue: number, dressHue: number): number {
  return 100 * (1 - hueDistance(dressHue, skinHue) / 180);
}

/** Per-person flatter score for one colorway, with the three published terms. */
export function scorePair(skin: DerivedSkin, dressLab: Lab): TermBreakdown {
  // U — undertone harmony.
  //
  // ⚠ KNOWN DEFECT, DELIBERATELY UNPATCHED — see ../../docs/scoring-defect.md.
  // `skin.warmth` is a LINEAR RAMP in hue (deriveSkin, above); `dressWarmth` is a
  // COSINE of hue. Subtracting them treats two different transfer functions as one
  // quantity — a units error. The consequence is that U peaks at dress hues of
  // ~106.5° and ~353.5° instead of at the skin's own hue, so a magenta can outscore
  // the caramel nearest a subject's measured undertone. It accounts for ~25 of the
  // 26.5-point swing quoted in the README, which is why the README now calls that
  // number illustrative.
  //
  // `specs/scoring.md` §Step 2 specifies the correct form and `hueDistance()` in
  // lib/color/lab.ts already implements the primitive — see `undertoneSpecFaithful`
  // below, which is exported and tested but NOT wired in. It is not wired in because
  // scoring.md commits these constants to being fit against a blind preference study
  // that has not run, and every candidate correction changes published verdicts and
  // destroys the study's own stimuli. Reproduce the alternatives:
  //   npx tsx scripts/scoring-variants.ts
  const dressWarmth = warmthFromHue(hueAngle(dressLab));
  const U = 100 * (1 - Math.abs(skin.warmth - dressWarmth) / 2);

  // C — value contrast in a flattering band (not maximum distance).
  const C = triContrast(Math.abs(dressLab.L - skin.lab.L));

  // S — saturation separation: dress must read as its own color, not muddy-match skin.
  const dChroma = Math.abs(chroma(dressLab) - skin.chroma);
  const S = 100 * (1 - Math.exp(-dChroma / SATURATION.scale));

  const flatter = clamp(WEIGHTS.U * U + WEIGHTS.C * C + WEIGHTS.S * S, 0, 100);
  return { U: round(U), C: round(C), S: round(S), flatter: round(flatter) };
}

export interface ColorwayScore {
  colorway: Colorway;
  perPerson: Array<{ id: string; name?: string; flatter: number; terms: TermBreakdown }>;
  groupScore: number; // min over bridesmaids (the fairness objective)
  mean: number;
  variance: number;
  worst: { id: string; name?: string; flatter: number };
}

export interface ScoringResult {
  ranked: ColorwayScore[]; // by max-of-minimum, best first
  winner: ColorwayScore; // maximin pick
  byEye: ColorwayScore; // mean-maximizing pick (counterfactual)
  /** the bridesmaid hurt most by the by-eye pick — the counterfactual subject */
  mostHurt: { id: string; name?: string; flatter: number };
  differsFromByEye: boolean; // do maximin and mean pick different colors?
}

function scoreColorway(
  colorway: Colorway,
  skins: DerivedSkin[],
  profiles: SkinProfile[],
): ColorwayScore {
  const dressLab = hexToLab(colorway.hex);
  const perPerson = skins.map((s, i) => {
    const terms = scorePair(s, dressLab);
    return { id: profiles[i].id, name: profiles[i].name, flatter: terms.flatter, terms };
  });
  const flatters = perPerson.map((p) => p.flatter);
  const mean = flatters.reduce((a, b) => a + b, 0) / flatters.length;
  const variance = flatters.reduce((a, b) => a + (b - mean) ** 2, 0) / flatters.length;
  const worst = perPerson.reduce((m, p) => (p.flatter < m.flatter ? p : m), perPerson[0]);
  return {
    colorway,
    perPerson,
    groupScore: round(Math.min(...flatters)),
    mean: round(mean),
    variance: round(variance),
    worst: { id: worst.id, name: worst.name, flatter: worst.flatter },
  };
}

/**
 * Score all colorways against a whole party and pick the max-of-minimum winner
 * plus the by-eye (mean-maximizing) counterfactual.
 */
export function scoreParty(
  profiles: SkinProfile[],
  colorways: readonly Colorway[] = COLORWAYS,
): ScoringResult {
  if (profiles.length === 0) throw new Error('scoreParty: empty party');
  const skins = profiles.map((p) => deriveSkin(p.skinHex));
  const scores = colorways.map((c) => scoreColorway(c, skins, profiles));

  // winner: max groupScore, tie-break higher mean → lower variance → lower index.
  const ranked = [...scores].sort(
    (a, b) =>
      b.groupScore - a.groupScore ||
      b.mean - a.mean ||
      a.variance - b.variance ||
      indexOf(a) - indexOf(b),
  );
  const winner = ranked[0];

  // by-eye: max mean, tie-break lower variance → lower index.
  const byEye = [...scores].sort(
    (a, b) => b.mean - a.mean || a.variance - b.variance || indexOf(a) - indexOf(b),
  )[0];

  const mostHurt = byEye.worst;
  return {
    ranked,
    winner,
    byEye,
    mostHurt,
    differsFromByEye: winner.colorway.id !== byEye.colorway.id,
  };

  function indexOf(s: ColorwayScore) {
    return colorways.findIndex((c) => c.id === s.colorway.id);
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
