/**
 * `cloth-v3` latency distribution — `npm run bench:cloth`.
 *
 * ── Why this exists separately from `run-bench.ts` ───────────────────────────
 * The main bench measures the WHOLE pipeline, and a full subject costs 43 units
 * (skin-tone 20 + fitzpatrick 10 + face-attr 10 + cloth-v3 2 + earring 1). Getting
 * `stats.MEANINGFUL_N` = 20 samples that way costs ~860 units — more than the grant
 * has ever held. So the main bench honestly reports "true p50 / p95: not measured".
 *
 * But the interesting stage is cheap. `cloth-v3` is the SLOWEST endpoint (~13 s of the
 * 33.4 s end-to-end) and bills **2 units per call**, so 20 renders cost **40 units** —
 * 7.6% of the grant for a real, non-degenerate p95 on the stage that dominates the wall
 * clock. That is the entire trade this file exists to make.
 *
 * ── What it does NOT measure ─────────────────────────────────────────────────
 * Latency only. This is deliberately not a fidelity run: it renders the SAME garment
 * onto the SAME body N times, so ΔE would just re-measure one pairing N times and tell
 * you nothing new. `run-bench.ts` owns fidelity; this file owns the timing distribution.
 *
 * Calls are strictly **sequential**. Firing 20 renders concurrently would measure our
 * own token-bucket rate limiter and the API's queue depth, not the endpoint — and the
 * resulting "p95" would be an artefact of the harness.
 *
 * ── Money ────────────────────────────────────────────────────────────────────
 * Same three guards as `run-bench.ts`, in the same order:
 *   a. dry run is the default — `npm run bench:cloth` with no args spends nothing
 *   b. `--yes` (or BENCH_CONFIRM=1) is the ONLY thing that enables spending
 *   c. `--max-units` (default 60) and a live balance check both gate the first call
 */
import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { renderCloth } from '../lib/youcam/features';
import { FEATURE_COST } from '../lib/youcam/features';
import { YouCamClient } from '../lib/youcam/client';
import { DRY_HOST, installFakeYouCam } from './fake-api';
import { displayPath } from './paths';
import { round, summarize, MEANINGFUL_N, type Summary } from './stats';

interface Args {
  help: boolean;
  dryRun: boolean;
  yes: boolean;
  n: number;
  maxUnits: number;
  body: string;
  garment: string;
  out?: string;
  verbose: boolean;
}

const USAGE = `
cloth-v3 latency distribution — the one stage cheap enough to sample properly.

  npm run bench:cloth                  zero-cost dry run (default), spends nothing
  npm run bench:cloth -- --yes         LIVE, ${MEANINGFUL_N} renders ≈ ${MEANINGFUL_N * FEATURE_COST['cloth-v3']} units
  npm run bench:cloth -- --help        this text

Options
  --dry-run              force the zero-cost path even if --yes is present
  --yes                  consent to spend units (or set BENCH_CONFIRM=1)
  --n <count>            renders to time (default ${MEANINGFUL_N} — below this a p95 is just the max)
  --max-units <n>        refuse a live run estimated above this (default 60)
  --body <file>          full-length standing photo (default scripts/fixtures/body_c.jpg)
  --garment <file>       garment reference (default public/refs/colorways/marigold.jpg)
  --out <file>           also write the result as JSON
  --verbose              print every sample as it lands

Note on --body: the default is the Phase-0 fixture the spike verified end to end. That
directory is GITIGNORED (throwaway stock images that never enter history), so a fresh
clone must pass its own --body: a head-to-toe standing shot, plain background, >=1024x768.
`;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    help: false,
    dryRun: false,
    yes: process.env.BENCH_CONFIRM === '1',
    n: MEANINGFUL_N,
    maxUnits: 60,
    body: join(process.cwd(), 'scripts', 'fixtures', 'body_c.jpg'),
    garment: join(process.cwd(), 'public', 'refs', 'colorways', 'marigold.jpg'),
    verbose: false,
  };

  const num = (raw: string | undefined, flag: string): number => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${flag} needs a positive number`);
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--yes':
        args.yes = true;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--n':
        args.n = Math.floor(num(next, flag));
        i++;
        break;
      case '--max-units':
        args.maxUnits = Math.floor(num(next, flag));
        i++;
        break;
      case '--body':
        if (!next) throw new Error('--body needs a file path');
        args.body = resolve(next);
        i++;
        break;
      case '--garment':
        if (!next) throw new Error('--garment needs a file path');
        args.garment = resolve(next);
        i++;
        break;
      case '--out':
        if (!next) throw new Error('--out needs a file path');
        args.out = resolve(next);
        i++;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }
  return args;
}

async function safeCredit(client: YouCamClient): Promise<number | null> {
  try {
    return await client.getCredit();
  } catch {
    return null;
  }
}

function fmtMs(ms: number): string {
  return `${round(ms, 0).toLocaleString('en-US')} ms`;
}

function renderSummary(s: Summary, samples: readonly number[]): string {
  const lines = [
    '',
    '  ── cloth-v3 latency ─────────────────────────────────────',
    `  n            ${s.n}`,
    `  min          ${fmtMs(s.min)}`,
    `  p50          ${fmtMs(s.p50)}`,
    `  p95          ${fmtMs(s.p95)}${s.meaningful ? '' : '  *'}`,
    `  max          ${fmtMs(s.max)}`,
    `  mean         ${fmtMs(s.mean)}`,
    '',
  ];
  if (!s.meaningful) {
    lines.push(
      `  * n < ${MEANINGFUL_N}: nearest-rank p95 is identical to the maximum here.`,
      '    That is not a p95. Reported anyway, labelled, never laundered.',
      '',
    );
  }
  lines.push(
    '  raw samples (ms, in call order — read them yourself):',
    `    ${samples.map((v) => round(v, 0)).join(', ')}`,
    '',
  );
  return lines.join('\n');
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`\n  ✗ ${(err as Error).message}`);
    console.error(USAGE);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const live = args.yes && !args.dryRun;
  const estimate = args.n * FEATURE_COST['cloth-v3'];

  console.log('\n  cloth-v3 latency probe');
  console.log(
    `  mode              ${live ? 'LIVE — spends real units' : 'dry run — spends nothing'}`,
  );
  console.log(`  renders           ${args.n}, sequential`);
  console.log(`  body              ${displayPath(args.body)}`);
  console.log(`  garment           ${displayPath(args.garment)}`);
  console.log(`  estimate          ${estimate} units`);

  if (live) {
    if (estimate > args.maxUnits) {
      console.error(
        `\n  ✗ estimate ${estimate} exceeds --max-units ${args.maxUnits}. Refusing.` +
          '\n    Lower --n, or raise --max-units deliberately.',
      );
      return 2;
    }
    const balance = await safeCredit(new YouCamClient());
    console.log(`  grant balance     ${balance ?? 'unreadable'} units`);
    if (balance != null && estimate > balance) {
      console.error(`\n  ✗ estimate ${estimate} exceeds the ${balance} units remaining.`);
      return 2;
    }
    console.log(
      `\n  ⚠ LIVE RUN CONFIRMED (--yes). About to spend up to ${estimate} real units.\n`,
    );
  }

  let bodyBytes: Buffer;
  let garmentBytes: Buffer;
  try {
    [bodyBytes, garmentBytes] = await Promise.all([readFile(args.body), readFile(args.garment)]);
  } catch (err) {
    console.error(`\n  ✗ could not read an input: ${(err as Error).message}`);
    if (!live)
      console.error('    (a dry run still needs real files — it fakes the API, not the disk)');
    return 2;
  }

  if (!live) {
    installFakeYouCam();
    process.env.YOUCAM_API_KEY = 'dry-run-placeholder-never-transmitted';
    process.env.YOUCAM_BASE_HOST = DRY_HOST;
  }

  const client = new YouCamClient({
    pollIntervalMs: live ? 1500 : 25,
    pollTimeoutMs: live ? 180_000 : 15_000,
  });

  const before = await safeCredit(client);

  // Uploads are free and happen ONCE — only the renders are timed and billed.
  const bodyId = await client.uploadFile(bodyBytes, 'image/jpeg', 'body.jpg');
  const garmentId = await client.uploadFile(garmentBytes, 'image/jpeg', 'garment.jpg');

  const samples: number[] = [];
  const failures: string[] = [];
  for (let i = 0; i < args.n; i++) {
    const t0 = performance.now();
    try {
      await renderCloth(client, { bodyFileId: bodyId, dressFileId: garmentId });
      const ms = performance.now() - t0;
      samples.push(ms);
      if (args.verbose || live) {
        console.log(`    ${String(i + 1).padStart(2)} / ${args.n}   ${fmtMs(ms)}`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      failures.push(`#${i + 1}: ${msg}`);
      console.log(`    ${String(i + 1).padStart(2)} / ${args.n}   FAILED — ${msg}`);
    }
  }

  const after = await safeCredit(client);
  const spent = before != null && after != null ? before - after : null;

  if (samples.length === 0) {
    console.error('\n  ✗ every render failed — nothing to summarise.');
    failures.forEach((f) => console.error(`    ${f}`));
    return 1;
  }

  const summary = summarize(samples);
  console.log(renderSummary(summary, samples));

  console.log(`  succeeded         ${samples.length} / ${args.n}`);
  if (failures.length > 0) {
    console.log(`  failed            ${failures.length}`);
    failures.forEach((f) => console.log(`    ${f}`));
  }
  console.log(
    `  units spent       ${spent ?? 'unreadable'}${spent != null ? ` (measured balance delta: ${before} → ${after})` : ''}`,
  );
  console.log(`  estimate was      ${estimate}`);
  console.log('');

  if (args.out) {
    const payload = {
      measured: live ? 'live' : 'dry-run — numbers are invented',
      n: args.n,
      succeeded: samples.length,
      failed: failures,
      latencyMs: { ...summary, samples: samples.map((v) => round(v, 0)) },
      units: { estimate, spent, balanceBefore: before, balanceAfter: after },
      inputs: { body: displayPath(args.body), garment: displayPath(args.garment) },
      host: process.platform,
    };
    await writeFile(args.out, JSON.stringify(payload, null, 2));
    console.log(`  wrote             ${displayPath(args.out)}\n`);
  }

  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
