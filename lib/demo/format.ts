/** Display helpers. Every number a judge reads is formatted through here. */

/** Scores, means and lifts print to one decimal: 57.81 → "57.8". */
export function score(n: number): string {
  return n.toFixed(1);
}

/** Signed lift: 26.51 → "+26.5". */
export function signed(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`;
}

/** Hexes always print uppercase with the hash, exactly as measured. */
export function hex(value: string): string {
  return value.startsWith('#') ? value.toUpperCase() : `#${value.toUpperCase()}`;
}

/**
 * Readable ink for a swatch, so a colorway chip can carry its own hex label.
 * Rec. 601 luma is the right tool here — it is a legibility switch, not colour
 * science; the actual colour maths all lives in lib/color/lab.ts.
 */
export function inkOn(background: string): string {
  const h = background.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1b1016' : '#faf5f7';
}
