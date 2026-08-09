import sharp from 'sharp';
import { hexToRgb } from '../lib/color/lab';

/**
 * Deterministic synthetic imagery for the zero-cost path.
 *
 * Two consumers:
 *  - the dry-run transport (`fake-api.ts`) needs real JPEG bytes, because the
 *    pipeline genuinely runs `sharp` over every render (head-crop for the earring
 *    chain, patch sampling for the ΔE distribution). Handing it a stub would skip
 *    exactly the code the bench is supposed to exercise.
 *  - `refs.ts` needs stand-in garment references when `public/refs/` is not
 *    installed, so the run can still reach the render stage.
 *
 * Everything is seeded off a string, so two dry runs on two machines produce byte
 * -identical images and therefore identical ΔE numbers. That is the point: a dry-run
 * report is a FORMAT demonstration with reproducible synthetic inputs, never a
 * measurement of the real API.
 */

/**
 * The colour error the dry-run render deliberately introduces, in raw sRGB channels.
 * Real `cloth-v3` output does not land on the intended hex either (that is the whole
 * reason the ΔE distribution exists) — a dry run that rendered the exact hex would
 * print a ΔE of 0 and teach a reader the wrong thing about the metric.
 */
const DRY_RUN_DRIFT = { r: 13, g: -9, b: 6 } as const;

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — 32-bit, seeded, no dependency, identical output everywhere. */
export function seededRandom(seed: string): () => number {
  let a = fnv1a(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a deterministic index in [0, size) from a string — used to vary fake subjects. */
export function seededIndex(seed: string, size: number): number {
  return fnv1a(seed) % size;
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

async function encode(pixels: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** Half-width of the dress silhouette at vertical fraction `y`, as a fraction of width. */
function dressHalfWidth(y: number): number {
  const top = 0.34;
  const hem = 0.8;
  if (y < top || y > hem) return 0;
  const t = (y - top) / (hem - top);
  return 0.13 + t * 0.13; // A-line: narrow at the shoulders, wide at the hem
}

/**
 * A synthetic full-length render: a figure wearing `hex` on a plain light ground.
 * The geometry matches the real fixtures closely enough that the shipped
 * `HEAD_WINDOW` crop and the bench's garment window both land where they should.
 */
export async function syntheticRender(hex: string, seed: string, drift = true): Promise<Buffer> {
  const W = 512;
  const H = 768;
  const rand = seededRandom(seed);
  const base = hexToRgb(hex);
  const dress = drift
    ? {
        r: clamp255(base.r + DRY_RUN_DRIFT.r),
        g: clamp255(base.g + DRY_RUN_DRIFT.g),
        b: clamp255(base.b + DRY_RUN_DRIFT.b),
      }
    : base;

  const px = Buffer.alloc(W * H * 3);
  const skin = { r: 198, g: 158, b: 130 };
  const ground = { r: 238, g: 236, b: 234 };
  const headCx = 0.5;
  const headCy = 0.15;
  const headR = 0.085;

  for (let y = 0; y < H; y++) {
    const fy = y / H;
    const half = dressHalfWidth(fy);
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const i = (y * W + x) * 3;
      // Head: an ellipse in image-fraction space, so the crop finds a face-sized blob.
      const dx = (fx - headCx) * (W / H);
      const dy = fy - headCy;
      let c = ground;
      if (Math.hypot(dx, dy) < headR) {
        c = skin;
      } else if (half > 0 && Math.abs(fx - 0.5) < half) {
        // A lighting falloff across the garment plus fine grain. Without the
        // gradient every patch averages to the same value and the "distribution"
        // would be nine identical samples — which is exactly the n=1 dishonesty
        // this bench exists to replace, reproduced in the demo of the fix.
        const shade = 1.07 - 0.16 * (fx * 0.45 + fy * 0.55);
        const n = (rand() - 0.5) * 10;
        c = {
          r: clamp255(dress.r * shade + n),
          g: clamp255(dress.g * shade + n),
          b: clamp255(dress.b * shade + n),
        };
      }
      px[i] = c.r;
      px[i + 1] = c.g;
      px[i + 2] = c.b;
    }
  }
  return encode(px, W, H);
}

/**
 * Stand-in for `public/refs/colorways/<id>.jpg` — a flat product shot of the garment
 * in the exact catalogue hex, on white. Used ONLY when the real reference set is not
 * installed; the report always says so.
 */
export async function syntheticGarment(hex: string): Promise<Buffer> {
  const W = 384;
  const H = 512;
  const c = hexToRgb(hex);
  const px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const fy = y / H;
    const half = dressHalfWidth(fy);
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const i = (y * W + x) * 3;
      const on = half > 0 && Math.abs(fx - 0.5) < half * 1.4;
      px[i] = on ? c.r : 255;
      px[i + 1] = on ? c.g : 255;
      px[i + 2] = on ? c.b : 255;
    }
  }
  return encode(px, W, H);
}

/** Stand-in earring reference / synthetic earring render — a small metal-toned object. */
export async function syntheticPortrait(seed: string, tint = '#C9A227'): Promise<Buffer> {
  const W = 512;
  const H = 512;
  const c = hexToRgb(tint);
  const rand = seededRandom(seed);
  const px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    const fy = y / H;
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const i = (y * W + x) * 3;
      const inFace = Math.hypot(fx - 0.5, (fy - 0.5) * 0.8) < 0.34;
      const inMetal = Math.hypot(fx - 0.2, fy - 0.62) < 0.05;
      const n = (rand() - 0.5) * 6;
      const col = inMetal ? c : inFace ? { r: 198, g: 158, b: 130 } : { r: 238, g: 236, b: 234 };
      px[i] = clamp255(col.r + n);
      px[i + 1] = clamp255(col.g + n);
      px[i + 2] = clamp255(col.b + n);
    }
  }
  return encode(px, W, H);
}

/** Stand-in subject photo, so a dry run needs no local fixtures at all. */
export async function syntheticSubject(seed: string): Promise<Buffer> {
  return syntheticPortrait(seed, '#9CAF88');
}
