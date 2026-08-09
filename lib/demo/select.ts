import { hexToLab, ita } from '@/lib/color/lab';
import { legibleAccent } from '@/lib/demo/format';
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

export interface ItaSpan {
  /** the lightest measured member, in ITA° */
  max: number;
  /** the deepest measured member, in ITA° */
  min: number;
  /** max − min: how far this party actually spreads */
  span: number;
}

/**
 * How wide this party is, in ITA° — computed here from the measured hexes with the
 * same `lib/color` primitives the engine uses, never read off a stored field.
 *
 * This is the number that decides whether the two objectives can disagree at all. A
 * party clustered inside a narrow band has no colorway that can single one member
 * out, so maximin and mean land on the same colour; a party that spreads has one.
 * Compare shows it because "they agree" is only a finding if you can see why.
 */
export function itaSpan(run: PartyRun): ItaSpan | null {
  const values = run.bridesmaids
    .map((b) => b.measure.result?.skinHex)
    .filter((h): h is string => Boolean(h))
    .map((h) => ita(hexToLab(h)));
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return { max, min, span: max - min };
}

/**
 * The colorway the whole app is currently accented with, lifted to a legible value.
 *
 * Several of the 24 colorways are darker than the page background — Wine, the
 * measured party's winner, is one — so the raw hex would render the eyebrows and
 * borders invisible. `legibleAccent` only touches the chrome; every swatch, bar and
 * printed hex in the app still uses `colorway.hex` directly and is never adjusted.
 */
export function accentHex(run: PartyRun): string {
  return legibleAccent(run.scoring?.winner.colorway.hex ?? '#D98BA3');
}

/**
 * The lineup grid, sized to the party.
 *
 * Six was hard-coded when six was the only party that existed; a seventh member then
 * wrapped onto a row of her own, which on the verdict screen is the opposite of the
 * point — the lineup is meant to read as one photograph of one group. The classes are
 * written out in full because Tailwind scans source text and never sees an
 * interpolated class name.
 */
export function lineupGridClass(size: number): string {
  const wide =
    size >= 7
      ? 'lg:grid-cols-7'
      : size === 5
        ? 'lg:grid-cols-5'
        : size <= 4
          ? 'lg:grid-cols-4'
          : 'lg:grid-cols-6';
  return `grid grid-cols-2 gap-4 sm:grid-cols-3 ${wide}`;
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
