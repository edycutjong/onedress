/** Display helpers. Every number a judge reads is formatted through here. */

/** Scores, means and lifts print to one decimal: 57.81 → "57.8". */
export function score(n: number): string {
  return n.toFixed(1);
}

/** Signed lift: 26.51 → "+26.5". */
export function signed(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * Small counts read as words in prose, so a party of six and a party of seven both
 * get a sentence rather than a digit dropped into one. Anything past ten prints as a
 * numeral, which is where a wedding party has bigger problems than typography.
 */
export function count(n: number): string {
  return WORDS[n] ?? String(n);
}

/** Sentence-leading form of `count`: 6 → "Six". */
export function countCap(n: number): string {
  const word = count(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** ITA° prints to one decimal with the degree sign: 46.63 → "46.6°". */
export function degrees(n: number): string {
  return `${n.toFixed(1)}°`;
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

/** The app's page background (`--bg-base`, tokens.css). Dark-only; light mode is off. */
const PAGE_BG = '#140a11';

function mixWithWhite(hexColor: string, amount: number): string {
  const h = hexColor.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amount);
  };
  return `#${[0, 2, 4].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A version of a colorway hex that is legible **as chrome** on the page background.
 *
 * The app accents itself with whatever colour won, which is the product's thesis
 * expressed as UI — but the 24 colorways include several (Wine `#5E2233`, Navy
 * `#26364F`) that are darker than the page itself, and an eyebrow drawn in those is
 * simply unreadable. So the swatches, the score bars and every printed hex keep the
 * exact measured colour, and only the text/border accent is lifted toward white
 * until it clears 4.5:1. Bright winners such as Marigold pass on the first check and
 * come back untouched.
 */
export function legibleAccent(color: string): string {
  for (let amount = 0; amount <= 0.9; amount += 0.05) {
    const candidate = mixWithWhite(color, amount);
    if (contrast(candidate, PAGE_BG) >= 4.5) return candidate;
  }
  return mixWithWhite(color, 0.9);
}
