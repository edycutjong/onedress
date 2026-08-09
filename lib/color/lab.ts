/**
 * Deterministic color pipeline for OneDress — the reproducible core of the
 * scoring engine (specs/scoring.md §Step 1). hex → sRGB → XYZ → CIELAB (D65),
 * plus the two perceptual skin axes we derive from Lab:
 *   - depth   = Individual Typology Angle (ITA°), the standard dermatological metric
 *   - undertone = Lab hue angle (h°), where warm/cool actually lives
 * Pinned constants (D65 white, sRGB matrix) so the same hex always yields the
 * same Lab — scores are reproducible, never stochastic.
 */

export interface Lab {
  L: number;
  a: number;
  b: number;
}

// D65 reference white (CIE 1931 2°).
const Xn = 95.047;
const Yn = 100.0;
const Zn = 108.883;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 0xff, g: (int >> 8) & 0xff, b: int & 0xff };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** sRGB gamma-decode a single 0–255 channel to linear 0–1. */
function gammaDecode(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const rl = gammaDecode(r);
  const gl = gammaDecode(g);
  const bl = gammaDecode(b);

  // linear sRGB → XYZ (D65), scaled to 0–100
  const X = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100;
  const Y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100;
  const Z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / Xn);
  const fy = f(Y / Yn);
  const fz = f(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function hexToLab(hex: string): Lab {
  const { r, g, b } = hexToRgb(hex);
  return rgbToLab(r, g, b);
}

/** Individual Typology Angle (degrees) — skin depth. Higher = lighter. */
export function ita(lab: Lab): number {
  return (Math.atan2(lab.L - 50, lab.b) * 180) / Math.PI;
}

/** Lab hue angle h° in [0,360) — where undertone (warm/cool) lives. */
export function hueAngle(lab: Lab): number {
  const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return (h + 360) % 360;
}

/** Chroma C*ab = sqrt(a² + b²). */
export function chroma(lab: Lab): number {
  return Math.hypot(lab.a, lab.b);
}

/** Smallest angular distance between two hue angles, in [0,180]. */
export function hueDistance(h1: number, h2: number): number {
  // `((h1 - h2 + 540) % 360) - 180` is the SIGNED shortest difference in [-180,180);
  // its magnitude is already the answer. (This used to return `180 - d`, i.e. the
  // complement — 180 for identical hues — which contradicts the name and the doc.)
  return Math.abs(((h1 - h2 + 540) % 360) - 180);
}

/** ΔE*76 — Euclidean distance in CIELAB. Coarse but adequate for fidelity checks. */
export function deltaE76(a: Lab, b: Lab): number {
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

/** ΔE*00 (CIEDE2000) — perceptually accurate; used for the published render-fidelity number. */
export function deltaE2000(l1: Lab, l2: Lab): number {
  const kL = 1;
  const kC = 1;
  const kH = 1;
  const C1 = Math.hypot(l1.a, l1.b);
  const C2 = Math.hypot(l2.a, l2.b);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * l1.a;
  const a2p = (1 + G) * l2.a;
  const C1p = Math.hypot(a1p, l1.b);
  const C2p = Math.hypot(a2p, l2.b);
  const h1p = hp(l1.b, a1p);
  const h2p = hp(l2.b, a2p);

  const dLp = l2.L - l1.L;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbar = (l1.L + l2.L) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp = (h1p + h2p + 360) / 2;
    else hbarp = (h1p + h2p) / 2;
  } else {
    hbarp = h1p + h2p;
  }

  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;

  return Math.sqrt(
    (dLp / (kL * Sl)) ** 2 +
      (dCp / (kC * Sc)) ** 2 +
      (dHp / (kH * Sh)) ** 2 +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh)),
  );
}

function hp(b: number, ap: number): number {
  if (b === 0 && ap === 0) return 0;
  const h = (Math.atan2(b, ap) * 180) / Math.PI;
  return h >= 0 ? h : h + 360;
}
const rad = (deg: number) => (deg * Math.PI) / 180;
