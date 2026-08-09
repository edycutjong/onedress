import type { PartyRun } from '@/lib/pipeline/types';
import { DEMO_PARTY, DEMO_RENDER_NOTE } from '@/lib/demo/demo-party';
import { MEASURED_PARTY, MEASURED_RENDER_NOTE } from '@/lib/demo/measured-party';

/**
 * The two cached datasets the app ships with, and the copy that belongs to each.
 *
 * They are not two versions of the same thing — they are two different true claims,
 * and the app is more honest for carrying both:
 *
 *   demo      six SYNTHETIC Fitzpatrick I–VI reference profiles, no photographs.
 *             Wide enough that the two objectives diverge: maximin picks Marigold,
 *             best-on-average picks Rust, and the Fitzpatrick V member gains +26.5.
 *             This is the counterfactual the product is an argument about, which is
 *             why it is the default.
 *
 *   measured  seven REAL people, measured live through the YouCam API and rendered.
 *             Narrow enough that the two objectives AGREE. No counterfactual, no
 *             manufactured delta — the mechanism reporting that this party does not
 *             need it.
 *
 * Nothing here is a score. Every number both datasets show is computed by the shipped
 * engine at module load (see the two source files); this module only decides which
 * one is on screen and what to call it.
 */

export type PartyDatasetId = 'demo' | 'measured';

export interface PartyDataset {
  id: PartyDatasetId;
  /** the switch control's label — must be unambiguous on its own */
  label: string;
  /** one line under the label, describing what the images actually are */
  sublabel: string;
  /** what to call one member of this party in shared UI copy */
  noun: string;
  nounPlural: string;
  /** the cached run itself */
  party: PartyRun;
  /** what the imagery is, verbatim, in the shell banner */
  imageryNote: string;
  /** why the render cascade looks the way it does */
  renderNote: string;
  /** the other dataset — Compare uses it to say where the divergence does appear */
  otherId: PartyDatasetId;
}

export const PARTY_DATASETS: readonly PartyDataset[] = [
  {
    id: 'demo',
    label: 'Demo party (synthetic I–VI)',
    sublabel: 'Six reference profiles · illustrations, no photographs',
    noun: 'bridesmaid',
    nounPlural: 'bridesmaids',
    party: DEMO_PARTY,
    imageryNote:
      'Six synthetic Fitzpatrick I–VI profiles. Every hex, every score and all 24 rankings are ' +
      'computed by the shipped engine — no API call, no units. There are no photographs of these ' +
      'six because they are not people: every image slot is drawn as a labelled illustration of ' +
      'the measured numbers rather than a fabricated portrait.',
    renderNote: DEMO_RENDER_NOTE,
    otherId: 'measured',
  },
  {
    id: 'measured',
    label: 'Measured party (real photos)',
    sublabel: 'Seven people measured live · licensed stock, real renders',
    noun: 'person',
    nounPlural: 'people',
    party: MEASURED_PARTY,
    imageryNote:
      'Seven real people, measured live through the YouCam API and rendered in the winning ' +
      'colorway. The portraits are licensed stock photographs (Pexels / Unsplash), measured live ' +
      '— they are not bridesmaids, clients or customers, and nothing here implies they endorse ' +
      'anything. The garment reads as a top rather than a gown because every source frame is ' +
      'chest-up. Scores are computed by the same engine from the same measured hexes.',
    renderNote: MEASURED_RENDER_NOTE,
    otherId: 'demo',
  },
];

export const DEFAULT_PARTY_ID: PartyDatasetId = 'demo';

export function partyDataset(id: PartyDatasetId): PartyDataset {
  return PARTY_DATASETS.find((d) => d.id === id) ?? PARTY_DATASETS[0];
}

/**
 * The dataset a run belongs to, or null for a live run. Screens receive only a
 * `PartyRun`, so this is how shared copy ("bridesmaid" vs "person") stays correct
 * without threading a prop through every component.
 */
export function datasetOf(run: PartyRun): PartyDataset | null {
  if (!run.cached) return null;
  return PARTY_DATASETS.find((d) => d.party.id === run.id) ?? null;
}

/** Nouns for shared copy. A live run is a real wedding party, so it keeps the default. */
export function nounsOf(run: PartyRun): { noun: string; nounPlural: string } {
  const dataset = datasetOf(run);
  return dataset
    ? { noun: dataset.noun, nounPlural: dataset.nounPlural }
    : { noun: 'bridesmaid', nounPlural: 'bridesmaids' };
}

/** The render-screen note for this run — live runs fill in place, so they say so. */
export function renderNoteOf(run: PartyRun): string {
  return datasetOf(run)?.renderNote ?? 'Cards fill as each task lands — no reordering.';
}
