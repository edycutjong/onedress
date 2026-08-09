import { COLORWAYS } from '@/lib/colorway/data';
import { scoreParty, type SkinProfile } from '@/lib/colorway/engine';
import type { UserFacingError } from '@/lib/youcam/errors';
import type {
  BridesmaidState,
  Counterfactual,
  PartyRun,
  ScoringSummary,
  Stage,
} from '@/lib/pipeline/types';

/**
 * The **measured** party — seven real people, measured live through the YouCam API
 * on 2026-08-09 and rendered in the winning colorway.
 *
 * Where `demo-party.ts` is six synthetic Fitzpatrick I–VI reference profiles with no
 * photographs, this file is the opposite: every hex below came back from
 * `skin-tone-analysis`, every roman numeral from `fitzpatrick-scale-analyzer`, and
 * every `renderUrl` points at a `cloth-v3` output committed to `public/party/`. The
 * two datasets exist side by side because they say different true things.
 *
 * The rules from `demo-party.ts` still hold, and one of them bites hard here:
 *
 *  1. **Nothing is invented, and no score is hard-coded.** `scoreParty()` runs on
 *     these hexes at module load exactly as it does for the synthetic party. It
 *     returns:
 *
 *       winner  wine #5E2233 — floor 56.94, mean 72.88
 *       by-eye  wine #5E2233 — floor 56.94, mean 72.88
 *       differs: FALSE. There is no counterfactual on this party, and the UI says so.
 *
 *     That is not a failure of the thesis, it is the thesis being precise. These
 *     seven tones span ITA 46.6° down to −13.3°; that is not wide enough for any of
 *     the 24 colorways to serve one person materially worse than the rest, so the
 *     colour that lifts the mean is already the colour that protects the floor. The
 *     divergence in the synthetic party (a +26.5 lift) comes from a span roughly
 *     twice as wide. A tool that reports "your party is close enough that this does
 *     not matter" is worth more than one that manufactures a delta every time.
 *
 *  2. **No fabricated photographs — and no fabricated successes.** `p5` is in the
 *     party because she was measured; her render is `failed`, not hidden, because
 *     `cloth-v3` really did reject her frame with `error_pose` (arms crossed). Six
 *     of seven rendered. Dropping her would have made the screen tidier and the
 *     record false.
 *
 * These are licensed stock photographs (Pexels / Unsplash), measured live. They are
 * not bridesmaids, not clients, and not customers — see `docs/asset-licences.md` for
 * the per-file provenance. The garment reads as a top rather than a gown because the
 * source frames are chest-up; the same call on a full-length source produces a dress.
 */

/** Verbatim from `MESSAGES.error_pose` in lib/youcam/errors.ts — this is what the
 *  API actually returned for `p5`, mapped through the shipped taxonomy. It is
 *  duplicated rather than imported because `errors.ts` pulls `YouCamError` from
 *  `lib/youcam/client.ts`, which reaches `node:fs` and cannot enter the browser
 *  bundle. Type-checked against `UserFacingError`, so the shape cannot drift. */
const ERROR_POSE: UserFacingError = {
  code: 'error_pose',
  title: 'Stand up straight',
  guidance: 'Standing, front-facing, arms clear of the body — no sitting or crouching.',
  recovery: 'reshoot',
};

/** One measured person: what the analyzers returned, and where the images live. */
export interface MeasuredPerson {
  id: string;
  /** deliberately anonymous — we do not know who these people are */
  name: string;
  /** Fitzpatrick I–VI, as returned by fitzpatrick-scale-analyzer */
  fitzpatrick: string;
  /** measured hex from skin-tone-analysis — the only load-bearing value */
  skinHex: string;
  /** ITA° as reported alongside the measurement; shown, never used to score */
  ita: number;
  /** the licensed stock frame the analyzers ran on, once resized into public/ */
  photoUrl: string | null;
  /** her cloth-v3 render in the winning colorway */
  renderUrl: string | null;
  /** why the render is missing — set only when cloth-v3 actually rejected the frame */
  renderError?: UserFacingError;
}

/**
 * Ordered by measured depth, lightest first — the same order as the source record in
 * `assets/party/real-scoring.json`, so the two can be diffed line for line.
 */
export const MEASURED_PEOPLE: readonly MeasuredPerson[] = [
  {
    id: 'p1',
    name: 'Person 1',
    fitzpatrick: 'I',
    skinHex: '#be9e87',
    ita: 46.6,
    photoUrl: '/party/faces/p1.jpg',
    renderUrl: '/party/wine/p1.jpg',
  },
  {
    id: 'p2',
    name: 'Person 2',
    fitzpatrick: 'II',
    skinHex: '#b9957b',
    ita: 37.3,
    photoUrl: '/party/faces/p2.jpg',
    renderUrl: '/party/wine/p2.jpg',
  },
  {
    id: 'p3',
    name: 'Person 3',
    fitzpatrick: 'III',
    skinHex: '#b38b72',
    ita: 29.8,
    photoUrl: '/party/faces/p3.jpg',
    renderUrl: '/party/wine/p3.jpg',
  },
  {
    id: 'p4',
    name: 'Person 4',
    fitzpatrick: 'III',
    skinHex: '#ad896d',
    ita: 25.8,
    photoUrl: '/party/faces/p4.jpg',
    renderUrl: '/party/wine/p4.jpg',
  },
  {
    // Measured fine; cloth-v3 rejected the frame with error_pose (arms crossed), so
    // there is no render and no committed source frame. She stays in the party and
    // in every score — the render card carries the real error instead of a picture.
    id: 'p5',
    name: 'Person 5',
    fitzpatrick: 'II',
    skinHex: '#a3836b',
    ita: 22.1,
    photoUrl: null,
    renderUrl: null,
    renderError: ERROR_POSE,
  },
  {
    id: 'p6',
    name: 'Person 6',
    fitzpatrick: 'IV',
    skinHex: '#a68062',
    ita: 16.6,
    photoUrl: '/party/faces/p6.jpg',
    renderUrl: '/party/wine/p6.jpg',
  },
  {
    id: 'p7',
    name: 'Person 7',
    fitzpatrick: 'V',
    skinHex: '#886246',
    ita: -13.3,
    photoUrl: '/party/faces/p7.jpg',
    renderUrl: '/party/wine/p7.jpg',
  },
];

export const MEASURED_PROFILES: readonly SkinProfile[] = MEASURED_PEOPLE.map((p) => ({
  id: p.id,
  name: p.name,
  skinHex: p.skinHex,
  fitzpatrick: p.fitzpatrick,
}));

/**
 * What this party actually cost, from the run log in `assets/party/FINDINGS.md`:
 * 7 × (20 skin-tone + 10 fitzpatrick) = 210, plus 7 × 2 cloth-v3 attempted = 14.
 * Only six renders completed and failed calls are not charged, so 222 of the 224
 * estimated units were spent. face-attr-analysis was not run on this party — which
 * is why every card here shows the hoop fallback rather than a face shape.
 */
export const MEASURED_ESTIMATED_UNITS = 224;
export const MEASURED_SPENT_UNITS = 222;

/** Why one frame in the cascade has no picture — rendered verbatim in the UI. */
export const MEASURED_RENDER_NOTE =
  'Six of the seven rendered. Person 5 is not missing — cloth-v3 rejected her frame with ' +
  'error_pose (arms crossed), so her card carries the API’s own re-shoot guidance instead of ' +
  'a picture. The garment reads as a top rather than a gown because every source frame is ' +
  'chest-up; the same call on a full-length photo returns a full dress.';

const skipped = <T>(): Stage<T> => ({ status: 'skipped' });

function buildScoring(): ScoringSummary {
  const scored = scoreParty(MEASURED_PROFILES as SkinProfile[], COLORWAYS);
  return {
    ranked: scored.ranked,
    winner: scored.winner,
    byEye: scored.byEye,
    mostHurt: scored.mostHurt,
    differsFromByEye: scored.differsFromByEye,
  };
}

function buildPeople(winnerColorwayId: string): BridesmaidState[] {
  return MEASURED_PEOPLE.map((p) => ({
    id: p.id,
    name: p.name,
    photoUrl: p.photoUrl ?? undefined,
    measure: {
      // no startedAt/endedAt: the durations were not recorded, and inventing one to
      // decorate the card would be a fabricated number like any other
      status: 'done',
      result: {
        skinHex: p.skinHex,
        fitzpatrick: p.fitzpatrick,
        // faceShape absent on purpose: face-attr-analysis was never called for this
        // party, so there is no value to show and the earring falls back to a hoop
      },
    },
    render: p.renderUrl
      ? { status: 'done', result: { url: p.renderUrl, colorwayId: winnerColorwayId } }
      : { status: 'failed', error: p.renderError },
    earring: skipped(),
    finalUrl: p.renderUrl ?? undefined,
  }));
}

/**
 * The same guard the synthetic party uses, deliberately not special-cased away: on
 * this party `differsFromByEye` is false, so it returns undefined and the Compare
 * screen reports the agreement rather than staging a comparison with itself.
 */
function buildCounterfactual(scoring: ScoringSummary): Counterfactual | undefined {
  if (!scoring.differsFromByEye) return undefined;
  const subject = MEASURED_PEOPLE.find((p) => p.id === scoring.mostHurt.id);
  if (!subject) return undefined;
  const winnerScore =
    scoring.winner.perPerson.find((p) => p.id === subject.id)?.flatter ?? scoring.winner.groupScore;
  return {
    bridesmaidId: subject.id,
    bridesmaidName: subject.name,
    byEyeColorway: scoring.byEye.colorway,
    winnerColorway: scoring.winner.colorway,
    byEyeScore: scoring.mostHurt.flatter,
    winnerScore,
    render: skipped(),
  };
}

/** Build a fresh copy of the measured party. Deterministic apart from `createdAt`. */
export function buildMeasuredParty(): PartyRun {
  const scoring = buildScoring();
  return {
    id: 'measured-party',
    name: 'Measured party',
    // the day the seven were measured and rendered
    createdAt: Date.UTC(2026, 7, 9, 11, 0, 0),
    status: 'done',
    stage: 'done',
    bridesmaids: buildPeople(scoring.winner.colorway.id),
    scoring,
    counterfactual: buildCounterfactual(scoring),
    units: { estimated: MEASURED_ESTIMATED_UNITS, spent: MEASURED_SPENT_UNITS },
    events: [],
    cached: true,
  };
}

export const MEASURED_PARTY: PartyRun = buildMeasuredParty();
