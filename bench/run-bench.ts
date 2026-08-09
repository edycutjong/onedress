/**
 * OneDress benchmark harness — `npm run bench`.
 *
 * Publishes four things nobody has to take on trust:
 *   1. exact HTTP call counts, split into uploads / task creations / task polls
 *   2. per-endpoint latency (p50, p95) with the raw sample list beside it
 *   3. total unit cost, as a MEASURED delta of the live credit balance
 *   4. render-fidelity ΔE00 as a distribution over every patch of every render
 *
 * ── Money ────────────────────────────────────────────────────────────────────
 * Units are real and finite. Three rules enforce that, in this order:
 *
 *   a. **Dry run is the default.** `npm run bench` with no arguments spends nothing.
 *      (This is also load-bearing for the documented invocation: npm swallows
 *      `--dry-run` as its own config and never forwards it to the script, so the
 *      flag CANNOT be what selects the safe mode — the absence of `--yes` is.)
 *   b. **Explicit consent to spend.** Only `--yes` (or `BENCH_CONFIRM=1`) enables a
 *      live run, and the estimate is printed before the gate, not after.
 *   c. **Two hard ceilings.** `--max-units` (default 150) refuses an oversized run,
 *      and the live balance is checked before the first billable call.
 *
 * Defaults are deliberately tiny — one subject, one run, ~43 units — because the
 * grant is nearly exhausted and a careless invocation must never be able to drain it.
 *
 * ── What is reused ───────────────────────────────────────────────────────────
 * All HTTP goes through `lib/youcam/client.ts` and all orchestration through
 * `lib/pipeline/run-party.ts`; the bench adds only measurement. Even the dry run
 * exercises the real client — the fake is installed at the `fetch` layer, not in
 * place of the client (see `bench/fake-api.ts`).
 */
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { COLORWAYS } from '../lib/colorway/data';
import { fetchRender } from '../lib/pipeline/head-crop';
import { runParty, runSummary } from '../lib/pipeline/run-party';
import type { BridesmaidInput, PartyRun, RunEvent } from '../lib/pipeline/types';
import { YouCamClient } from '../lib/youcam/client';
import { estimateUnits, FEATURE_COST } from '../lib/youcam/features';
import { DRY_HOST, installFakeYouCam } from './fake-api';
import {
  GARMENT_WINDOW,
  GRID,
  referenceHex,
  samplePatches,
  type IntendedBasis,
  type RenderFidelity,
  type Window,
} from './fidelity';
import { installFetchTap, instrumentRunner, type OpTiming } from './instrument';
import {
  diskRefSource,
  probeRefs,
  singleGarmentSource,
  syntheticRefSource,
  uploadingRefs,
  type RefSource,
} from './refs';
import { displayPath } from './paths';
import { renderReport, type BenchReport, type LatencyRow } from './report';
import { loadSubjects, MissingSubjectsError } from './subjects';

interface Args {
  help: boolean;
  dryRun: boolean;
  yes: boolean;
  subjects: number;
  runs: number;
  refs: string;
  synthRefs: boolean;
  garment?: string;
  earringRef?: string;
  /** undefined = auto: 'catalogue' for the shipped reference set, 'ref' for stand-ins */
  intended?: IntendedBasis;
  fixtures: string;
  maxUnits: number;
  noEarring: boolean;
  out?: string;
  verbose: boolean;
  window: Window;
  grid: number;
}

const USAGE = `
OneDress benchmark — measures the real pipeline against the YouCam API.

  npm run bench                     zero-cost dry run (default) — prints the full report
  npm run bench -- --yes            LIVE run, spends units (1 subject ≈ 43 units)
  npm run bench -- --help           this text

Options
  --dry-run              force the zero-cost path even if --yes is present
  --yes                  consent to spend units (or set BENCH_CONFIRM=1)
  --subjects <n>         subjects per run (default 1, max 4)
  --runs <n>             repeat the whole run (default 1)
  --refs <dir>           reference-garment root (default public/refs)
  --synth-refs           use generated stand-in garments instead of a refs dir
  --garment <file>       use ONE real garment photo for every colorway (implies
                         --intended ref, since the photo is not the winning colour)
  --earring-ref <file>   earring reference photo (default: generated)
  --intended ref|catalogue   what ΔE is measured against (default: auto)
  --fixtures <dir>       subject photo dir (default scripts/fixtures)
  --no-earring           skip the earring pass (isolates cloth-v3 timings)
  --max-units <n>        refuse a live run estimated above this (default 150)
  --grid <n>             ΔE patches per axis (default 3 → 9 per render)
  --garment-window l,t,w,h   fractional sampling window (default 0.42,0.45,0.16,0.14)
  --out <file>           also write the report as JSON
  --verbose              stream every stage transition
`;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    help: false,
    dryRun: false,
    yes: process.env.BENCH_CONFIRM === '1',
    subjects: 1,
    runs: 1,
    refs: join(process.cwd(), 'public', 'refs'),
    synthRefs: false,
    fixtures: join(process.cwd(), 'scripts', 'fixtures'),
    maxUnits: 150,
    noEarring: false,
    verbose: false,
    window: { ...GARMENT_WINDOW },
    grid: GRID,
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
      case '--subjects':
        args.subjects = Math.floor(num(next, flag));
        i++;
        break;
      case '--runs':
        args.runs = Math.floor(num(next, flag));
        i++;
        break;
      case '--refs':
        args.refs = resolve(next ?? '');
        i++;
        break;
      case '--synth-refs':
        args.synthRefs = true;
        break;
      case '--garment':
        args.garment = resolve(next ?? '');
        i++;
        break;
      case '--earring-ref':
        args.earringRef = resolve(next ?? '');
        i++;
        break;
      case '--intended':
        if (next !== 'ref' && next !== 'catalogue') {
          throw new Error("--intended expects 'ref' or 'catalogue'");
        }
        args.intended = next;
        i++;
        break;
      case '--fixtures':
        args.fixtures = resolve(next ?? '');
        i++;
        break;
      case '--max-units':
        args.maxUnits = Math.floor(num(next, flag));
        i++;
        break;
      case '--no-earring':
        args.noEarring = true;
        break;
      case '--grid':
        args.grid = Math.floor(num(next, flag));
        i++;
        break;
      case '--garment-window': {
        const parts = (next ?? '').split(',').map(Number);
        if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) {
          throw new Error(
            '--garment-window expects l,t,w,h as fractions, e.g. 0.42,0.45,0.16,0.14',
          );
        }
        args.window = { left: parts[0], top: parts[1], width: parts[2], height: parts[3] };
        i++;
        break;
      }
      case '--out':
        args.out = resolve(next ?? '');
        i++;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      default:
        throw new Error(`unknown flag: ${flag}\n${USAGE}`);
    }
  }
  return args;
}

/** Worst-case a-priori cost. The measured credit delta is what actually gets published. */
function estimateCost(args: Args): number {
  const perRun =
    estimateUnits(args.subjects, { counterfactual: args.subjects > 1 }) -
    (args.noEarring ? args.subjects * FEATURE_COST['2d-vto/earring'] : 0);
  return perRun * args.runs;
}

/** Credit is free to read, but an unreadable balance must never abort a run. */
async function safeCredit(client: YouCamClient): Promise<number | undefined> {
  try {
    return await client.getCredit();
  } catch {
    return undefined;
  }
}

function latencyRows(timings: readonly OpTiming[]): LatencyRow[] {
  const order = [
    'file-upload',
    'skin-tone-analysis',
    'fitzpatrick-scale-analyzer',
    'face-attr-analysis',
    'cloth-v3',
    '2d-vto/earring',
  ];
  const seen = [...new Set(timings.map((t) => t.label))];
  const labels = [
    ...order.filter((l) => seen.includes(l)),
    ...seen.filter((l) => !order.includes(l)),
  ];
  return labels.map((label) => {
    const rows = timings.filter((t) => t.label === label);
    return {
      label,
      samples: rows.map((t) => t.ms),
      failures: rows.filter((t) => !t.ok).length,
    };
  });
}

/** Every completed render in the run, plus the counterfactual, with its intended hex. */
function renderTargets(
  run: PartyRun,
): { subjectId: string; subjectName?: string; url: string; colorwayId: string }[] {
  const targets = run.bridesmaids
    .filter((b) => b.render.status === 'done' && b.render.result)
    .map((b) => ({
      subjectId: b.id,
      subjectName: b.name,
      url: b.render.result!.url,
      colorwayId: b.render.result!.colorwayId,
    }));
  const cf = run.counterfactual;
  if (cf?.render.status === 'done' && cf.render.result) {
    targets.push({
      subjectId: `${cf.bridesmaidId} (counterfactual)`,
      subjectName: `${cf.bridesmaidName ?? cf.bridesmaidId} · by-eye`,
      url: cf.render.result.url,
      colorwayId: cf.render.result.colorwayId,
    });
  }
  return targets;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const live = args.yes && !args.dryRun;
  const estimate = estimateCost(args);
  const notes: string[] = [];

  // ---------------------------------------------------------------- preflight --
  console.log('\nOneDress benchmark — preflight');
  console.log(`  mode              ${live ? 'LIVE (spends units)' : 'dry run (zero cost)'}`);
  console.log(`  subjects × runs   ${args.subjects} × ${args.runs}`);
  console.log(`  earring pass      ${args.noEarring ? 'skipped' : 'enabled'}`);
  console.log(`  ESTIMATED COST    ${estimate} units (worst case, from FEATURE_COST)`);

  // Reference garments: resolve BEFORE spending anything. Discovering that
  // public/refs is empty after paying 40 units for the analyzers is the exact
  // failure this check exists to prevent.
  // Resolution ladder, most authentic first: an explicit single garment photo, the
  // installed reference set, generated stand-ins.
  const probe = await probeRefs(args.refs);
  const explicitStandIn = args.synthRefs || args.garment != null;
  let refSource: RefSource = args.garment
    ? singleGarmentSource(args.garment, args.earringRef)
    : args.synthRefs
      ? syntheticRefSource()
      : diskRefSource(args.refs);
  if (!explicitStandIn && !probe.present) {
    if (live) {
      console.error(
        `\n  ✗ reference garments not found at ${displayPath(args.refs)}` +
          '\n    Expected <refs>/colorways/<colorway-id>.jpg and <refs>/earrings/<sil>-<metal>.jpg.' +
          '\n    They are generated separately and are not in the repo yet.' +
          '\n    Options:' +
          '\n      --refs <dir>       point at an installed reference set' +
          '\n      --garment <file>   use one real garment photo for every colorway (best' +
          '\n                         approximation of the live render path)' +
          '\n      --synth-refs       generated stand-ins (call counts, latency and cost stay' +
          '\n                         valid; ΔE stops describing the shipped garments)' +
          '\n    Refusing to spend units on a run that would fail at the render stage.',
      );
      return 2;
    }
    refSource = syntheticRefSource();
    notes.push(
      `no reference set at ${displayPath(args.refs)} — dry run fell back to generated stand-in garments`,
    );
  } else if (!explicitStandIn && probe.colorwaysFound < COLORWAYS.length) {
    notes.push(
      `reference set incomplete: ${probe.colorwaysFound}/${COLORWAYS.length} colorways installed ` +
        '— the run fails at render if the winner is one of the missing ones',
    );
  }
  if (args.synthRefs) {
    notes.push('--synth-refs: garments are generated stand-ins, NOT the shipped reference set');
  }
  if (args.garment) {
    notes.push(
      `--garment: one photo (${displayPath(args.garment)}) stands in for every colorway, so the render is ` +
        'a real cloth-v3 render but NOT of the winning colour',
    );
  }

  // What ΔE is measured against. Auto-select rather than silently comparing a
  // stand-in garment to a catalogue hex it was never meant to be.
  const basis: IntendedBasis = args.intended ?? (refSource.authentic ? 'catalogue' : 'ref');
  console.log(`  reference garments ${refSource.describe()}`);
  console.log(
    `  ΔE intended hex   ${basis === 'catalogue' ? 'catalogue colorway hex' : 'sampled from the reference photo'}`,
  );
  if (basis === 'catalogue' && !refSource.authentic) {
    notes.push(
      '--intended catalogue was forced against stand-in garments: the ΔE below includes the ' +
        'difference between the stand-in and the catalogue colour, and overstates render error',
    );
  }

  // Subject photos.
  let subjectSet;
  try {
    subjectSet = await loadSubjects(args.subjects, args.fixtures, !live);
  } catch (err) {
    if (err instanceof MissingSubjectsError) {
      console.error(`\n  ✗ ${err.message}`);
      return 2;
    }
    throw err;
  }
  console.log(`  subject photos    ${subjectSet.describe}`);
  if (subjectSet.synthetic) {
    notes.push('subject photos are generated stand-ins — analyzer outputs are invented');
  }

  // ------------------------------------------------------------ spending gate --
  if (!live) {
    console.log(
      `\n  DRY RUN — nothing will be spent. A live run of this shape is estimated at\n` +
        `  ${estimate} units. To actually spend them:  npm run bench -- --yes\n` +
        '  (npm swallows a bare --dry-run, which is why zero-cost is the default.)',
    );
  } else {
    if (estimate > args.maxUnits) {
      console.error(
        `\n  ✗ estimate ${estimate} exceeds --max-units ${args.maxUnits}. Refusing.` +
          '\n    Lower --subjects/--runs, or raise --max-units deliberately.',
      );
      return 2;
    }
    const gateBalance = await safeCredit(new YouCamClient());
    console.log(`  grant balance     ${gateBalance ?? 'unreadable'} units`);
    if (gateBalance != null && estimate > gateBalance) {
      console.error(`\n  ✗ estimate ${estimate} exceeds the ${gateBalance} units remaining.`);
      return 2;
    }
    console.log(
      `\n  ⚠ LIVE RUN CONFIRMED (--yes). About to spend up to ${estimate} real units.\n`,
    );
  }

  // ------------------------------------------------------------- instrument ----
  // Order matters: the fake transport goes in first so the tap wraps it and counts
  // exactly the requests a live run would have made.
  const fake = live ? undefined : installFakeYouCam({ startingBalance: 1000 });
  const tap = installFetchTap();
  const startedAt = new Date().toISOString();

  const timings: OpTiming[] = [];
  const totalWallClockMs: number[] = [];
  const outcomes: string[] = [];
  const fidelityRenders: RenderFidelity[] = [];
  const perRunUnits: (number | undefined)[] = [];
  let benchBefore: number | undefined;
  let benchAfter: number | undefined;

  try {
    if (!live) {
      // The client refuses to construct without a key. In dry run we hand it an
      // obvious placeholder and pin the host to the unroutable fake, so no real
      // credential is ever loaded and no request could escape even if the fake missed one.
      process.env.YOUCAM_API_KEY = 'dry-run-placeholder-never-transmitted';
      process.env.YOUCAM_BASE_HOST = DRY_HOST;
    }
    const client = new YouCamClient({
      pollIntervalMs: live ? 1500 : 25,
      pollTimeoutMs: live ? 180_000 : 15_000,
    });

    benchBefore = await safeCredit(client);

    for (let runIndex = 0; runIndex < args.runs; runIndex++) {
      const instrumented = instrumentRunner(client);
      const refs = uploadingRefs(instrumented.runner, refSource);
      const started = performance.now();

      // Subject photos are uploaded through the instrumented runner too — they are
      // real File API round trips and belong in the call count.
      const inputs: BridesmaidInput[] = [];
      for (const subject of subjectSet.subjects) {
        const faceFileId = await instrumented.runner.uploadFile(
          subject.faceBytes,
          'image/jpeg',
          `face-${subject.id}.jpg`,
        );
        const bodyFileId = await instrumented.runner.uploadFile(
          subject.bodyBytes,
          'image/jpeg',
          `body-${subject.id}.jpg`,
        );
        inputs.push({ id: subject.id, name: subject.name, faceFileId, bodyFileId });
      }

      const run = await runParty(inputs, {
        api: instrumented.runner,
        refs,
        skipEarring: args.noEarring,
        emit: args.verbose
          ? (_run: PartyRun, event: RunEvent) =>
              console.log(
                `    · ${event.path} ${event.status}${event.message ? ` — ${event.message}` : ''}`,
              )
          : undefined,
      });

      totalWallClockMs.push(performance.now() - started);
      timings.push(...instrumented.timings);
      perRunUnits.push(run.units.spent);
      outcomes.push(`run ${runIndex + 1}: ${runSummary(run)}`);

      // Fidelity: download each completed render and sample the garment region.
      // The intended hex is either the catalogue value or the colour actually present
      // in the reference photo — re-read here, which costs no API call.
      for (const target of renderTargets(run)) {
        const colorway = COLORWAYS.find((c) => c.id === target.colorwayId);
        if (!colorway) continue;
        try {
          const intendedHex =
            basis === 'catalogue'
              ? colorway.hex
              : await referenceHex(await refSource.colorway(colorway.id));
          const bytes = await fetchRender(target.url);
          fidelityRenders.push({
            subjectId: target.subjectId,
            subjectName: target.subjectName,
            colorwayId: colorway.id,
            colorwayName: colorway.name,
            intendedHex,
            basis:
              basis === 'catalogue'
                ? 'catalogue colorway hex'
                : 'hex sampled from the reference garment photo',
            patches: await samplePatches(bytes, intendedHex, args.window, args.grid),
          });
        } catch (err) {
          notes.push(`could not sample render for ${target.subjectId}: ${String(err)}`);
        }
      }
    }

    benchAfter = await safeCredit(client);
  } finally {
    // Restore in reverse install order, always — a thrown run must not leave a
    // patched global fetch behind for anything else in the process.
    tap.restore();
    fake?.restore();
  }

  // ---------------------------------------------------------------- report ----
  notes.push(
    'latency is wall-clock from this machine and includes the client-side rate limiter ' +
      `(≤5 QPS) and ${live ? '1500' : '25'}ms poll interval — it is not server processing time`,
  );
  notes.push(
    'the credit endpoint is read before and after the whole bench; the measured delta is ' +
      'authoritative, FEATURE_COST is only the a-priori estimate',
  );
  if (!live) {
    notes.push('DRY RUN: every value above is synthetic. Nothing here measures the YouCam API.');
  }

  const report: BenchReport = {
    mode: live ? 'live' : 'dry-run',
    startedAt,
    finishedAt: new Date().toISOString(),
    subjects: args.subjects,
    runs: args.runs,
    earringEnabled: !args.noEarring,
    refsSource: refSource.describe(),
    refsAuthentic: refSource.authentic,
    subjectsSource: subjectSet.describe,
    host: `${os.platform()} ${os.arch()} · node ${process.version} · ${os.cpus()[0]?.model ?? 'unknown cpu'}`,
    calls: tap.calls,
    latency: latencyRows(timings),
    totalWallClockMs,
    units: {
      estimate,
      before: benchBefore,
      after: benchAfter,
      spent: benchBefore != null && benchAfter != null ? benchBefore - benchAfter : undefined,
      perRun: perRunUnits,
    },
    fidelity: { window: args.window, grid: args.grid, renders: fidelityRenders },
    outcomes,
    notes,
  };

  console.log(renderReport(report));

  if (args.out) {
    await writeFile(args.out, JSON.stringify(report, null, 2));
    console.log(`\n  JSON report written to ${args.out}`);
  }

  // Non-zero when the run produced no render at all: there is nothing to publish.
  return fidelityRenders.length > 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error('\nBENCH FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
