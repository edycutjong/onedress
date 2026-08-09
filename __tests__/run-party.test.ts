import { describe, expect, it, vi } from 'vitest';
import { COLORWAYS } from '@/lib/colorway/data';
import { staticRefs } from '@/lib/pipeline/asset-refs';
import { runParty, runSummary } from '@/lib/pipeline/run-party';
import type { BridesmaidInput, PartyRun } from '@/lib/pipeline/types';
import { YouCamError } from '@/lib/youcam/client';
import { FEATURE_COST, type TaskRunner } from '@/lib/youcam/features';
import type { Feature } from '@/lib/youcam/types';

/**
 * The orchestrator under a fake API: zero network, zero units, so the failure
 * matrix that matters can be tested exhaustively instead of hoped for.
 *
 * The invariant every test here defends: ONE bridesmaid failing must never void
 * the verdict for the others (architecture.md §Failure contract).
 */

// head-crop is sharp-bound I/O over the network (fetch + libvips) and is out of the
// unit-coverage scope on purpose. Stubbing it lets the ONE test that exercises the
// orchestrator's DEFAULT crop wiring — the path taken in production, where no
// cropHead is injected — run with zero network and zero native decoding. Every
// other test in this file injects its own cropHead and never reaches this stub.
vi.mock('@/lib/pipeline/head-crop', () => ({
  fetchRender: async (url: string) => Buffer.from(`downloaded:${url}`),
  headCrop: async (bytes: Buffer) => Buffer.from(`cropped(${bytes.toString()})`),
}));

/** Six measured hexes spanning light → deep, as the demo party is designed to. */
const SKIN_BY_FACE: Record<string, string> = {
  face_b1: '#F2D5C0',
  face_b2: '#E8C3A6',
  face_b3: '#C99A72',
  face_b4: '#A9714B',
  face_b5: '#7A4A2E',
  face_b6: '#4A2E1F',
};

const PARTY: BridesmaidInput[] = Object.keys(SKIN_BY_FACE).map((faceFileId, i) => ({
  id: `b${i + 1}`,
  name: `Bridesmaid ${i + 1}`,
  faceFileId,
  bodyFileId: `body_b${i + 1}`,
}));

const REFS = staticRefs({
  ...Object.fromEntries(COLORWAYS.map((c) => [`colorway:${c.id}`, `dress_${c.id}`])),
  ...Object.fromEntries(
    (['stud', 'hoop', 'drop'] as const).flatMap((s) =>
      (['gold', 'silver'] as const).map((m) => [`earring:${s}-${m}`, `ear_${s}_${m}`]),
    ),
  ),
});

type FailFn = (feature: Feature, body: Record<string, unknown>) => string | undefined;

/** `failFirstCredit` simulates the balance endpoint being unreadable at run start. */
type ApiOpts = { failFirstCredit?: boolean };

function fakeApi(fail?: FailFn, opts: ApiOpts = {}) {
  let uploadCount = 0;
  let creditCalls = 0;
  let credit = 1000;
  const calls: Array<{ feature: Feature; body: Record<string, unknown> }> = [];
  const uploads: Array<{ bytes: Uint8Array | Buffer; contentType: string; fileName: string }> = [];

  const api: TaskRunner = {
    async runTask(feature, body) {
      calls.push({ feature, body });
      const code = fail?.(feature, body);
      if (code) throw new YouCamError(`fake ${feature} failure`, code);

      credit -= FEATURE_COST[feature];
      const src = body.src_file_id as string;
      switch (feature) {
        case 'skin-tone-analysis':
          return {
            results: {
              color: { skin_color: SKIN_BY_FACE[src] ?? '#bb9982' },
              face_quality: { has_face: true },
            },
          };
        case 'fitzpatrick-scale-analyzer':
          return { results: { fitzpatrick_scale: 'III' } };
        case 'face-attr-analysis':
          return { results: { faceshape: 'Heart' } };
        case 'cloth-v3':
          return { results: { url: `https://cdn.test/cloth-${src}-${body.ref_file_id}.jpg` } };
        case '2d-vto/earring':
          return { results: { url: `https://cdn.test/earring-${src}.png` } };
      }
    },
    async uploadFile(bytes, contentType, fileName) {
      uploads.push({ bytes, contentType, fileName });
      return `upload_${++uploadCount}`;
    },
    async getCredit() {
      if (opts.failFirstCredit && ++creditCalls === 1) {
        throw new YouCamError('balance unavailable', 'http_500');
      }
      return credit;
    },
  };

  return { api, calls, uploads };
}

const deps = (fail?: FailFn, opts: ApiOpts = {}) => {
  const { api, calls, uploads } = fakeApi(fail, opts);
  return {
    calls,
    uploads,
    deps: {
      api,
      refs: REFS,
      // Skip sharp and the network — the crop itself is tested via head-crop bounds.
      cropHead: async () => Buffer.from('fake-head-crop'),
    },
  };
};

const stages = (run: PartyRun, key: 'measure' | 'render' | 'earring') =>
  run.bridesmaids.map((b) => b[key].status);

describe('runParty — happy path', () => {
  it('measures, scores, renders and earrings all six', async () => {
    const { deps: d, calls } = deps();
    const run = await runParty(PARTY, d);

    expect(run.status).toBe('done');
    expect(stages(run, 'measure')).toEqual(Array(6).fill('done'));
    expect(stages(run, 'render')).toEqual(Array(6).fill('done'));
    expect(stages(run, 'earring')).toEqual(Array(6).fill('done'));

    // 18 analyzer calls, one cloth render each (+ counterfactual), one earring each.
    const count = (f: Feature) => calls.filter((c) => c.feature === f).length;
    expect(count('skin-tone-analysis')).toBe(6);
    expect(count('fitzpatrick-scale-analyzer')).toBe(6);
    expect(count('face-attr-analysis')).toBe(6);
    expect(count('2d-vto/earring')).toBe(6);
    expect(count('cloth-v3')).toBe(run.counterfactual ? 7 : 6);

    // The earring render wins as the final image when the chain succeeds.
    expect(run.bridesmaids[0].finalUrl).toContain('earring-');
    expect(run.units.spent).toBeGreaterThan(0);
    expect(runSummary(run)).toContain('measured 6/6');
  });

  it('picks a real colorway and reports the worst-case score', async () => {
    const { deps: d } = deps();
    const run = await runParty(PARTY, d);

    expect(run.scoring).toBeDefined();
    expect(COLORWAYS.map((c) => c.id)).toContain(run.scoring!.winner.colorway.id);
    expect(run.scoring!.ranked).toHaveLength(24);
    // The winner maximises the minimum: nobody scores below its groupScore.
    for (const p of run.scoring!.winner.perPerson) {
      expect(p.flatter).toBeGreaterThanOrEqual(run.scoring!.winner.groupScore);
    }
  });

  it('renders the counterfactual exactly when the fair pick differs from by-eye', async () => {
    const { deps: d } = deps();
    const run = await runParty(PARTY, d);

    if (run.scoring!.differsFromByEye) {
      expect(run.counterfactual).toBeDefined();
      expect(run.counterfactual!.bridesmaidId).toBe(run.scoring!.mostHurt.id);
      expect(run.counterfactual!.render.result?.colorwayId).toBe(run.scoring!.byEye.colorway.id);
    } else {
      expect(run.counterfactual).toBeUndefined();
    }
  });

  it('chains the earring off a head-crop of the render when no cropHead is injected', async () => {
    // The production wiring: runParty falls back to `headCrop(await fetchRender(url))`.
    // Proving the composition (right URL → download → crop → re-upload) matters because
    // cloth-v3 returns no dst_id, so this re-upload IS the only link between the two
    // renders — if it threaded the wrong bytes the earring would land on the wrong face.
    const { deps: d, uploads } = deps();
    const run = await runParty([PARTY[0]], { api: d.api, refs: d.refs });

    const renderUrl = run.bridesmaids[0].render.result!.url;
    expect(uploads).toHaveLength(1);
    expect(uploads[0].bytes.toString()).toBe(`cropped(downloaded:${renderUrl})`);
    expect(uploads[0].contentType).toBe('image/jpeg');
    expect(uploads[0].fileName).toBe('b1-head.jpg');
    expect(run.bridesmaids[0].earring.status).toBe('done');
  });

  it('renders no counterfactual when the fair pick IS the by-eye pick', async () => {
    // One bridesmaid: min == mean by construction, so the two objectives cannot
    // disagree and there is nothing to compare against — no extra cloth-v3 call.
    const { deps: d, calls } = deps();
    const run = await runParty([PARTY[0]], d);

    expect(run.scoring!.differsFromByEye).toBe(false);
    expect(run.counterfactual).toBeUndefined();
    expect(calls.filter((c) => c.feature === 'cloth-v3')).toHaveLength(1);
    expect(run.status).toBe('done');
  });

  it('registers the run synchronously, before any API call', async () => {
    const { deps: d } = deps();
    let seen: string | undefined;
    const promise = runParty(PARTY, { ...d, onCreate: (run) => (seen = run.id) });
    // POST /api/party depends on this: it returns the id without awaiting the run.
    expect(seen).toBeDefined();
    const run = await promise;
    expect(run.id).toBe(seen);
  });
});

describe('runParty — partial failure isolation', () => {
  it('excludes an unmeasurable bridesmaid but still produces a verdict', async () => {
    const { deps: d } = deps((feature, body) =>
      feature === 'skin-tone-analysis' && body.src_file_id === 'face_b3'
        ? 'error_lighting_dark'
        : undefined,
    );
    const run = await runParty(PARTY, d);

    expect(run.status).toBe('done');
    expect(run.bridesmaids[2].measure.status).toBe('failed');
    expect(run.bridesmaids[2].measure.error?.title).toBe('More light');
    // She is not scored...
    expect(run.scoring!.winner.perPerson.map((p) => p.id)).not.toContain('b3');
    expect(run.scoring!.winner.perPerson).toHaveLength(5);
    // ...and she is not rendered, but everyone else is.
    expect(run.bridesmaids[2].render.status).toBe('pending');
    expect(run.bridesmaids.filter((b) => b.render.status === 'done')).toHaveLength(5);
  });

  it('keeps the measurement when only the optional analyzers fail', async () => {
    const { deps: d } = deps((feature) =>
      feature === 'fitzpatrick-scale-analyzer' || feature === 'face-attr-analysis'
        ? 'http_500'
        : undefined,
    );
    const run = await runParty(PARTY, d);

    expect(stages(run, 'measure')).toEqual(Array(6).fill('done'));
    expect(run.bridesmaids[0].measure.result!.skinHex).toBe('#F2D5C0');
    expect(run.bridesmaids[0].measure.result!.fitzpatrick).toBeUndefined();
    expect(run.bridesmaids[0].measure.result!.faceShape).toBeUndefined();
    // No faceShape → the selector's documented hoop fallback.
    expect(run.bridesmaids[0].earring.result!.choice.silhouette).toBe('hoop');
  });

  it('falls back to the dress render when the earring chain fails', async () => {
    const { deps: d } = deps((feature) =>
      feature === '2d-vto/earring' ? 'error_editing_failed' : undefined,
    );
    const run = await runParty(PARTY, d);

    expect(run.status).toBe('done');
    expect(stages(run, 'earring')).toEqual(Array(6).fill('failed'));
    // The verdict is still valid — just without earrings (build-plan kill criterion).
    expect(run.bridesmaids[0].finalUrl).toContain('cloth-');
    expect(run.scoring).toBeDefined();
  });

  it('skips the earring pass for a bridesmaid whose render failed', async () => {
    const { deps: d } = deps((feature, body) =>
      feature === 'cloth-v3' && body.src_file_id === 'body_b2' ? 'error_pose' : undefined,
    );
    const run = await runParty(PARTY, d);

    expect(run.bridesmaids[1].render.status).toBe('failed');
    expect(run.bridesmaids[1].render.error?.title).toBe('Stand up straight');
    expect(run.bridesmaids[1].earring.status).toBe('skipped');
    expect(run.bridesmaids[1].finalUrl).toBeUndefined();
    // Everyone else still lands.
    expect(run.bridesmaids.filter((b) => b.finalUrl).length).toBe(5);
  });

  it('reports a missing reference asset as a config problem', async () => {
    const { deps: d } = deps();
    const run = await runParty(PARTY, { ...d, refs: staticRefs({}) });

    expect(run.bridesmaids[0].render.status).toBe('failed');
    expect(run.bridesmaids[0].render.error?.code).toBe('missing_ref_asset');
    expect(run.bridesmaids[0].render.error?.recovery).toBe('config');
    // Measurement and scoring survive — only the render stage is blocked.
    expect(run.scoring).toBeDefined();
  });
});

describe('runParty — fatal cases', () => {
  it('fails the whole run only when nobody can be measured', async () => {
    const { deps: d } = deps((feature) =>
      feature === 'skin-tone-analysis' ? 'error_face_angle_invalid' : undefined,
    );
    const run = await runParty(PARTY, d);

    expect(run.status).toBe('failed');
    expect(run.error?.code).toBe('no_measurable_bridesmaids');
    expect(run.scoring).toBeUndefined();
    expect(run.stage).toBe('done');
  });

  it('still records the unit ledger on a failed run', async () => {
    const { deps: d } = deps((feature) =>
      feature === 'skin-tone-analysis' ? 'error_pose' : undefined,
    );
    const run = await runParty(PARTY, d);
    expect(run.units.before).toBe(1000);
    expect(run.units.estimated).toBe(260);
  });

  it('summarises a run that produced no verdict', async () => {
    const { deps: d } = deps((feature) =>
      feature === 'skin-tone-analysis' ? 'error_lighting_dark' : undefined,
    );
    const run = await runParty(PARTY, d);

    expect(runSummary(run)).toContain('measured 0/6');
    expect(runSummary(run)).toContain('rendered 0/6');
    expect(runSummary(run)).toContain('no verdict');
  });
});

describe('runParty — unit ledger', () => {
  it('completes the run when the opening balance cannot be read', async () => {
    // "an unreadable balance must not stop a run" (run-party.ts §Balance before).
    // The run still delivers a verdict; only the delta is unknown.
    const { deps: d } = deps(undefined, { failFirstCredit: true });
    const run = await runParty(PARTY, d);

    expect(run.status).toBe('done');
    expect(run.scoring).toBeDefined();
    expect(run.units.before).toBeUndefined();
    expect(run.units.after).toBeGreaterThan(0);
    expect(run.units.spent).toBeUndefined();
    expect(runSummary(run)).toContain('units unknown');
  });
});

describe('runParty — bench mode', () => {
  it('skips earrings entirely when asked', async () => {
    const { deps: d, calls } = deps();
    const run = await runParty(PARTY, { ...d, skipEarring: true });

    expect(stages(run, 'earring')).toEqual(Array(6).fill('skipped'));
    expect(calls.filter((c) => c.feature === '2d-vto/earring')).toHaveLength(0);
    expect(run.status).toBe('done');
  });

  it('emits one event per stage transition for the cascade to animate off', async () => {
    const { deps: d } = deps();
    const events: string[] = [];
    const run = await runParty(PARTY, {
      ...d,
      emit: (_run, e) => events.push(`${e.path}:${e.status}`),
    });

    expect(events).toContain('bridesmaid.b1.measure:running');
    expect(events).toContain('bridesmaid.b1.render:done');
    expect(events).toContain('run.done:done');
    expect(run.events.length).toBe(events.length);
  });
});
