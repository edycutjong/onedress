import { CALL_KINDS, CALL_KIND_LABEL, type CallKind, type HttpCall } from './instrument';
import { allDeltas, type RenderFidelity, type Window } from './fidelity';
import { MEANINGFUL_N, round, summarize } from './stats';

/**
 * Report rendering, kept apart from measurement so the two can be reviewed
 * separately: nothing in this file can change a number, and nothing that produces a
 * number formats it.
 *
 * The house style is one rule: never print a summary statistic without the evidence
 * next to it. Percentiles ship with their raw sample list, the ΔE distribution ships
 * with its per-render breakdown, and the measured unit delta ships alongside the
 * a-priori estimate so a divergence is visible instead of buried.
 */

export interface LatencyRow {
  label: string;
  samples: number[];
  failures: number;
}

export interface BenchReport {
  mode: 'dry-run' | 'live';
  startedAt: string;
  finishedAt: string;
  subjects: number;
  runs: number;
  earringEnabled: boolean;
  refsSource: string;
  refsAuthentic: boolean;
  subjectsSource: string;
  host: string;
  calls: HttpCall[];
  latency: LatencyRow[];
  totalWallClockMs: number[];
  units: {
    estimate: number;
    before?: number;
    after?: number;
    spent?: number;
    perRun: (number | undefined)[];
  };
  fidelity: {
    window: Window;
    grid: number;
    renders: RenderFidelity[];
  };
  outcomes: string[];
  notes: string[];
}

const BAR = '─'.repeat(78);

function heading(text: string): string {
  const line = `── ${text} `;
  return `\n${line}${'─'.repeat(Math.max(0, 78 - line.length))}`;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

/** Raw samples, truncated only when the list would swamp the report. */
function sampleList(samples: readonly number[], places = 0): string {
  const shown = samples.slice(0, 12).map((s) => round(s, places).toString());
  const tail = samples.length > 12 ? `, …+${samples.length - 12}` : '';
  return `[${shown.join(', ')}${tail}]`;
}

function callCounts(calls: readonly HttpCall[]): string[] {
  const byKind = new Map<CallKind, number>();
  const byFeature = new Map<string, { create: number; poll: number }>();
  for (const call of calls) {
    byKind.set(call.kind, (byKind.get(call.kind) ?? 0) + 1);
    if (call.feature && (call.kind === 'task.create' || call.kind === 'task.poll')) {
      const entry = byFeature.get(call.feature) ?? { create: 0, poll: 0 };
      if (call.kind === 'task.create') entry.create += 1;
      else entry.poll += 1;
      byFeature.set(call.feature, entry);
    }
  }

  const lines: string[] = [];
  for (const kind of CALL_KINDS) {
    const n = byKind.get(kind) ?? 0;
    if (n === 0 && kind === 'other') continue;
    lines.push(`  ${pad(CALL_KIND_LABEL[kind], 54)}${padLeft(String(n), 6)}`);
  }
  lines.push(`  ${pad('', 54)}${padLeft('──────', 6)}`);
  lines.push(`  ${pad('TOTAL HTTP requests', 54)}${padLeft(String(calls.length), 6)}`);

  if (byFeature.size > 0) {
    lines.push('');
    lines.push(`  ${pad('per endpoint', 34)}${padLeft('creates', 10)}${padLeft('polls', 10)}`);
    for (const [feature, entry] of [...byFeature].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(
        `  ${pad(feature, 34)}${padLeft(String(entry.create), 10)}${padLeft(String(entry.poll), 10)}`,
      );
    }
  }

  const failed = calls.filter((c) => c.status === 0 || c.status >= 400);
  if (failed.length > 0) {
    lines.push('');
    lines.push(`  non-2xx/failed requests: ${failed.length} (retries are counted individually)`);
  }
  return lines;
}

function latencyBlock(report: BenchReport): string[] {
  const rows: LatencyRow[] = [
    ...report.latency,
    { label: 'TOTAL wall-clock / run', samples: report.totalWallClockMs, failures: 0 },
  ];
  const lines: string[] = [
    `  ${pad('stage', 26)}${padLeft('n', 4)}${padLeft('p50 ms', 10)}${padLeft('p95 ms', 10)}${padLeft('min', 9)}${padLeft('max', 9)}`,
  ];
  let anySmall = false;
  for (const row of rows) {
    if (row.samples.length === 0) continue;
    const s = summarize(row.samples);
    if (!s.meaningful) anySmall = true;
    const flag = s.meaningful ? ' ' : '*';
    lines.push(
      `  ${pad(row.label, 26)}${padLeft(String(s.n), 4)}${padLeft(String(round(s.p50, 0)), 10)}${padLeft(
        String(round(s.p95, 0)) + flag,
        10,
      )}${padLeft(String(round(s.min, 0)), 9)}${padLeft(String(round(s.max, 0)), 9)}`,
    );
    lines.push(`  ${pad('', 26)}raw ${sampleList(row.samples)}`);
    if (row.failures > 0) lines.push(`  ${pad('', 26)}${row.failures} failed attempt(s) included`);
  }
  if (anySmall) {
    lines.push('');
    lines.push(
      `  * n < ${MEANINGFUL_N}: nearest-rank p95 over this few samples IS the maximum. Read the raw`,
    );
    lines.push('    list, not the percentile. These are latency observations, not a latency SLO.');
  }
  return lines;
}

function unitsBlock(report: BenchReport): string[] {
  const u = report.units;
  const lines = [
    `  ${pad('a-priori estimate (FEATURE_COST, worst case)', 48)}${padLeft(String(u.estimate), 8)}`,
    `  ${pad('balance before (GET /s2s/v1.0/client/credit)', 48)}${padLeft(String(u.before ?? '—'), 8)}`,
    `  ${pad('balance after  (GET /s2s/v1.0/client/credit)', 48)}${padLeft(String(u.after ?? '—'), 8)}`,
    `  ${pad('', 48)}${padLeft('──────', 8)}`,
    `  ${pad('MEASURED units spent (before − after)', 48)}${padLeft(String(u.spent ?? '—'), 8)}`,
  ];
  if (u.spent != null && report.subjects > 0 && report.runs > 0) {
    const per = u.spent / (report.subjects * report.runs);
    lines.push(`  ${pad('per subject per run', 48)}${padLeft(String(round(per, 1)), 8)}`);
  }
  if (u.perRun.some((v) => v != null)) {
    lines.push(`  per-run deltas: [${u.perRun.map((v) => v ?? '—').join(', ')}]`);
  }
  if (u.spent != null && u.spent !== u.estimate) {
    lines.push(`  note: measured ≠ estimate. The estimate assumes every stage succeeds and always`);
    lines.push('        includes the counterfactual render; the measured delta is the truth.');
  }
  return lines;
}

function fidelityBlock(report: BenchReport): string[] {
  const { renders, window, grid } = report.fidelity;
  if (renders.length === 0) {
    return ['  no renders completed — nothing to sample'];
  }
  const pool = allDeltas(renders);
  const s = summarize(pool);
  const w = `l${window.left} t${window.top} w${window.width} h${window.height}`;
  const lines = [
    `  basis:   rendered garment patch vs ${renders[0].basis}`,
    `  window:  ${w}   grid: ${grid}×${grid} = ${grid * grid} patches per render`,
    `  pool:    ${renders.length} render(s) × ${grid * grid} patches = ${pool.length} samples`,
    '',
    `  ${pad('ΔE00', 12)}${padLeft('min', 9)}${padLeft('median', 9)}${padLeft('max', 9)}${padLeft('mean', 9)}`,
    `  ${pad('', 12)}${padLeft(String(round(s.min)), 9)}${padLeft(String(round(s.median)), 9)}${padLeft(
      String(round(s.max)),
      9,
    )}${padLeft(String(round(s.mean)), 9)}`,
    '',
    `  ${pad('per render', 20)}${pad('colorway', 22)}${pad('intended', 10)}${padLeft('median', 9)}${padLeft('min', 8)}${padLeft('max', 8)}`,
  ];
  for (const r of renders) {
    const rs = summarize(r.patches.map((p) => p.dE));
    lines.push(
      `  ${pad(r.subjectName ?? r.subjectId, 20)}${pad(r.colorwayName, 22)}${pad(r.intendedHex, 10)}${padLeft(
        String(round(rs.median)),
        9,
      )}${padLeft(String(round(rs.min)), 8)}${padLeft(String(round(rs.max)), 8)}`,
    );
    lines.push(`  ${pad('', 20)}sampled hexes: ${r.patches.map((p) => p.hex).join(' ')}`);
  }
  if (renders.length === 1) {
    lines.push('');
    lines.push('  ⚠ one render only: this spread is WITHIN-render variation. Between-render');
    lines.push('    variation needs N ≥ 2 and is the larger term. Raise --subjects to see it.');
  }
  if (!report.refsAuthentic) {
    lines.push('');
    lines.push('  ⚠ the garments used are NOT the shipped reference set (public/refs):');
    lines.push(`      ${report.refsSource}`);
    lines.push('    The number above is a real measurement of colour transfer for THAT reference;');
    lines.push('    it is not yet a claim about the 24 shipped colorways.');
  }
  return lines;
}

export function renderReport(report: BenchReport): string {
  const banner =
    report.mode === 'dry-run'
      ? 'DRY RUN — fake transport, synthetic images, ZERO units spent. Numbers below are\n' +
        'NOT measurements of the YouCam API. They demonstrate the report format and prove\n' +
        'the code path. Run `npm run bench -- --yes` for real numbers.'
      : 'LIVE RUN — real calls against the YouCam API. Every number below is measured.';

  const out: string[] = [
    BAR,
    `OneDress benchmark — ${report.mode.toUpperCase()}`,
    BAR,
    banner,
    '',
    `  started    ${report.startedAt}`,
    `  finished   ${report.finishedAt}`,
    `  subjects   ${report.subjects} per run × ${report.runs} run(s)`,
    `  earrings   ${report.earringEnabled ? 'enabled' : 'skipped (--no-earring)'}`,
    `  subjects ← ${report.subjectsSource}`,
    `  refs     ← ${report.refsSource}`,
    `  host       ${report.host}`,
  ];

  out.push(heading('1. Call counts — exact, split by kind'));
  out.push(...callCounts(report.calls));

  out.push(heading('2. Per-stage latency (task create → success)'));
  out.push(...latencyBlock(report));

  out.push(heading('3. Units — measured from the credit endpoint, not summed'));
  out.push(...unitsBlock(report));

  out.push(heading('4. Render fidelity ΔE00 (CIEDE2000) — distribution'));
  out.push(...fidelityBlock(report));

  out.push(heading('5. Run outcomes'));
  for (const line of report.outcomes) out.push(`  ${line}`);

  if (report.notes.length > 0) {
    out.push(heading('Notes'));
    for (const note of report.notes) out.push(`  · ${note}`);
  }

  out.push('');
  out.push(BAR);
  return out.join('\n');
}
