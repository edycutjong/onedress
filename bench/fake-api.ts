import { COLORWAYS } from '../lib/colorway/data';
import { FEATURE_COST } from '../lib/youcam/features';
import type { Feature } from '../lib/youcam/types';
import { seededIndex, syntheticPortrait, syntheticRender } from './synth';

/**
 * The dry-run transport: a fake YouCam **at the `fetch` layer**, not a fake client.
 *
 * This matters. A hand-rolled `TaskRunner` stub would bypass `YouCamClient` entirely
 * — no rate limiter, no retry path, no Zod validation, no create/poll split — and the
 * bench would then be measuring its own stub. Faking the transport instead means
 * `client.ts`, `features.ts` and `run-party.ts` all execute for real: the same file →
 * task → poll sequence, the same schemas, the same error taxonomy, the same number of
 * HTTP requests. Only the bytes on the wire are invented, and the cost is zero units.
 *
 * The fake also runs a unit ledger, decrementing a synthetic balance by `FEATURE_COST`
 * on each successful task, so the "measured delta" path in `run-party.ts` and in the
 * bench is exercised end to end rather than short-circuited.
 */

/** Where the fake lives. `.invalid` is reserved by RFC 2606 — it can never resolve. */
export const DRY_HOST = 'https://dry-run.invalid';

/** Skin hexes handed out to fake subjects — a deliberate spread across the depth range. */
const FAKE_SKIN = ['#F1D2BE', '#E2B893', '#C99A72', '#A9714C', '#7C4B31', '#4E2E1E'] as const;
const FAKE_FITZ = ['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI'] as const;
const FAKE_SHAPE = ['Oval', 'Round', 'Heart', 'Square', 'Diamond', 'Oblong'] as const;

export interface FakeOptions {
  /** synthetic starting balance, so the credit-delta path has something to measure */
  startingBalance?: number;
  /** how many polls a task reports `running` before succeeding (default 1) */
  pollsBeforeSuccess?: number;
}

export interface FakeYouCam {
  restore(): void;
  /** synthetic units consumed — the fake's own ledger, for cross-checking the delta */
  spent(): number;
}

interface TaskState {
  feature: Feature;
  polls: number;
  /** colorway id inferred from the ref file, so the fake render is the right colour */
  colorwayId?: string;
  /** file_id of the source image, so analyzer answers are stable per subject */
  srcFileId?: string;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Install the fake transport. Call BEFORE `installFetchTap()` so the tap wraps the
 * fake and counts exactly the requests a live run would have made.
 */
export function installFakeYouCam(options: FakeOptions = {}): FakeYouCam {
  const original = globalThis.fetch;
  const pollsBeforeSuccess = options.pollsBeforeSuccess ?? 1;
  let balance = options.startingBalance ?? 1000;
  let consumed = 0;
  let seq = 0;

  /** file_id → the name it was uploaded under (the fake's only "storage") */
  const files = new Map<string, string>();
  /** face file_id → subject index, assigned in upload order so every fake subject
   *  gets a DIFFERENT skin tone (a hash would collide and flatten the score board) */
  const faceOrder = new Map<string, number>();
  let faceCount = 0;
  const tasks = new Map<string, TaskState>();

  const nextId = (prefix: string) => `${prefix}-${(++seq).toString(36)}`;

  const readJson = (init?: RequestInit): Record<string, unknown> => {
    if (typeof init?.body !== 'string') return {};
    try {
      return JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  /** Analyzer answers keyed off the source file → stable per subject, per run. */
  const subjectIndex = (fileId?: string): number =>
    faceOrder.get(fileId ?? '') ??
    seededIndex(files.get(fileId ?? '') ?? fileId ?? 'unknown', FAKE_SKIN.length);

  const resultsFor = (task: TaskState, taskId: string): Record<string, unknown> => {
    const i = subjectIndex(task.srcFileId);
    switch (task.feature) {
      case 'skin-tone-analysis':
        return {
          color: { skin_color: FAKE_SKIN[i] },
          face_quality: { has_face: true, frontal: 'good', lighting: 'good' },
        };
      case 'fitzpatrick-scale-analyzer':
        return { fitzpatrick_scale: FAKE_FITZ[i] };
      case 'face-attr-analysis':
        return { faceshape: FAKE_SHAPE[i] };
      case 'cloth-v3':
        return { url: `${DRY_HOST}/render/cloth/${task.colorwayId ?? 'unknown'}/${taskId}.jpg` };
      case '2d-vto/earring':
        return { url: `${DRY_HOST}/render/earring/${taskId}.jpg` };
    }
  };

  const handle = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (
      init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
    ).toUpperCase();
    const path = url.split('?')[0];

    // ---- credit ----
    if (path.includes('/s2s/v1.0/client/credit')) {
      return json({ status: 200, results: [{ type: 'ApiSubsToken', amount_dec: balance }] });
    }

    // ---- file init: hand back a presigned PUT pointing back at this fake ----
    if (/\/s2s\/v2\.0\/file$/.test(path) && method === 'POST') {
      const body = readJson(init);
      const requested = (body.files as { file_name?: string }[] | undefined) ?? [{}];
      const fileId = nextId('file');
      const fileName = requested[0]?.file_name ?? fileId;
      files.set(fileId, fileName);
      if (fileName.startsWith('face')) faceOrder.set(fileId, faceCount++ % FAKE_SKIN.length);
      return json({
        status: 200,
        data: {
          files: [
            {
              file_id: fileId,
              requests: [
                {
                  url: `${DRY_HOST}/put/${fileId}`,
                  method: 'PUT',
                  headers: { 'Content-Type': 'image/jpeg' },
                },
              ],
            },
          ],
        },
      });
    }

    // ---- presigned byte upload ----
    if (path.startsWith(`${DRY_HOST}/put/`)) return new Response(null, { status: 200 });

    // ---- task create ----
    const taskPath = /\/s2s\/v2\.0\/task\/(.+)$/.exec(path);
    if (taskPath && method === 'POST') {
      const feature = taskPath[1] as Feature;
      const body = readJson(init);
      const refId = body.ref_file_id as string | undefined;
      const refName = refId ? files.get(refId) : undefined;
      const taskId = nextId('task');
      tasks.set(taskId, {
        feature,
        polls: 0,
        // refs are uploaded as `colorway:<id>.jpg` (see refs.ts) — recover the id so
        // the synthetic render is actually the winning colour.
        colorwayId: refName?.startsWith('colorway:')
          ? refName.slice('colorway:'.length).replace(/\.jpg$/, '')
          : undefined,
        srcFileId: body.src_file_id as string | undefined,
      });
      const cost = FEATURE_COST[feature] ?? 0;
      balance -= cost;
      consumed += cost;
      return json({ status: 200, data: { task_id: taskId } });
    }

    // ---- task poll ----
    if (taskPath && method === 'GET') {
      const segments = taskPath[1].split('/');
      const taskId = segments[segments.length - 1];
      const task = tasks.get(taskId);
      if (!task) return json({ status: 404 }, 404);
      task.polls += 1;
      if (task.polls <= pollsBeforeSuccess) {
        return json({ status: 200, data: { task_status: 'running', error: null } });
      }
      return json({
        status: 200,
        data: { task_status: 'success', error: null, results: resultsFor(task, taskId) },
      });
    }

    // ---- result download: real JPEG bytes, because sharp genuinely reads them ----
    const cloth = /\/render\/cloth\/([^/]+)\/([^/]+)\.jpg$/.exec(path);
    if (cloth) {
      const hex = COLORWAYS.find((c) => c.id === cloth[1])?.hex ?? '#9CAF88';
      const bytes = await syntheticRender(hex, `${cloth[1]}:${cloth[2]}`);
      return new Response(bytes as unknown as BodyInit, {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    }
    const earring = /\/render\/earring\/([^/]+)\.jpg$/.exec(path);
    if (earring) {
      const bytes = await syntheticPortrait(earring[1]);
      return new Response(bytes as unknown as BodyInit, {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    }

    // Anything else would be a real network call — refuse loudly rather than leak out.
    throw new Error(`dry-run fake received an unexpected request: ${method} ${path}`);
  };

  globalThis.fetch = handle as typeof globalThis.fetch;
  return {
    restore() {
      globalThis.fetch = original;
    },
    spent: () => consumed,
  };
}
