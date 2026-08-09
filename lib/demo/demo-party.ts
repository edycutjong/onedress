import { COLORWAYS } from '@/lib/colorway/data';
import { scoreParty, type SkinProfile } from '@/lib/colorway/engine';
import type {
  BridesmaidState,
  Counterfactual,
  PartyRun,
  ScoringSummary,
  Stage,
} from '@/lib/pipeline/types';

/**
 * The cached demo party — what the app opens on, with **no API key and zero units**.
 *
 * Two rules govern this file:
 *
 *  1. **Nothing here is invented.** The six skin hexes are synthetic Fitzpatrick I–VI
 *     reference profiles, and every score on every screen is produced by calling the
 *     real engine (`scoreParty`) on them at module load. Pure math, no network, no
 *     cost, deterministic — so the numbers a judge reads are the numbers the shipped
 *     engine computes, and they can never drift from it. For the record, it returns:
 *
 *       winner  marigold #EAA221 — floor 57.81, mean 65.17
 *                 I 70.18 · II 63.80 · III 64.00 · IV 57.81 · V 65.26 · VI 69.95
 *       by-eye  rust     #B7410E — floor 38.75, mean 66.14  (the mean-maximising pick)
 *                 I 90.13 · II 92.58 · III 76.28 · IV 47.33 · V 38.75 · VI 51.75
 *       most hurt by the by-eye pick: the Fitzpatrick V bridesmaid,
 *                 38.75 → 65.26 under the winner, a +26.51 lift.
 *
 *  2. **No fabricated photographs.** Real bridesmaid photos do not exist yet, so
 *     `photoUrl` / `renderUrl` are `null` everywhere and the UI draws a visibly
 *     illustrative portrait from the measured skin hex instead. The render and
 *     earring stages are therefore `skipped`, not `done` — the app must never imply
 *     a render happened that didn't. Dropping real URLs in below is a one-line
 *     change per bridesmaid and nothing else moves.
 */

/** A bridesmaid as the demo knows her: measurement + wherever her images will live. */
export interface DemoBridesmaid {
  id: string;
  name: string;
  /** Fitzpatrick I–VI, as returned by fitzpatrick-scale-analyzer */
  fitzpatrick: string;
  /** measured hex from skin-tone-analysis */
  skinHex: string;
  /** faceShape from face-attr-analysis — optional, degrades the earring silhouette only */
  faceShape?: string;
  /** her face selfie once one exists; null → the UI draws an illustrated placeholder */
  photoUrl: string | null;
  /** her cloth-v3 render once one exists; null → the render card stays a skeleton */
  renderUrl: string | null;
}

export const DEMO_BRIDESMAIDS: readonly DemoBridesmaid[] = [
  {
    id: 'b1',
    name: 'Ada',
    fitzpatrick: 'I',
    skinHex: '#F3DCC9',
    faceShape: 'Oval',
    photoUrl: null,
    renderUrl: null,
  },
  {
    id: 'b2',
    name: 'Bea',
    fitzpatrick: 'II',
    skinHex: '#E7C9A9',
    faceShape: 'Heart',
    photoUrl: null,
    renderUrl: null,
  },
  {
    id: 'b3',
    name: 'Cleo',
    fitzpatrick: 'III',
    skinHex: '#D0A375',
    // faceShape deliberately absent: face-attr-analysis is the one analyzer whose
    // failure costs nothing but a fallback silhouette. The UI says so on her card.
    photoUrl: null,
    renderUrl: null,
  },
  {
    id: 'b4',
    name: 'Dania',
    fitzpatrick: 'IV',
    skinHex: '#A9714B',
    faceShape: 'Round',
    photoUrl: null,
    renderUrl: null,
  },
  {
    id: 'b5',
    name: 'Esi',
    fitzpatrick: 'V',
    skinHex: '#7A4A33',
    faceShape: 'Square',
    photoUrl: null,
    renderUrl: null,
  },
  {
    id: 'b6',
    name: 'Fay',
    fitzpatrick: 'VI',
    skinHex: '#4A2E20',
    faceShape: 'Oblong',
    photoUrl: null,
    renderUrl: null,
  },
];

export const DEMO_PROFILES: readonly SkinProfile[] = DEMO_BRIDESMAIDS.map((b) => ({
  id: b.id,
  name: b.name,
  skinHex: b.skinHex,
  fitzpatrick: b.fitzpatrick,
}));

/**
 * What one live run of this party would cost, from `FEATURE_COST` in
 * lib/youcam/features.ts: 6 × (20 skin-tone + 10 fitzpatrick + 10 face-attr)
 * + 7 × 2 cloth-v3 (six bridesmaids + the counterfactual) + 6 × 1 earring.
 * Duplicated as a constant rather than imported because `features.ts` reaches
 * `lib/youcam/client.ts` → `node:fs`, which cannot enter the browser bundle.
 */
export const DEMO_ESTIMATED_UNITS = 260;

/** Why the render + earring stages are `skipped` — rendered verbatim in the UI. */
export const DEMO_RENDER_NOTE =
  'Renders are not part of the cached party: cloth-v3 spends live units and there are no ' +
  'bridesmaid photographs to render yet. Every card below is a real skeleton in its final ' +
  'position — a live run fills them in place, with no reflow.';

const skipped = <T>(): Stage<T> => ({ status: 'skipped' });

function buildScoring(): ScoringSummary {
  const scored = scoreParty(DEMO_PROFILES as SkinProfile[], COLORWAYS);
  return {
    ranked: scored.ranked,
    winner: scored.winner,
    byEye: scored.byEye,
    mostHurt: scored.mostHurt,
    differsFromByEye: scored.differsFromByEye,
  };
}

function buildBridesmaids(): BridesmaidState[] {
  return DEMO_BRIDESMAIDS.map((b) => ({
    id: b.id,
    name: b.name,
    measure: {
      // no startedAt/endedAt: these measurements were never timed, and inventing a
      // duration to decorate the card would be a fabricated number like any other
      status: 'done',
      result: {
        skinHex: b.skinHex,
        fitzpatrick: b.fitzpatrick,
        faceShape: b.faceShape,
        faceQuality: { has_face: true, frontal: 'ok', lighting: 'ok', faceangle: 'ok' },
      },
    },
    render: skipped(),
    earring: skipped(),
  }));
}

function buildCounterfactual(scoring: ScoringSummary): Counterfactual | undefined {
  if (!scoring.differsFromByEye) return undefined;
  const subject = DEMO_BRIDESMAIDS.find((b) => b.id === scoring.mostHurt.id);
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

/** Build a fresh copy of the cached demo party. Deterministic apart from `createdAt`. */
export function buildDemoParty(): PartyRun {
  const scoring = buildScoring();
  const createdAt = Date.UTC(2026, 7, 4, 11, 0, 0);
  return {
    id: 'demo-party',
    name: 'Demo party',
    createdAt,
    status: 'done',
    stage: 'done',
    bridesmaids: buildBridesmaids(),
    scoring,
    counterfactual: buildCounterfactual(scoring),
    units: { estimated: DEMO_ESTIMATED_UNITS, spent: 0 },
    events: [],
    cached: true,
  };
}

/** The party the app opens on. */
export const DEMO_PARTY: PartyRun = buildDemoParty();

/** id → the images/skin data the run object does not carry. */
export const DEMO_BY_ID: Readonly<Record<string, DemoBridesmaid>> = Object.fromEntries(
  DEMO_BRIDESMAIDS.map((b) => [b.id, b]),
);
