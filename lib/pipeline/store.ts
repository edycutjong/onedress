import type { PartyRun, RunEvent } from './types';

/**
 * In-memory run store. Deliberately not a database: architecture.md scopes state to
 * "the in-memory party object for the demo session" — no accounts, no persistence,
 * nothing to leak between visitors. A cold serverless instance simply has no runs,
 * which is why the judged default path is the pre-baked cached demo party rather
 * than a live run.
 *
 * Bounded to MAX_RUNS so a long-lived instance cannot grow without limit.
 */

const MAX_RUNS = 20;

type Listener = (event: RunEvent, run: PartyRun) => void;

const runs = new Map<string, PartyRun>();
const listeners = new Map<string, Set<Listener>>();

export function putRun(run: PartyRun): void {
  runs.set(run.id, run);
  // Evict oldest-inserted first (Map preserves insertion order).
  while (runs.size > MAX_RUNS) {
    const oldest = runs.keys().next().value;
    if (oldest === undefined) break;
    runs.delete(oldest);
    listeners.delete(oldest);
  }
}

export function getRun(id: string): PartyRun | undefined {
  return runs.get(id);
}

export function subscribe(id: string, listener: Listener): () => void {
  const set = listeners.get(id) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(id, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(id);
  };
}

export function publish(run: PartyRun, event: RunEvent): void {
  const set = listeners.get(run.id);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event, run);
    } catch {
      // A broken SSE connection must never take down the pipeline that emitted.
    }
  }
}

/** Test seam. */
export function clearRuns(): void {
  runs.clear();
  listeners.clear();
}
