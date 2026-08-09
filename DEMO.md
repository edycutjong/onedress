# OneDress — Demo & Benchmarks

OneDress measures every bridesmaid's **real skin hex** and Fitzpatrick depth with the YouCam
Skin AI endpoints, then solves for the single dress colour whose *least-flattered* person is
lifted the most — max-of-minimum fairness, not the average. It renders that winning colour
photorealistically on each person with `cloth-v3`, chains a matching earring onto the render
with `2d-vto/earring`, and shows the **counterfactual**: the same person in the colour a
human would have picked by eye, so you can see who that choice would have cost. Everything
below is printed by a command in this repo — including the parts that are still missing.

---

## Reproduce

### 1. Zero cost — no API key, no units, nothing to sign up for

```bash
npm install
npm run bench      # full benchmark report, dry run, 0 units, ~5 s
npm run test       # 77 unit tests
npm run ci         # format + lint + typecheck + tests at 100% coverage
```

`npm run bench` **defaults to a dry run and spends nothing.** The dry run is not a stub: it
installs a fake transport at the `fetch` layer, so the real `YouCamClient` (rate limiter,
retry/backoff, Zod validation, create → poll loop), the real feature wrappers and the real
`runParty` orchestrator all execute, over synthetic images. It exercises the code path and
demonstrates the report format; the numbers it prints are invented and it says so at the top.

> Note on `npm run bench --dry-run`: npm treats `--dry-run` as its own config and never
> forwards it to the script, so that flag cannot be what selects the safe mode. **The absence
> of `--yes` is.** `npm run bench -- --dry-run` also works and forces it explicitly.

### 2. Live — real calls, real money

Units are real and finite. One subject costs **43 units** (skin-tone 20 + fitzpatrick 10 +
face-attr 10 + cloth-v3 2 + earring 1). The harness prints the estimate and refuses to spend
without explicit consent:

```bash
export YOUCAM_API_KEY=sk-...          # or ~/.config/youcam/credentials.env
npm run bench -- --yes                # 1 subject,  ~43 units
npm run bench -- --yes --subjects 2   # 2 subjects, ~88 units
npm run bench -- --help               # every flag
```

Three guards stand between a careless invocation and the grant: `--yes` (or
`BENCH_CONFIRM=1`) is required, `--max-units` (default 150) refuses an oversized run, and the
live balance is checked before the first billable call. Reference garments and subject photos
are both resolved *before* anything is spent, so a run that would die at the render stage is
refused rather than half-paid-for.

---

## Results

### Live run — N = 1 subject, 2026-08-09

**Cost of this run: 43 units** (grant 898 → 855), which matches the a-priori estimate exactly.

| Metric | Measured |
|---|---|
| Total HTTP requests, 1 subject end-to-end | **47** |
| — file uploads (init + presigned PUT) | 5 + 5 |
| — task creations | 5 |
| — task polls | **26** |
| — credit reads / result downloads | 4 / 2 |
| Units spent (measured credit delta) | **43** |
| Wall-clock, full run | **33.4 s** |
| `skin-tone-analysis` | 5 741 ms |
| `fitzpatrick-scale-analyzer` | 7 648 ms |
| `face-attr-analysis` | 9 627 ms |
| `cloth-v3` | 12 953 ms |
| `2d-vto/earring` | 4 489 ms |
| File upload (p50 of 5) | 1 008 ms |
| Render fidelity ΔE00, 9 patches | **min 5.48 · median 7.76 · max 11.22** |

**Caveats, stated up front.** N = 1, so there is no p95 here — with one sample the "p95" is
the maximum, and the harness prints it with a `*` and the raw sample list rather than dressing
it up. Latency is wall-clock from an Apple M1 Max on a residential connection, and *includes*
this client's own ≤5 QPS rate limiter and 1 500 ms poll interval — it is not YouCam server
processing time. The poll counts are the useful part of the latency story: `cloth-v3` needed
**8** polls to finish while `2d-vto/earring` needed 3, which is why the render stage dominates.

#### Verbatim output

```text
──────────────────────────────────────────────────────────────────────────────
OneDress benchmark — LIVE
──────────────────────────────────────────────────────────────────────────────
LIVE RUN — real calls against the YouCam API. Every number below is measured.

  started    2026-08-09T08:34:31.798Z
  finished   2026-08-09T08:35:07.021Z
  subjects   1 per run × 1 run(s)
  earrings   enabled
  subjects ← disk — scripts/fixtures
  refs     ← single garment photo — scripts/fixtures/reddress_a.jpg · earring scripts/fixtures/earring_c.jpg
  host       darwin arm64 · node v22.22.0 · Apple M1 Max

── 1. Call counts — exact, split by kind ─────────────────────────────────────
  file upload — init   (POST /s2s/v2.0/file)                 5
  file upload — bytes  (PUT presigned URL)                   5
  task create          (POST /s2s/v2.0/task/…)               5
  task poll            (GET  /s2s/v2.0/task/…/{id})         26
  credit balance       (GET  /s2s/v1.0/client/credit)        4
  result download      (GET  presigned result URL)           2
                                                        ──────
  TOTAL HTTP requests                                       47

  per endpoint                         creates     polls
  2d-vto/earring                             1         3
  cloth-v3                                   1         8
  face-attr-analysis                         1         6
  fitzpatrick-scale-analyzer                 1         5
  skin-tone-analysis                         1         4

── 2. Per-stage latency (task create → success) ──────────────────────────────
  stage                        n    p50 ms    p95 ms      min      max
  file-upload                  5      1008     1222*      878     1222
                            raw [890, 1038, 1222, 878, 1008]
  skin-tone-analysis           1      5741     5741*     5741     5741
                            raw [5741]
  fitzpatrick-scale-analyzer   1      7648     7648*     7648     7648
                            raw [7648]
  face-attr-analysis           1      9627     9627*     9627     9627
                            raw [9627]
  cloth-v3                     1     12953    12953*    12953    12953
                            raw [12953]
  2d-vto/earring               1      4489     4489*     4489     4489
                            raw [4489]
  TOTAL wall-clock / run       1     33363    33363*    33363    33363
                            raw [33363]

  * n < 20: nearest-rank p95 over this few samples IS the maximum. Read the raw
    list, not the percentile. These are latency observations, not a latency SLO.

── 3. Units — measured from the credit endpoint, not summed ──────────────────
  a-priori estimate (FEATURE_COST, worst case)          43
  balance before (GET /s2s/v1.0/client/credit)         898
  balance after  (GET /s2s/v1.0/client/credit)         855
                                                    ──────
  MEASURED units spent (before − after)                 43
  per subject per run                                   43
  per-run deltas: [43]

── 4. Render fidelity ΔE00 (CIEDE2000) — distribution ────────────────────────
  basis:   rendered garment patch vs hex sampled from the reference garment photo
  window:  l0.42 t0.45 w0.16 h0.14   grid: 3×3 = 9 patches per render
  pool:    1 render(s) × 9 patches = 9 samples

  ΔE00              min   median      max     mean
                   5.48     7.76    11.22     7.85

  per render          colorway              intended     median     min     max
  Subject A           Wine                  #ae011c        7.76    5.48   11.22
                      sampled hexes: #d0061f #d40b25 #e10f37 #cb071c #d30c27 #dd0f32 #c8091c #c80b23 #d61131

  ⚠ one render only: this spread is WITHIN-render variation. Between-render
    variation needs N ≥ 2 and is the larger term. Raise --subjects to see it.

  ⚠ the garments used are NOT the shipped reference set (public/refs):
      single garment photo — scripts/fixtures/reddress_a.jpg · earring scripts/fixtures/earring_c.jpg
    The number above is a real measurement of colour transfer for THAT reference;
    it is not yet a claim about the 24 shipped colorways.

── 5. Run outcomes ───────────────────────────────────────────────────────────
  run 1: measured 1/1 · rendered 1/1 · earrings 1/1 · winner Wine (min 78.76) · 43 units

── Notes ─────────────────────────────────────────────────────────────────────
  · --garment: one photo (scripts/fixtures/reddress_a.jpg) stands in for every colorway, so the render is a real cloth-v3 render but NOT of the winning colour
  · latency is wall-clock from this machine and includes the client-side rate limiter (≤5 QPS) and 1500ms poll interval — it is not server processing time
  · the credit endpoint is read before and after the whole bench; the measured delta is authoritative, FEATURE_COST is only the a-priori estimate

──────────────────────────────────────────────────────────────────────────────
```

Reproduce this exact invocation:

```bash
npm run bench -- --yes --subjects 1 \
  --garment scripts/fixtures/reddress_a.jpg \
  --earring-ref scripts/fixtures/earring_c.jpg
```

---

## What is still missing

Honest gaps beat a full-looking table.

| Claim | Status |
|---|---|
| Call counts, unit cost, per-stage latency (N=1) | ✅ measured live, above |
| Real `p50 / p95` | **PENDING — needs n ≥ 20 samples per stage.** Run `npm run bench -- --yes --runs 20` (≈ 860 units). At N=1 the printed p95 is the maximum and is flagged `*`. |
| ΔE00 against the **24 shipped colorways** | **PENDING — `npm run bench -- --yes`** once `public/refs/colorways/*.jpg` exists. The reference garments are generated separately and are not in the repo yet. |
| Between-render ΔE variation | **PENDING — needs `--subjects 2` or more** (≈ 88 units). The 5.48–11.22 spread above is variation *within* one render. |

The ΔE00 above is measured against the colour sampled from the reference garment photo
(`--intended ref`), which is the same basis the Phase-0 spike used for its single sample —
so it is directly comparable. Once `public/refs/` is installed, drop the `--garment` flag and
the harness switches to `--intended catalogue` automatically and compares against the
published colorway hex instead.

### What this supersedes

The single-sample **ΔE00 ≈ 7.7** from `npm run spike` is one pixel of one render. It turns out
to sit almost exactly on the median (7.76) — but the real distribution runs **5.48 to 11.22**
across nine patches of that same render, and the honest way to state render fidelity is the
range, not the point. Use the distribution.

---

## Zero-cost report format

What `npm run bench` prints with no key and no reference images installed — same code path,
synthetic data, 0 units:

```text
OneDress benchmark — preflight
  mode              dry run (zero cost)
  subjects × runs   1 × 1
  earring pass      enabled
  ESTIMATED COST    43 units (worst case, from FEATURE_COST)
  reference garments generated stand-ins (no reference set installed)
  ΔE intended hex   sampled from the reference photo
  subject photos    disk — scripts/fixtures

  DRY RUN — nothing will be spent. A live run of this shape is estimated at
  43 units. To actually spend them:  npm run bench -- --yes
  (npm swallows a bare --dry-run, which is why zero-cost is the default.)
──────────────────────────────────────────────────────────────────────────────
OneDress benchmark — DRY-RUN
──────────────────────────────────────────────────────────────────────────────
DRY RUN — fake transport, synthetic images, ZERO units spent. Numbers below are
NOT measurements of the YouCam API. They demonstrate the report format and prove
the code path. Run `npm run bench -- --yes` for real numbers.

── 1. Call counts — exact, split by kind ─────────────────────────────────────
  file upload — init   (POST /s2s/v2.0/file)                 5
  file upload — bytes  (PUT presigned URL)                   5
  task create          (POST /s2s/v2.0/task/…)               5
  task poll            (GET  /s2s/v2.0/task/…/{id})         10
  credit balance       (GET  /s2s/v1.0/client/credit)        4
  result download      (GET  presigned result URL)           2
                                                        ──────
  TOTAL HTTP requests                                       31
```

The dry run's call counts differ from live in exactly one place — **poll count**, 10 vs 26 —
because the fake settles every task on its second poll while the real API takes as long as it
takes. Uploads, task creations, credit reads and downloads match one-for-one.

---

## How the harness works

| File | Role |
|---|---|
| `bench/run-bench.ts` | CLI, spending gates, orchestration, report assembly |
| `bench/instrument.ts` | fetch tap (exact call counts by kind) + `TaskRunner` timing wrapper |
| `bench/fake-api.ts` | dry-run transport — fake YouCam at the `fetch` layer |
| `bench/fidelity.ts` | ΔE00 patch-grid sampling |
| `bench/refs.ts` | reference-garment resolution: disk / single photo / generated |
| `bench/subjects.ts` | subject photo pairs |
| `bench/stats.ts` | nearest-rank percentiles, never interpolated |
| `bench/report.ts` | formatting only — cannot change a number |

Two measurement layers, deliberately not blended. The **fetch tap** counts HTTP requests,
which is the only honest way to count polls (`pollTask` loops internally, so from outside the
client one task looks like one call). The **runner wrapper** times one logical operation —
create + poll-to-success — which is the user-visible latency of an endpoint. Reporting either
as the other is the mistake this split exists to prevent.

All HTTP goes through `lib/youcam/client.ts` and all orchestration through
`lib/pipeline/run-party.ts`; the bench adds measurement and nothing else. The API key is read
by `lib/youcam/env.ts` from the environment or `~/.config/youcam/credentials.env`, and is
never printed, logged, or written into this repo. In dry-run mode the client is handed an
obvious placeholder and the host is pinned to an unroutable `.invalid` domain, so no real
credential is loaded and no request can escape.
