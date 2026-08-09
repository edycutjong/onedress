import { randomUUID } from 'node:crypto';
import { COLORWAYS, type Colorway } from '../colorway/data';
import { deriveSkin, scoreParty } from '../colorway/engine';
import { selectEarring } from '../earring/selector';
import { toUserFacingError } from '../youcam/errors';
import {
  estimateUnits,
  measureFaceShape,
  measureFitzpatrick,
  measureSkinTone,
  renderCloth,
  renderEarring,
  type TaskRunner,
} from '../youcam/features';
import type { RefResolver } from './asset-refs';
import { fetchRender, headCrop } from './head-crop';
import {
  measuredProfiles,
  newBridesmaidState,
  type BridesmaidInput,
  type BridesmaidState,
  type Counterfactual,
  type PartyRun,
  type RunEvent,
  type ScoringSummary,
  type Stage,
  type StageStatus,
} from './types';

/**
 * The hero flow, end to end (architecture.md §Data flow):
 *
 *   6×2 uploads → 18 analyzer tasks → scoring (free, local) → 6 renders
 *   (+1 counterfactual) → 6 earring chains → verdict
 *
 * Three properties this is built around:
 *
 *  1. **Per-bridesmaid isolation.** Every stage is caught per person. A failed
 *     render leaves that card in `failed` with re-shoot guidance while the other
 *     five still compose a valid verdict. The only fatal case is "nobody could be
 *     measured", because then there is nothing to score.
 *
 *  2. **Graceful degradation down the value chain.** skin hex is required;
 *     Fitzpatrick (badge) and faceShape (earring silhouette) are not — losing them
 *     costs a badge or falls back to a hoop, it never fails the run. Losing the
 *     earring step leaves the dress render as `finalUrl`, exactly as the build-plan
 *     kill-criterion prescribes.
 *
 *  3. **Injected side effects.** The API client, the reference-image resolver and
 *     the crop step all arrive as dependencies, so the whole orchestrator runs in
 *     unit tests against a fake client — zero network, zero units.
 */

export interface RunPartyDeps {
  api: TaskRunner;
  refs: RefResolver;
  /** render URL → head-crop bytes. Injectable so tests skip sharp and the network. */
  cropHead?: (renderUrl: string) => Promise<Buffer>;
  /** called once with the run object before any work starts, so a caller can register
   *  it for polling/SSE immediately rather than waiting for the first event */
  onCreate?: (run: PartyRun) => void;
  /** called on every stage transition — the SSE route forwards these to the browser */
  emit?: (run: PartyRun, event: RunEvent) => void;
  colorways?: readonly Colorway[];
  /** skip the earring pass (bench uses this to isolate cloth-v3 timings) */
  skipEarring?: boolean;
}

const defaultCropHead = async (url: string) => headCrop(await fetchRender(url));

export async function runParty(
  inputs: BridesmaidInput[],
  deps: RunPartyDeps,
  meta: { id?: string; name?: string } = {},
): Promise<PartyRun> {
  const colorways = deps.colorways ?? COLORWAYS;
  const cropHead = deps.cropHead ?? defaultCropHead;

  const run: PartyRun = {
    id: meta.id ?? randomUUID(),
    name: meta.name,
    createdAt: Date.now(),
    status: 'running',
    stage: 'measure',
    bridesmaids: inputs.map(newBridesmaidState),
    units: { estimated: estimateUnits(inputs.length, { counterfactual: true }) },
    events: [],
  };

  deps.onCreate?.(run);

  const emit = (path: string, status: StageStatus, message?: string) => {
    const event: RunEvent = { at: Date.now(), path, status, message };
    run.events.push(event);
    deps.emit?.(run, event);
  };

  /** Run one stage of one bridesmaid, recording timing + typed error on the stage. */
  async function stage<T>(
    slot: Stage<T>,
    path: string,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    slot.status = 'running';
    slot.startedAt = Date.now();
    emit(path, 'running');
    try {
      const result = await fn();
      slot.result = result;
      slot.status = 'done';
      slot.endedAt = Date.now();
      emit(path, 'done');
      return result;
    } catch (err) {
      slot.status = 'failed';
      slot.error = toUserFacingError(err);
      slot.endedAt = Date.now();
      emit(path, 'failed', slot.error.guidance);
      return undefined;
    }
  }

  // Balance before — best effort: an unreadable balance must not stop a run.
  try {
    run.units.before = await deps.api.getCredit();
  } catch {
    /* unit meter simply shows no delta */
  }

  // ------------------------------------------------------------- 1. measure --
  run.stage = 'measure';
  emit('run.measure', 'running');

  await Promise.all(
    run.bridesmaids.map(async (b, i) => {
      const input = inputs[i];
      await stage(b.measure, `bridesmaid.${b.id}.measure`, async () => {
        // The three analyzers are independent — fan them out, then decide which
        // failures actually matter.
        const [skin, fitz, shape] = await Promise.allSettled([
          measureSkinTone(deps.api, input.faceFileId),
          measureFitzpatrick(deps.api, input.faceFileId),
          measureFaceShape(deps.api, input.faceFileId),
        ]);

        // skin hex is load-bearing: without it she cannot be scored at all.
        if (skin.status === 'rejected') throw skin.reason;

        return {
          skinHex: skin.value.skinHex,
          faceQuality: skin.value.faceQuality,
          fitzpatrick: fitz.status === 'fulfilled' ? fitz.value : undefined,
          faceShape: shape.status === 'fulfilled' ? shape.value : undefined,
        };
      });
    }),
  );

  // --------------------------------------------------------------- 2. score --
  run.stage = 'score';
  emit('run.score', 'running');

  const profiles = measuredProfiles(run);
  if (profiles.length === 0) {
    run.status = 'failed';
    run.stage = 'done';
    run.error = {
      code: 'no_measurable_bridesmaids',
      title: 'Nothing to score',
      guidance: 'No bridesmaid could be measured — re-shoot the face photos and try again.',
      recovery: 'reshoot',
    };
    emit('run.score', 'failed', run.error.guidance);
    return finish(run, deps);
  }

  const scored = scoreParty(profiles, colorways);
  const scoring: ScoringSummary = {
    ranked: scored.ranked,
    winner: scored.winner,
    byEye: scored.byEye,
    mostHurt: scored.mostHurt,
    differsFromByEye: scored.differsFromByEye,
  };
  run.scoring = scoring;
  emit(
    'run.score',
    'done',
    `${scoring.winner.colorway.name} — nobody below ${scoring.winner.groupScore}`,
  );

  // -------------------------------------------------------------- 3. render --
  run.stage = 'render';
  emit('run.render', 'running');

  const winnerColorway = scoring.winner.colorway;
  const renderable = run.bridesmaids.filter((b) => b.measure.status === 'done');

  await Promise.all(
    renderable.map(async (b) => {
      const input = inputs.find((x) => x.id === b.id)!;
      await stage(b.render, `bridesmaid.${b.id}.render`, async () => {
        const dressFileId = await deps.refs.colorway(winnerColorway.id);
        const url = await renderCloth(deps.api, { bodyFileId: input.bodyFileId, dressFileId });
        return { url, colorwayId: winnerColorway.id };
      });
      b.finalUrl = b.render.result?.url;
    }),
  );

  // The counterfactual: the most-hurt bridesmaid rendered in the by-eye colour, so
  // the split view compares two REAL renders of the same person (design.md §5).
  if (scoring.differsFromByEye) {
    const subject = run.bridesmaids.find((b) => b.id === scoring.mostHurt.id);
    const subjectInput = inputs.find((x) => x.id === scoring.mostHurt.id);
    /*! istanbul ignore else -- unreachable: mostHurt.id comes from measuredProfiles(run),
       whose ids are bridesmaid ids, and run.bridesmaids is inputs.map(newBridesmaidState),
       which copies input.id 1:1. Both lookups therefore always hit. */
    if (subject && subjectInput) {
      const cf: Counterfactual = {
        bridesmaidId: subject.id,
        bridesmaidName: subject.name,
        byEyeColorway: scoring.byEye.colorway,
        winnerColorway,
        byEyeScore: scoring.mostHurt.flatter,
        winnerScore:
          scoring.winner.perPerson.find((p) => p.id === subject.id)?.flatter ??
          /*! istanbul ignore next -- unreachable for the same reason: the subject is one of
             the scored profiles, so she is always present in winner.perPerson. This
             fallback exists only to satisfy the type. */
          scoring.winner.groupScore,
        render: { status: 'pending' },
      };
      run.counterfactual = cf;
      await stage(cf.render, 'counterfactual.render', async () => {
        const dressFileId = await deps.refs.colorway(scoring.byEye.colorway.id);
        const url = await renderCloth(deps.api, {
          bodyFileId: subjectInput.bodyFileId,
          dressFileId,
        });
        return { url, colorwayId: scoring.byEye.colorway.id };
      });
    }
  }

  // ------------------------------------------------------------- 4. earring --
  if (deps.skipEarring) {
    for (const b of run.bridesmaids) {
      /*! istanbul ignore else -- unreachable: in skip mode nothing has touched the earring
         stage yet, so every status is still 'pending'. The guard is here so the loop stays
         correct if a future stage ever writes to b.earring before this point. */
      if (b.earring.status === 'pending') b.earring.status = 'skipped';
    }
  } else {
    run.stage = 'earring';
    emit('run.earring', 'running');

    const dressed = run.bridesmaids.filter((b) => b.render.status === 'done');
    for (const b of run.bridesmaids) {
      if (b.render.status !== 'done') b.earring.status = 'skipped';
    }

    await Promise.all(
      dressed.map(async (b) => {
        await stage(b.earring, `bridesmaid.${b.id}.earring`, async () => {
          const measurement = b.measure.result!;
          // Metal comes from the measured undertone, silhouette from faceShape —
          // never the other way round (selector.ts header).
          const warmth = deriveSkin(measurement.skinHex).warmth;
          const choice = selectEarring(measurement.faceShape, warmth);
          const earringFileId = await deps.refs.earring(choice.silhouette, choice.metal);

          // cloth-v3 exposes no dst_id, so chain through a re-uploaded head-crop.
          const crop = await cropHead(b.render.result!.url);
          const headFileId = await deps.api.uploadFile(crop, 'image/jpeg', `${b.id}-head.jpg`);
          const url = await renderEarring(deps.api, { headFileId, earringFileId });
          return { url, choice };
        });
        // Earrings are the finishing touch, not the deliverable: if the chain
        // failed the dress render still stands as her final image.
        b.finalUrl = b.earring.result?.url ?? b.render.result?.url;
      }),
    );
  }

  run.status = 'done';
  run.stage = 'done';
  emit('run.done', 'done');
  return finish(run, deps);
}

async function finish(run: PartyRun, deps: RunPartyDeps): Promise<PartyRun> {
  try {
    run.units.after = await deps.api.getCredit();
    if (run.units.before != null && run.units.after != null) {
      run.units.spent = run.units.before - run.units.after;
    }
  } catch {
    /* balance unavailable — the run itself is unaffected */
  }
  return run;
}

/** Summary line for logs and the bench: how much of the run actually landed. */
export function runSummary(run: PartyRun): string {
  const done = (s: BridesmaidState[], k: 'measure' | 'render' | 'earring') =>
    s.filter((b) => b[k].status === 'done').length;
  const n = run.bridesmaids.length;
  return [
    `measured ${done(run.bridesmaids, 'measure')}/${n}`,
    `rendered ${done(run.bridesmaids, 'render')}/${n}`,
    `earrings ${done(run.bridesmaids, 'earring')}/${n}`,
    run.scoring
      ? `winner ${run.scoring.winner.colorway.name} (min ${run.scoring.winner.groupScore})`
      : 'no verdict',
    run.units.spent != null ? `${run.units.spent} units` : 'units unknown',
  ].join(' · ');
}
