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

const INK_DARK = '#140a11';
const INK_LIGHT = '#faf5f7';

/** WCAG relative luminance. Not colour science — a legibility switch. */
function luminance(hexColor: string): number {
  const h = hexColor.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Readable ink for a swatch, so a Fitzpatrick badge can be filled with the measured
 * skin hex and still pass AA. Picks whichever of the two brand inks actually has
 * more contrast against the fill — a luma threshold gets mid-depth tones wrong
 * (#A9714B lands at 3.77:1 with light ink and 4.7:1 with dark).
 */
export function inkOn(background: string): string {
  return contrast(background, INK_DARK) >= contrast(background, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}
