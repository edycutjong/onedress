import { deltaE2000, hexToLab } from '../lib/color/lab';
import { sampleRegionHex } from '../lib/pipeline/head-crop';

/**
 * Render-fidelity ΔE00 as a DISTRIBUTION.
 *
 * The number currently published in the README ("ΔE00 ≈ 7.7") comes from the Phase-0
 * spike, which averaged one torso window of one render down to a single pixel and
 * compared it once. That is n=1 in two different senses — one render, one sample —
 * and it is not a claim anyone should have to accept.
 *
 * This module fixes both: a grid of independent patches across the garment region of
 * EVERY render in the run, each averaged and compared to the intended hex, reported as
 * min / median / max over the whole pool plus a per-render breakdown.
 *
 * Sampling caveat, stated because it is real: the window below is a fixed fraction of
 * the frame, chosen because `cloth-v3` output is consistently framed head-to-toe with
 * the torso centred. On an unusually framed render some patches can clip skin or
 * background, which pushes the max up. That inflates the tail rather than flattering
 * it, so the distribution is conservative, and `--garment-window` lets a reader retune
 * it and re-derive the number themselves.
 */

export interface Window {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Default garment window: the chest/torso panel, below the neckline and above the
 * waist. Inherited from the spike's verified window ({0.42, 0.45, 0.16, 0.12}),
 * widened slightly vertically to give the patch grid room.
 */
export const GARMENT_WINDOW: Window = { left: 0.42, top: 0.45, width: 0.16, height: 0.14 };

/**
 * Where to read the garment's own colour out of a REFERENCE product shot. These are
 * the exact fractions `scripts/spike.ts` used to derive the currently-published
 * "ΔE00 ≈ 7.7", so `--intended ref` measures the same quantity the README claims —
 * only over a distribution instead of a single pixel of a single render.
 */
export const REF_SAMPLE_WINDOW: Window = { left: 0.35, top: 0.3, width: 0.3, height: 0.25 };

/**
 * What "intended" means for a comparison.
 *  - `catalogue`: the colorway's published hex. Correct when the reference garment
 *    really is that colorway (i.e. the shipped `public/refs` set).
 *  - `ref`: the colour actually present in the reference photo. Correct whenever the
 *    reference is a stand-in, and the honest basis for "how faithfully did cloth-v3
 *    transfer THIS garment's colour".
 */
export type IntendedBasis = 'catalogue' | 'ref';

/** Patches per axis. 3 → 9 samples per render. */
export const GRID = 3;

export interface PatchSample {
  /** measured average hex of this patch */
  hex: string;
  /** CIEDE2000 distance from the intended hex */
  dE: number;
}

export interface RenderFidelity {
  subjectId: string;
  subjectName?: string;
  colorwayId: string;
  colorwayName: string;
  intendedHex: string;
  /** what "intended" means for this comparison — catalogue hex, or the reference photo */
  basis: string;
  patches: PatchSample[];
}

/**
 * Sample a GRID×GRID lattice of patches across `window` and compare each to
 * `intendedHex`. Each patch is averaged to one value by `sampleRegionHex` (the same
 * helper the app ships), so the spread across patches is real spatial variation in the
 * render, not sensor noise on a single pixel.
 */
export async function samplePatches(
  image: Buffer,
  intendedHex: string,
  window: Window = GARMENT_WINDOW,
  grid: number = GRID,
): Promise<PatchSample[]> {
  const target = hexToLab(intendedHex);
  const cellW = window.width / grid;
  const cellH = window.height / grid;
  const samples: PatchSample[] = [];

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const hex = await sampleRegionHex(image, {
        left: window.left + col * cellW,
        top: window.top + row * cellH,
        width: cellW,
        height: cellH,
      });
      samples.push({ hex, dE: deltaE2000(target, hexToLab(hex)) });
    }
  }
  return samples;
}

/** Average colour of a reference product shot — the `--intended ref` target value. */
export async function referenceHex(garment: Buffer): Promise<string> {
  return sampleRegionHex(garment, REF_SAMPLE_WINDOW);
}

/** Flatten every patch of every render into one pool — the distribution that gets published. */
export function allDeltas(renders: readonly RenderFidelity[]): number[] {
  return renders.flatMap((r) => r.patches.map((p) => p.dE));
}
