import { describe, it, expect } from 'vitest';
import {
  hexToLab,
  hexToRgb,
  rgbToHex,
  ita,
  hueAngle,
  hueDistance,
  chroma,
  deltaE2000,
  deltaE76,
  type Lab,
} from '../lib/color/lab';

// Standard CIELAB (D65, 2°) reference values — these are physics, not our choice,
// so they anchor the whole scoring pipeline to a known-correct color transform.
const REF: Array<[string, [number, number, number]]> = [
  ['#FFFFFF', [100, 0, 0]],
  ['#000000', [0, 0, 0]],
  ['#FF0000', [53.24, 80.09, 67.2]],
  ['#00FF00', [87.74, -86.18, 83.18]],
  ['#0000FF', [32.3, 79.19, -107.86]],
  ['#808080', [53.59, 0, 0]],
];

describe('hexToLab — known CIELAB reference values', () => {
  for (const [hex, [L, a, b]] of REF) {
    it(`${hex} → L*a*b* ≈ (${L}, ${a}, ${b})`, () => {
      const lab = hexToLab(hex);
      expect(lab.L).toBeCloseTo(L, 1);
      expect(lab.a).toBeCloseTo(a, 1);
      expect(lab.b).toBeCloseTo(b, 1);
    });
  }
});

describe('lab helpers', () => {
  it('is deterministic — same hex always yields the same Lab', () => {
    expect(hexToLab('#bb9982')).toEqual(hexToLab('#bb9982'));
  });
  it('ITA° is higher for lighter skin than darker skin', () => {
    expect(ita(hexToLab('#F3DCC9'))).toBeGreaterThan(ita(hexToLab('#5F3B27')));
  });
  it('hue angle of pure red is ~40°', () => {
    expect(hueAngle(hexToLab('#FF0000'))).toBeCloseTo(40, 0);
  });
  it('chroma of grey is ~0, of red is large', () => {
    expect(chroma(hexToLab('#808080'))).toBeLessThan(1);
    expect(chroma(hexToLab('#FF0000'))).toBeGreaterThan(100);
  });
  it('rejects invalid hex', () => {
    expect(() => hexToLab('nope')).toThrow();
  });
});

describe('rgbToHex', () => {
  it('round-trips every colorway hex through rgb and back', () => {
    for (const hex of ['#C86B4E', '#9CAF88', '#26364F', '#000000', '#FFFFFF']) {
      const { r, g, b } = hexToRgb(hex);
      expect(rgbToHex(r, g, b)).toBe(hex);
    }
  });

  it('clamps out-of-gamut channels and rounds fractional ones', () => {
    // The bench samples averaged pixel values, which are fractional and can drift
    // outside 0–255 — the output must still be a legal 6-digit hex.
    expect(rgbToHex(-20, 300, 127.6)).toBe('#00FF80');
  });
});

describe('hueDistance', () => {
  it('is 0 for identical hues and 180 for opposite ones', () => {
    expect(hueDistance(42, 42)).toBe(0);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(200, 20)).toBe(180);
  });

  it('takes the short way round the 0°/360° seam, in both directions', () => {
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(350, 10)).toBe(20);
  });

  it('never exceeds 180°', () => {
    for (let h1 = 0; h1 < 360; h1 += 17) {
      for (let h2 = 0; h2 < 360; h2 += 23) {
        const d = hueDistance(h1, h2);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('deltaE', () => {
  it('is 0 for identical colors', () => {
    expect(deltaE2000(hexToLab('#123456'), hexToLab('#123456'))).toBeCloseTo(0, 5);
    expect(deltaE76(hexToLab('#123456'), hexToLab('#123456'))).toBeCloseTo(0, 5);
  });
  it('is symmetric', () => {
    const a = hexToLab('#AE011C');
    const b = hexToLab('#C86B4E');
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 6);
  });
  it('grows with visible difference', () => {
    const base = hexToLab('#AE011C');
    const near = hexToLab('#B00520');
    const far = hexToLab('#1F7A5A');
    expect(deltaE2000(base, far)).toBeGreaterThan(deltaE2000(base, near));
  });
});

/**
 * The 34 verification pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000
 * color-difference formula: implementation notes, supplementary test data and
 * mathematical observations" — the dataset the paper publishes precisely because
 * these are the cases naive implementations get wrong:
 *   - pairs 1–6 and 25–34: ordinary colors, the sanity floor
 *   - pairs 7–8: one member is achromatic (C* = 0), where hue is undefined
 *   - pairs 9–16: hue angles straddling the 0°/360° discontinuity, where the mean
 *     hue and the hue difference both need the ±360 correction
 * ΔE00 is the number OneDress publishes as its render-fidelity metric, so this is
 * the guard that the number means what the literature says it means.
 */
const CIEDE2000: Array<[Lab, Lab, number]> = (
  [
    [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
    [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
    [50, 2.8361, -74.02, 50, 0, -82.7485, 3.4412],
    [50, -1.3802, -84.2814, 50, 0, -82.7485, 1.0],
    [50, -1.1848, -84.8006, 50, 0, -82.7485, 1.0],
    [50, -0.9009, -85.5211, 50, 0, -82.7485, 1.0],
    [50, 0, 0, 50, -1, 2, 2.3669],
    [50, -1, 2, 50, 0, 0, 2.3669],
    [50, 2.49, -0.001, 50, -2.49, 0.0009, 7.1792],
    [50, 2.49, -0.001, 50, -2.49, 0.001, 7.1792],
    [50, 2.49, -0.001, 50, -2.49, 0.0011, 7.2195],
    [50, 2.49, -0.001, 50, -2.49, 0.0012, 7.2195],
    [50, -0.001, 2.49, 50, 0.0009, -2.49, 4.8045],
    [50, -0.001, 2.49, 50, 0.001, -2.49, 4.8045],
    [50, -0.001, 2.49, 50, 0.0011, -2.49, 4.7461],
    [50, 2.5, 0, 50, 0, -2.5, 4.3065],
    [50, 2.5, 0, 73, 25, -18, 27.1492],
    [50, 2.5, 0, 61, -5, 29, 22.8977],
    [50, 2.5, 0, 56, -27, -3, 31.903],
    [50, 2.5, 0, 58, 24, 15, 19.4535],
    [50, 2.5, 0, 50, 3.1736, 0.5854, 1.0],
    [50, 2.5, 0, 50, 3.2972, 0, 1.0],
    [50, 2.5, 0, 50, 1.8634, 0.5757, 1.0],
    [50, 2.5, 0, 50, 3.2592, 0.335, 1.0],
    [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
    [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
    [61.2901, 3.7196, -5.3901, 61.4292, 2.248, -4.962, 1.8731],
    [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
    [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
    [36.4612, 47.858, 18.3852, 36.2715, 50.5065, 21.2231, 1.4146],
    [90.8027, -2.0831, 1.441, 91.1528, -1.6435, 0.0447, 1.4441],
    [90.9257, -0.5406, -0.9208, 88.6381, -0.8985, -0.7239, 1.5381],
    [6.7747, -0.2908, -2.4247, 5.8714, -0.0985, -2.2286, 0.6377],
    [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
  ] as const
).map(([L1, a1, b1, L2, a2, b2, dE]) => [{ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 }, dE]);

describe('deltaE2000 — CIEDE2000 conformance (Sharma, Wu & Dalal 2005)', () => {
  it('reproduces all 34 published reference pairs to 4 decimal places', () => {
    for (const [l1, l2, expected] of CIEDE2000) {
      expect(deltaE2000(l1, l2)).toBeCloseTo(expected, 4);
    }
  });

  it('is symmetric on every reference pair, including across the hue seam', () => {
    // Reversing the arguments flips the sign of the hue difference, so an
    // implementation that mishandles the ±360 wrap is asymmetric exactly here.
    for (const [l1, l2] of CIEDE2000) {
      expect(deltaE2000(l2, l1)).toBeCloseTo(deltaE2000(l1, l2), 10);
    }
  });

  it('stays finite for achromatic pairs, where the hue angle is undefined', () => {
    const grey = (L: number): Lab => ({ L, a: 0, b: 0 });
    expect(deltaE2000(grey(50), grey(50))).toBe(0);
    const d = deltaE2000(grey(50), grey(60));
    expect(Number.isFinite(d)).toBe(true);
    // Pure lightness difference: ΔE00 = |ΔL| / S_L, with S_L at Lbar = 55.
    const Sl = 1 + (0.015 * 25) / Math.sqrt(20 + 25);
    expect(d).toBeCloseTo(10 / Sl, 10);
  });
});
