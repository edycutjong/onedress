import type { Colorway } from '../colorway/data';
import type { EarringChoice } from '../earring/selector';
import type { UserFacingError } from '../youcam/errors';
import type { FaceQuality } from '../youcam/features';

/**
 * The party run's state machine — everything the UI renders comes from this object.
 *
 * Two rules shape it (architecture.md §Failure contract, design.md §States):
 *   1. Per-bridesmaid isolation. One failed render must not void the verdict for the
 *      other five; each bridesmaid carries her own stage statuses and her own error.
 *   2. Fully JSON-serializable. The same object is the SSE event payload, the poll
 *      snapshot, and (once frozen to disk) the cached demo party.
 */

export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface Stage<T = undefined> {
  status: StageStatus;
  error?: UserFacingError;
  startedAt?: number;
  endedAt?: number;
  result?: T;
}

export interface BridesmaidInput {
  id: string;
  name?: string;
  /** file_id of the face selfie — drives all three analyzers */
  faceFileId: string;
  /** file_id of the full-length standing photo — drives cloth-v3 */
  bodyFileId: string;
}

export interface Measurement {
  /** measured hex from skin-tone-analysis — REQUIRED; without it she cannot be scored */
  skinHex: string;
  /** Fitzpatrick I–VI — optional: a missing badge degrades the card, not the run */
  fitzpatrick?: string;
  /** faceShape — optional: the earring selector falls back to a hoop */
  faceShape?: string;
  faceQuality?: FaceQuality;
}

export interface RenderResult {
  /** presigned URL — expires ~2h after the task completes */
  url: string;
  colorwayId: string;
}

export interface EarringResult {
  url: string;
  choice: EarringChoice;
}

export interface BridesmaidState {
  id: string;
  name?: string;
  measure: Stage<Measurement>;
  render: Stage<RenderResult>;
  earring: Stage<EarringResult>;
  /** best available image for this bridesmaid: earring render → dress render → none */
  finalUrl?: string;
}

export interface ScoredPerson {
  id: string;
  name?: string;
  flatter: number;
  terms: { U: number; C: number; S: number; flatter: number };
}

export interface ColorwaySummary {
  colorway: Colorway;
  groupScore: number;
  mean: number;
  variance: number;
  worst: { id: string; name?: string; flatter: number };
  perPerson: ScoredPerson[];
}

export interface ScoringSummary {
  /** all 24, best-first by max-of-minimum — the score board renders this whole array */
  ranked: ColorwaySummary[];
  winner: ColorwaySummary;
  byEye: ColorwaySummary;
  mostHurt: { id: string; name?: string; flatter: number };
  /** does the fair pick differ from the by-eye pick? (no counterfactual if it doesn't) */
  differsFromByEye: boolean;
}

export interface Counterfactual {
  /** the bridesmaid the by-eye pick hurts most */
  bridesmaidId: string;
  bridesmaidName?: string;
  byEyeColorway: Colorway;
  winnerColorway: Colorway;
  byEyeScore: number;
  winnerScore: number;
  /** her rendered in the by-eye color — the left half of gallery image #1 */
  render: Stage<RenderResult>;
}

export type RunStage = 'measure' | 'score' | 'render' | 'earring' | 'done';
export type RunStatus = 'running' | 'done' | 'failed';

export interface UnitLedger {
  before?: number;
  after?: number;
  spent?: number;
  /** pre-flight estimate from FEATURE_COST, shown before the user commits */
  estimated: number;
}

export interface RunEvent {
  at: number;
  /** dot-path into the run, e.g. "bridesmaid.b3.render" — the UI keys animations off this */
  path: string;
  status: StageStatus;
  message?: string;
}

export interface PartyRun {
  id: string;
  name?: string;
  createdAt: number;
  status: RunStatus;
  stage: RunStage;
  bridesmaids: BridesmaidState[];
  scoring?: ScoringSummary;
  counterfactual?: Counterfactual;
  units: UnitLedger;
  events: RunEvent[];
  /** set only when the whole run failed (e.g. nobody could be measured) */
  error?: UserFacingError;
  /** true for the pre-baked demo party — served with zero API calls */
  cached?: boolean;
}

export const pendingStage = <T>(): Stage<T> => ({ status: 'pending' });

export function newBridesmaidState(input: BridesmaidInput): BridesmaidState {
  return {
    id: input.id,
    name: input.name,
    measure: pendingStage<Measurement>(),
    render: pendingStage<RenderResult>(),
    earring: pendingStage<EarringResult>(),
  };
}

/** Bridesmaids whose measurement produced a skin hex — the only ones that can be scored. */
export function measuredProfiles(run: PartyRun) {
  return run.bridesmaids
    .filter((b) => b.measure.status === 'done' && b.measure.result)
    .map((b) => ({
      id: b.id,
      name: b.name,
      skinHex: b.measure.result!.skinHex,
      fitzpatrick: b.measure.result!.fitzpatrick,
    }));
}
