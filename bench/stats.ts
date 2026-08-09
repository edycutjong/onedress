/**
 * The smallest honest statistics layer the bench needs.
 *
 * Everything here is deliberately dumb and inspectable, because the bench's whole
 * value proposition is "nobody has to trust the number". Two rules follow from that:
 *
 *  1. **Nearest-rank percentiles, no interpolation.** Every reported p50/p95 is an
 *     ACTUAL observed sample, not a value synthesised between two samples. With the
 *     tiny N this bench runs at, an interpolated p95 would be a number that never
 *     happened.
 *  2. **Small samples are labelled, not laundered.** `isMeaningful()` is false below
 *     `MEANINGFUL_N`, and the report prints the raw sample list next to the summary
 *     so a reader can see for themselves that a "p95" over 3 runs is just the max.
 */

/**
 * Below this many samples a percentile is not a percentile. 20 is the point where
 * nearest-rank p95 stops being identical to the maximum (ceil(0.95 × 20) = 19 < 20).
 */
export const MEANINGFUL_N = 20;

export interface Summary {
  n: number;
  min: number;
  median: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
  /** false when n < MEANINGFUL_N — the caller MUST surface this, not hide it */
  meaningful: boolean;
}

/** Nearest-rank percentile over an ascending-sorted array. Always returns a real sample. */
export function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return Number.NaN;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const index = Math.min(Math.max(rank - 1, 0), sortedAsc.length - 1);
  return sortedAsc[index];
}

export function summarize(samples: readonly number[]): Summary {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return {
      n: 0,
      min: Number.NaN,
      median: Number.NaN,
      p50: Number.NaN,
      p95: Number.NaN,
      max: Number.NaN,
      mean: Number.NaN,
      meaningful: false,
    };
  }
  return {
    n,
    min: sorted[0],
    median: percentile(sorted, 50),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[n - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / n,
    meaningful: n >= MEANINGFUL_N,
  };
}

/** Round to `places` decimals — for display only, never for stored raw samples. */
export function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
