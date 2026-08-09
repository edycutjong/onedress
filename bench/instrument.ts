import type { TaskRunner } from '../lib/youcam/features';
import type { Feature } from '../lib/youcam/types';

/**
 * Two independent measurement layers, because they answer two different questions
 * and blending them would produce exactly the kind of number this bench exists to
 * avoid.
 *
 * **Layer 1 — the fetch tap (`installFetchTap`).** Counts real HTTP requests and
 * classifies each one by kind. This is the only way to count *polls* honestly:
 * `YouCamClient.pollTask` loops internally, so from outside the client one task is
 * one call — while on the wire it is one POST plus however many GETs the task needed
 * to finish. Tapping `globalThis.fetch` means the client, `features.ts` and
 * `run-party.ts` all run completely unmodified; we reimplement no HTTP.
 *
 * **Layer 2 — the runner wrapper (`instrumentRunner`).** Times each logical
 * operation at the `TaskRunner` seam that `run-party.ts` already takes as a
 * dependency: one `runTask(feature, …)` = create + poll-to-success, which is the
 * user-visible latency of that endpoint. One upload = init + presigned PUT.
 *
 * Layer 1 gives "how many calls of what kind"; layer 2 gives "how long did
 * skin-tone-analysis take". Reporting one as the other is the mistake.
 */

export type CallKind =
  | 'file.init'
  | 'file.put'
  | 'task.create'
  | 'task.poll'
  | 'credit'
  | 'download'
  | 'other';

export const CALL_KINDS: readonly CallKind[] = [
  'file.init',
  'file.put',
  'task.create',
  'task.poll',
  'credit',
  'download',
  'other',
];

/** Human labels, so the report explains itself without a legend. */
export const CALL_KIND_LABEL: Record<CallKind, string> = {
  'file.init': 'file upload — init   (POST /s2s/v2.0/file)',
  'file.put': 'file upload — bytes  (PUT presigned URL)',
  'task.create': 'task create          (POST /s2s/v2.0/task/…)',
  'task.poll': 'task poll            (GET  /s2s/v2.0/task/…/{id})',
  credit: 'credit balance       (GET  /s2s/v1.0/client/credit)',
  download: 'result download      (GET  presigned result URL)',
  other: 'other',
};

export interface HttpCall {
  kind: CallKind;
  /** the YouCam feature this call belongs to — set for task.create / task.poll only */
  feature?: string;
  method: string;
  /** 0 when the request threw before producing a response */
  status: number;
  ms: number;
}

export interface FetchTap {
  calls: HttpCall[];
  restore(): void;
}

const TASK_PATH = /\/s2s\/v2\.0\/task\/(.+)$/;

/** Classify one request by URL + method. Method disambiguates create (POST) from poll (GET). */
export function classify(url: string, method: string): { kind: CallKind; feature?: string } {
  const path = url.split('?')[0];
  if (path.includes('/s2s/v1.0/client/credit')) return { kind: 'credit' };
  if (/\/s2s\/v2\.0\/file$/.test(path) && method === 'POST') return { kind: 'file.init' };

  const task = TASK_PATH.exec(path);
  if (task) {
    // `2d-vto/earring` contains a slash, so the feature cannot be taken as "one
    // segment": on create the whole tail IS the feature, on poll the tail is the
    // feature plus a trailing task id.
    if (method === 'POST') return { kind: 'task.create', feature: task[1] };
    const parts = task[1].split('/');
    return { kind: 'task.poll', feature: parts.slice(0, -1).join('/') || task[1] };
  }
  if (method === 'PUT') return { kind: 'file.put' };
  if (method === 'GET') return { kind: 'download' };
  return { kind: 'other' };
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  const m = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
  return String(m).toUpperCase();
}

/**
 * Wrap `globalThis.fetch` so every request is counted. Install this LAST (after any
 * fake transport), so the tap sees the same calls the real client would have made.
 */
export function installFetchTap(): FetchTap {
  const original = globalThis.fetch;
  const calls: HttpCall[] = [];

  const tapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    const method = methodOf(input, init);
    const started = performance.now();
    try {
      const res = await original(input, init);
      calls.push({
        ...classify(url, method),
        method,
        status: res.status,
        ms: performance.now() - started,
      });
      return res;
    } catch (err) {
      calls.push({ ...classify(url, method), method, status: 0, ms: performance.now() - started });
      throw err;
    }
  };

  globalThis.fetch = tapped as typeof globalThis.fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

/** One timed logical operation: an endpoint round trip, or a file upload. */
export interface OpTiming {
  /** the YouCam feature name, or 'file-upload' */
  label: string;
  ms: number;
  ok: boolean;
}

export interface RunnerProbe {
  timings: OpTiming[];
  runner: TaskRunner;
}

/**
 * Wrap a `TaskRunner` (the seam `run-party.ts` already depends on) so every endpoint
 * round trip and every upload is timed. Failures are timed too and marked `ok:false`
 * — a stage that failed after 40s is information, and silently dropping it would
 * flatter the p95.
 */
export function instrumentRunner(inner: TaskRunner): RunnerProbe {
  const timings: OpTiming[] = [];

  const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    try {
      const out = await fn();
      timings.push({ label, ms: performance.now() - started, ok: true });
      return out;
    } catch (err) {
      timings.push({ label, ms: performance.now() - started, ok: false });
      throw err;
    }
  };

  const runner: TaskRunner = {
    runTask: (feature: Feature, body: Record<string, unknown>) =>
      timed(feature, () => inner.runTask(feature, body)),
    uploadFile: (bytes: Uint8Array | Buffer, contentType: string, fileName: string) =>
      timed('file-upload', () => inner.uploadFile(bytes, contentType, fileName)),
    // Not timed: the credit meter is bookkeeping around the run, not part of it.
    getCredit: () => inner.getCredit(),
  };

  return { timings, runner };
}
