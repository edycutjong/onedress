import type { Colorway } from '@/lib/colorway/data';
import type { BridesmaidState, ColorwaySummary, PartyRun } from '@/lib/pipeline/types';
import type { StepStatus } from '@/components/shell/ProgressSpine';

/**
 * Read-only views over a `PartyRun`. Everything the screens render comes through
 * here, so a screen never reaches into the run's shape twice and a live run and the
 * cached demo party are indistinguishable to the UI.
 */

export function displayName(b: BridesmaidState, index: number): string {
  return b.name ?? `Bridesmaid ${index + 1}`;
}

/** Her flatter score under one colorway, or undefined if she was never measured. */
export function flatterOf(summary: ColorwaySummary | undefined, id: string): number | undefined {
  return summary?.perPerson.find((p) => p.id === id)?.flatter;
}

export interface CounterfactualView {
  subjectId: string;
  subjectName: string;
  subjectSkinHex: string;
  subjectFitzpatrick?: string;
  byEyeColorway: Colorway;
  byEyeScore: number;
  winnerColorway: Colorway;
  winnerScore: number;
}

/**
 * The counterfactual, resolved against the people in the run. Null when the fair
 * pick and the by-eye pick agree — there is genuinely nothing to compare then, and
 * inventing a comparison would be the dishonest option.
 */
export function counterfactualView(run: PartyRun): CounterfactualView | null {
  const cf = run.counterfactual;
  if (!cf) return null;
  const index = run.bridesmaids.findIndex((b) => b.id === cf.bridesmaidId);
  const subject = run.bridesmaids[index];
  const measurement = subject?.measure.result;
  if (!subject || !measurement) return null;
  return {
    subjectId: subject.id,
    subjectName: cf.bridesmaidName ?? displayName(subject, index),
    subjectSkinHex: measurement.skinHex,
    subjectFitzpatrick: measurement.fitzpatrick,
    byEyeColorway: cf.byEyeColorway,
    byEyeScore: cf.byEyeScore,
    winnerColorway: cf.winnerColorway,
    winnerScore: cf.winnerScore,
  };
}

/** The colorway the whole app is currently accented with. */
export function accentHex(run: PartyRun): string {
  return run.scoring?.winner.colorway.hex ?? '#D98BA3';
}

const STAGE_DONE = (bs: BridesmaidState[], key: 'measure' | 'render' | 'earring'): boolean =>
  bs.length > 0 && bs.some((b) => b[key].status === 'done');

const STAGE_SKIPPED = (bs: BridesmaidState[], key: 'render' | 'earring'): boolean =>
  bs.length > 0 && bs.every((b) => b[key].status === 'skipped');

/**
 * Spine status per step, derived from the run — never hard-coded. A step the run
 * did not run is drawn as `skipped`, not quietly as done.
 */
export function stepStatuses(run: PartyRun): Record<string, StepStatus> {
  const bs = run.bridesmaids;
  const measured = STAGE_DONE(bs, 'measure');
  const scored = Boolean(run.scoring);
  const rendered = STAGE_DONE(bs, 'render');
  const renderSkipped = STAGE_SKIPPED(bs, 'render');
  const earringSkipped = STAGE_SKIPPED(bs, 'earring');

  return {
    create: bs.length > 0 ? 'done' : 'todo',
    measure: measured ? 'done' : 'todo',
    score: scored ? 'done' : 'todo',
    compare: run.counterfactual ? 'done' : scored ? 'skipped' : 'todo',
    render: rendered ? 'done' : renderSkipped ? 'skipped' : 'todo',
    finish: earringSkipped ? 'skipped' : STAGE_DONE(bs, 'earring') ? 'done' : 'todo',
    verdict: scored ? 'done' : 'todo',
  };
}
