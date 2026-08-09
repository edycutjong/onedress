/**
 * The 24 OneDress colorways (specs/spec.md §The 24 colorways). Deliberate coverage
 * of the undertone wheel × depth × saturation, sampled from best-selling bridesmaid
 * color families. Names are ORIGINAL/descriptive — no trademarked color names, no
 * retailer marks. Grouped warm (8) · cool (10) · neutral (6). `dusty-sage` (#9CAF88)
 * is the brand accent — the recurring "winning colorway".
 *
 * The `family` label is for UI grouping only; the scoring engine derives undertone
 * and depth from each hex directly (lib/colorway/engine.ts), never from the label.
 */
export type Family = 'warm' | 'cool' | 'neutral';

export interface Colorway {
  id: string;
  name: string;
  family: Family;
  hex: string;
}

export const COLORWAYS: readonly Colorway[] = [
  // — warm (8) —
  { id: 'terracotta', name: 'Terracotta', family: 'warm', hex: '#C86B4E' },
  { id: 'rust', name: 'Rust', family: 'warm', hex: '#B7410E' },
  { id: 'marigold', name: 'Marigold', family: 'warm', hex: '#EAA221' },
  { id: 'warm-champagne', name: 'Warm Champagne', family: 'warm', hex: '#E4C591' },
  { id: 'caramel', name: 'Caramel', family: 'warm', hex: '#AF6E4D' },
  { id: 'warm-burgundy', name: 'Warm Burgundy', family: 'warm', hex: '#7B2D3A' },
  { id: 'tomato-red', name: 'Tomato Red', family: 'warm', hex: '#E64A32' },
  { id: 'amber', name: 'Amber', family: 'warm', hex: '#D89A3A' },

  // — cool (10) —
  { id: 'dusty-blue', name: 'Dusty Blue', family: 'cool', hex: '#7C97B0' },
  { id: 'slate', name: 'Slate', family: 'cool', hex: '#55677A' },
  { id: 'navy', name: 'Navy', family: 'cool', hex: '#26364F' },
  { id: 'emerald', name: 'Emerald', family: 'cool', hex: '#1F7A5A' },
  { id: 'eucalyptus', name: 'Eucalyptus', family: 'cool', hex: '#7D9B86' },
  { id: 'plum', name: 'Plum', family: 'cool', hex: '#6E4A6E' },
  { id: 'wine', name: 'Wine', family: 'cool', hex: '#5E2233' },
  { id: 'cool-berry', name: 'Cool Berry', family: 'cool', hex: '#8E3B5A' },
  { id: 'lavender', name: 'Lavender', family: 'cool', hex: '#B7A9D0' },
  { id: 'amethyst', name: 'Amethyst', family: 'cool', hex: '#7B5EA7' },

  // — neutral (6) —
  { id: 'dusty-rose', name: 'Dusty Rose', family: 'neutral', hex: '#C6929E' },
  { id: 'mauve', name: 'Mauve', family: 'neutral', hex: '#9E7E90' },
  { id: 'taupe', name: 'Taupe', family: 'neutral', hex: '#8A7B6E' },
  { id: 'stormy-grey', name: 'Stormy Grey', family: 'neutral', hex: '#7C8288' },
  { id: 'blush-neutral', name: 'Blush Neutral', family: 'neutral', hex: '#E5C1BC' },
  { id: 'dusty-sage', name: 'Dusty Sage', family: 'neutral', hex: '#9CAF88' },
];

/*! istanbul ignore next -- load-time assertion over the literal array directly above it:
   it takes no input, so no test can make it fire. It exists to break the build loudly
   if someone edits the list and the "24 colorways" claim in the pitch goes stale. */
if (COLORWAYS.length !== 24) {
  throw new Error(`expected 24 colorways, got ${COLORWAYS.length}`);
}
