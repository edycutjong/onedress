/**
 * The 7-step progress spine (design.md §Persistent shell). It is on 100% of screens
 * and it is how a judge always knows where in the story they are.
 *
 * `Finish` has no screen of its own — it is the share/export beat, which lives inside
 * the verdict composition. It stays in the spine because the spine is the narrative,
 * and collapsing it would leave the story a step short of where it actually ends.
 */

export const SCREENS = ['create', 'measure', 'score', 'compare', 'render', 'verdict'] as const;
export type ScreenId = (typeof SCREENS)[number];

export interface Step {
  id: string;
  label: string;
  /** one-line gloss, used as the spine tooltip and the screen eyebrow */
  gloss: string;
  screen: ScreenId;
}

export const STEPS: readonly Step[] = [
  { id: 'create', label: 'Create', gloss: 'Six bridesmaids, two photos each', screen: 'create' },
  { id: 'measure', label: 'Measure', gloss: 'Real skin hex + Fitzpatrick I–VI', screen: 'measure' },
  { id: 'score', label: 'Score', gloss: 'All 24 colorways, max-of-minimum', screen: 'score' },
  { id: 'compare', label: 'Compare', gloss: 'What the by-eye pick costs', screen: 'compare' },
  { id: 'render', label: 'Render', gloss: 'The winning color on everyone', screen: 'render' },
  { id: 'finish', label: 'Finish', gloss: 'Earrings, alignment, export', screen: 'verdict' },
  { id: 'verdict', label: 'Verdict', gloss: 'One color. Every complexion.', screen: 'verdict' },
];

export type StepId = (typeof STEPS)[number]['id'];

export function stepById(id: string): Step {
  return STEPS.find((s) => s.id === id) ?? STEPS[STEPS.length - 1];
}
