/**
 * Reproduces every number in `docs/scoring-defect.md`.
 *
 *   npx tsx scripts/scoring-variants.ts
 *
 * Pure maths against the real `lib/color/lab.ts` and the real 24-colorway table.
 * No network, no API key, zero units. The SHIPPED variant re-derives the numbers
 * published in the README so you can confirm the harness is faithful before you
 * trust the corrected ones.
 */
import { hexToLab, hueAngle, hueDistance, chroma, type Lab } from '../lib/color/lab';
import { COLORWAYS } from '../lib/colorway/data';

const W = { U: 0.5, C: 0.3, S: 0.2 };
const UND = { center: 52, spread: 20, warmAxis: 50 };
const CON = { low: 12, ideal: 42, high: 92 };
const SAT = 30;

const cl = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const rad = (d: number) => (d * Math.PI) / 180;
const tri = (d: number) => {
  const { low, ideal, high } = CON;
  if (d <= low || d >= high) return 0;
  const t = d < ideal ? (d - low) / (ideal - low) : 1 - (d - ideal) / (high - ideal);
  return 100 * cl(t, 0, 1);
};

export type Variant = 'SHIPPED' | 'A' | 'B' | 'C';

/** The four undertone terms. SHIPPED is the defect; see docs/scoring-defect.md §1. */
export function undertone(v: Variant, skinHue: number, dressHue: number): number {
  const ramp = cl((skinHue - UND.center) / UND.spread, -1, 1); // linear ramp
  const cos = (h: number) => cl(Math.cos(rad(h - UND.warmAxis)), -1, 1);
  switch (v) {
    case 'SHIPPED':
      return 100 * (1 - Math.abs(ramp - cos(dressHue)) / 2); // ← ramp vs cosine: the bug
    case 'A':
      return 100 * (1 - Math.abs(cos(skinHue) - cos(dressHue)) / 2);
    case 'B':
      return 100 * (1 - hueDistance(dressHue, skinHue) / 180);
    case 'C':
      return 100 * (1 - hueDistance(dressHue, UND.warmAxis + 90 * (1 - ramp)) / 180);
  }
}

function flatter(v: Variant, skinHex: string, dress: Lab): number {
  const skin = hexToLab(skinHex);
  const U = undertone(v, hueAngle(skin), hueAngle(dress));
  const C = tri(Math.abs(dress.L - skin.L));
  const S = 100 * (1 - Math.exp(-Math.abs(chroma(dress) - chroma(skin)) / SAT));
  return cl(W.U * U + W.C * C + W.S * S, 0, 100);
}

export function scoreParty(v: Variant, hexes: string[], names: string[]) {
  const rows = COLORWAYS.map((c) => {
    const dress = hexToLab(c.hex);
    const f = hexes.map((h) => flatter(v, h, dress));
    return {
      name: c.name,
      floor: Math.min(...f),
      mean: f.reduce((a, b) => a + b, 0) / f.length,
      f,
    };
  });
  const winner = [...rows].sort((a, b) => b.floor - a.floor || b.mean - a.mean)[0];
  const byEye = [...rows].sort((a, b) => b.mean - a.mean || b.floor - a.floor)[0];
  const i = byEye.f.indexOf(Math.min(...byEye.f));
  return {
    winner: winner.name,
    floor: +winner.floor.toFixed(2),
    mean: +winner.mean.toFixed(2),
    byEye: byEye.name,
    differs: winner.name !== byEye.name,
    mostHurt: `${names[i]} ${byEye.f[i].toFixed(2)}`,
    lift: +(winner.f[i] - byEye.f[i]).toFixed(2),
  };
}

const PARTIES = [
  {
    label: 'SYNTHETIC (lib/demo/demo-party.ts)',
    hexes: ['#F3DCC9', '#E7C9A9', '#D0A375', '#A9714B', '#7A4A33', '#4A2E20'],
    names: ['Ada', 'Bea', 'Cleo', 'Dania', 'Esi', 'Fay'],
  },
  {
    label: 'MEASURED (lib/demo/measured-party.ts)',
    hexes: ['#be9e87', '#b9957b', '#b38b72', '#ad896d', '#a3836b', '#a68062', '#886246'],
    names: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
  },
];

if (require.main === module) {
  for (const p of PARTIES) {
    console.log(`\n=== ${p.label} ===`);
    console.log(
      'variant   winner         floor    mean   by-eye         differs  most hurt     lift',
    );
    for (const v of ['SHIPPED', 'A', 'B', 'C'] as Variant[]) {
      const r = scoreParty(v, p.hexes, p.names);
      console.log(
        v.padEnd(9),
        r.winner.padEnd(14),
        String(r.floor).padStart(6),
        String(r.mean).padStart(7),
        ' ' + r.byEye.padEnd(14),
        String(r.differs).padEnd(8),
        r.mostHurt.padEnd(13),
        String(r.lift).padStart(6),
      );
    }
  }
  console.log('\nSHIPPED rows re-derive the numbers published in README.md and DEMO.md.');
  console.log('See docs/scoring-defect.md for the algebra and why no fix ships yet.\n');
}
