<div align="center">
  <img src="docs/icon-animated.svg" alt="OneDress Icon" width="144">
  <h1>OneDress 💍</h1>
  <p><em>Six bridesmaids, six skin tones, one dress color — provably no one's worst option.</em></p>
  <img src="docs/readme-hero-animated.svg" alt="OneDress Readme Hero" width="100%">

  <br/><br/>

  [![Live Demo](https://img.shields.io/badge/🚀_Live-Demo-06b6d4?style=for-the-badge)](https://onedress.edycu.dev)
  [![Demo Video](https://img.shields.io/badge/🎬_Demo-Video-ef4444?style=for-the-badge)](https://youtu.be/PLACEHOLDER)
  [![Pitch Deck](https://img.shields.io/badge/📊_Pitch-Deck-f59e0b?style=for-the-badge)](https://onedress.edycu.dev/pitch)
  [![Devpost](https://img.shields.io/badge/Devpost-YouCam_API_Hackathon-8b5cf6?style=for-the-badge)](https://youcam-api.devpost.com/)

  <br/>

  ![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat&logo=next.js)
  ![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
  ![Tailwind](https://img.shields.io/badge/Tailwind-38B2AC?style=flat&logo=tailwindcss&logoColor=white)
  ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat&logo=zod&logoColor=white)
  ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)
  ![YouCam API](https://img.shields.io/badge/YouCam_API-Perfect_Corp-8b5cf6?style=flat)
  [![CI](https://github.com/edycutjong/onedress/actions/workflows/ci.yml/badge.svg)](https://github.com/edycutjong/onedress/actions/workflows/ci.yml)
  [![Release](https://img.shields.io/badge/release-v1.0.0-8b5cf6?style=flat)](https://github.com/edycutjong/onedress/releases)
  ![Tests](https://img.shields.io/badge/tests-77_passing-22C55E?style=flat)
  ![Coverage](https://img.shields.io/badge/coverage-100%25-22C55E?style=flat)
  ![License](https://img.shields.io/badge/license-MIT-blue?style=flat)

</div>

---

## 💡 The Problem & Solution

Bridesmaid dresses are one color for the whole party — usually final-sale — and the
color that flatters the bride can drain every other complexion in the photos. The
color is chosen today by eyeballing one retailer model who matches nobody in the party.

**OneDress** measures each bridesmaid's **real skin hex** and **Fitzpatrick depth**, then
solves a constrained group-optimization problem: find the single dress color where the
**least-flattered person is lifted the most** (max-of-minimum fairness), and render it
photorealistically on every bridesmaid at once.

It's the inverse of a personal-color quiz: not "what's *my* season?" but **"given one
garment all N people must wear, which single color harms the group least?"** — a question
single-user analysis can't answer, because the group's answer is never any individual's
top pick.

## 🔬 Verified live against the YouCam API (Perfect Corp)

The sponsor SDK is the **engine**, not decoration. All five load-bearing endpoints are
proven end-to-end by a live spike (`scripts/spike.ts`, `npm run spike`):

| # | Endpoint | Role | Verified result |
|---|---|---|---|
| 1 | `skin-tone-analysis` | measured skin hex — the scoring input | e.g. `#bb9982` → ITA° 43, hue° 61 |
| 2 | `fitzpatrick-scale-analyzer` | Type I–VI depth cross-check | e.g. `Type II` |
| 3 | `face-attr-analysis` | `faceShape` → earring silhouette | e.g. `Heart` |
| 4 | `cloth-v3` | render the winning color on each bridesmaid | render-fidelity **ΔE00 ≈ 7.7** |
| 5 | `2d-vto/earring` | chained onto the render (undertone → metal) | gold hoop landed on the render |

**Measured cost:** a full one-person run is **43 units** (skin-tone 20 + fitzpatrick 10 +
face-attr 10 + cloth-v3 2 + earring 1). Analysis is the cost center — so we *measure once,
cache, and re-score for free* (re-scoring all 24 colorways is pure math, zero API cost).

## 🎨 The scoring engine (published, not a black box)

For each `(bridesmaid p, colorway c)`:

```
flatter(p, c) = 0.50·U + 0.30·C + 0.20·S
  U  undertone harmony   — dress warmth vs skin warmth (from CIELAB hue angle)
  C  value contrast      — |ΔL*| in a flattering band (triangular, not "max distance")
  S  saturation harmony  — enough chroma separation to read as its own color
```

The group objective is **Rawlsian max-of-minimum** — optimize the *worst* individual, not
the average:

```
groupScore(c) = min over bridesmaids p of flatter(p, c)
winner        = argmax over colorways c of groupScore(c)     ← nobody is anyone's worst
by-eye pick   = argmax over colorways c of mean_p flatter    ← how it's chosen today
```

The **by-eye** (mean-maximizing) pick is the counterfactual: it sacrifices the
deepest-skin bridesmaid to lift the average — exactly the harm OneDress removes. The color
math (sRGB → CIELAB D65, ITA°, hue angle, ΔE2000) is fixed physics; the three weights and
transfer-function constants are disclosed, calibratable parameters. Full derivation:
`lib/colorway/engine.ts`.

## 🏗️ Architecture & Tech Stack

```mermaid
graph TD
    A["📸 2 photos per bridesmaid<br/>face selfie + full-length"] --> B["Next.js API routes<br/>key stays server-side"]

    subgraph SKIN["🔬 YouCam · Skin AI — 3 endpoints"]
        C1["skin-tone-analysis<br/>→ measured hex"]
        C2["fitzpatrick-scale-analyzer<br/>→ Type I–VI"]
        C3["face-attr-analysis<br/>→ faceShape"]
    end

    B --> C1
    B --> C2
    B --> C3

    subgraph ENGINE["🎨 Our math — zero API cost"]
        D["CIELAB pipeline<br/>ITA° · hue angle · ΔE2000"]
        E["Maximin scoring<br/>24 colorways × N bridesmaids"]
        F["Winner + by-eye counterfactual"]
    end

    C1 --> D
    C2 --> D
    D --> E
    E --> F

    subgraph VTO["👗 YouCam · Apparel + Jewelry VTO — 2 endpoints"]
        G1["cloth-v3<br/>→ winner rendered on each bridesmaid"]
        G2["2d-vto/earring<br/>→ chained onto the render"]
    end

    F --> G1
    C3 --> G2
    G1 --> G2
    G2 --> H["🏆 Verdict card<br/>lineup · guarantee · ΔE badge"]

    classDef io fill:#2B2430,stroke:#6B5A66,stroke-width:1px,color:#FAF5F7
    classDef skin fill:#D98BA3,stroke:#A85F7A,stroke-width:1px,color:#241520
    classDef math fill:#9CAF88,stroke:#6F8060,stroke-width:1px,color:#1B2116
    classDef vto fill:#B79BD4,stroke:#8468A8,stroke-width:1px,color:#1E1728
    classDef verdict fill:#E9C46A,stroke:#B08D3C,stroke-width:2px,color:#2A2210

    class A,B io
    class C1,C2,C3 skin
    class D,E,F math
    class G1,G2 vto
    class H verdict

    style SKIN fill:#D98BA31A,stroke:#A85F7A,stroke-dasharray:4 3
    style ENGINE fill:#9CAF881A,stroke:#6F8060,stroke-dasharray:4 3
    style VTO fill:#B79BD41A,stroke:#8468A8,stroke-dasharray:4 3
```

**Rose is the sponsor's Skin AI, violet is its VTO, sage is our own math.** The colour split
is the Topic C argument in one glance: five YouCam endpoints doing the measuring and the
rendering, with a deterministic engine in between that turns measurements into a decision.

Measurement happens **once per bridesmaid and is cached** — so re-scoring all 24 colorways
costs nothing, and only a re-render touches the API again.

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, Tailwind CSS |
| **Language** | TypeScript (strict) |
| **API client** | Typed, Zod-validated wrapper (`lib/youcam/`) — token-bucket rate limit, retry/backoff, bounded polling. The API key stays server-side. |
| **Scoring** | Pure, deterministic engine (`lib/colorway/`, `lib/color/`) — zero network, unit-tested |
| **Sponsor API** | YouCam API (Perfect Corp) — 5 endpoints across Skin AI + Apparel VTO |
| **Testing** | Vitest (unit) + Playwright (E2E) + Lighthouse CI |

## 📊 Engineering rigor

Every number below is printed by a command in this repo — none are estimates.

| Metric | Value | Where it comes from |
|---|---|---|
| Unit tests | **77 passing** | `npm run test` |
| Coverage | **100%** — statements, branches, functions, lines | `npm run test:coverage` |
| E2E tests | **16 passing** (desktop + mobile) | `npm run e2e` |
| CI pipeline | **6 stages**, parallel, concurrency-guarded | `.github/workflows/ci.yml` |
| Render fidelity | **ΔE00 ≈ 7.7** vs the intended hex | `npm run spike` |
| API cost | **43 units** per bridesmaid, measured | `npm run spike` |
| Live endpoints proven | **5 / 5 green** | `npm run spike` |
| p50 / p95 end-to-end | *pending* — `npm run bench` publishes it | not guessed until measured |

## 🏆 Sponsor Track

**Topic C — Skin AI + Apparel VTO combined.** OneDress fuses **three Skin AI** endpoints
(`skin-tone-analysis`, `fitzpatrick-scale-analyzer`, `face-attr-analysis`) with **two
Apparel/Jewelry VTO** endpoints (`cloth-v3`, `2d-vto/earring`) into a single decision — the
measured skin values *drive* the render, they aren't shown side by side. Remove any one and
the flow visibly breaks.

**Why it could only be built on YouCam.** The whole thesis needs a *measured* skin value,
not a self-reported season or a swatch a user taps: `skin-tone-analysis` returns an actual
hex we can push through CIELAB, and `fitzpatrick-scale-analyzer` gives an independent depth
reading to cross-check it. That is the input the optimizer needs and the reason the output
is defensible. Then the same vendor renders the result on the real person — so the color we
solved for and the color you see on her are the same pipeline, and we can measure the drift
(ΔE) between them.

**One honest limitation.** `cloth-v3` is a generative try-on, so the rendered fabric does
not land exactly on the intended hex — we measure **ΔE00 ≈ 7.7**, a visible-but-small
shift. We publish that number and put the reference swatch beside every render rather than
hide it. The *decision* is made on measured skin values and fixed color math, not on the
render; the render is how you check the decision.

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- A YouCam API key (see `.env.example`)

### Installation
```bash
git clone https://github.com/edycutjong/onedress.git
cd onedress
npm install
cp .env.example .env.local   # add your YOUCAM_API_KEY
npm run dev                  # http://localhost:3000
```

### Prove the SDK integration yourself
```bash
npm run spike     # runs all 5 endpoints live and prints a green summary + unit cost
```
> The spike uses local throwaway fixtures (gitignored). No login, no accounts — the app
> is zero-config by design.

## 🧪 Testing & CI

**6-stage pipeline:** Quality → Security → Build → E2E → Performance → Deploy

```bash
npm run ci            # format:check + lint + typecheck + tests w/ coverage
npm run test          # Vitest unit tests
npm run e2e           # Playwright (mobile + desktop, zero-config)
npm run lighthouse    # Lighthouse CI (a11y is a hard gate)
make security-scan    # npm audit + license check
```

| Layer | Tool | Status |
|---|---|---|
| Code Quality | ESLint + Prettier + TypeScript strict | ✅ |
| Unit Testing | Vitest (77 tests, 100% coverage on all four metrics) | ✅ |
| E2E Testing | Playwright (demo-mode, landing, responsive) | ✅ |
| Security (SAST) | CodeQL | ✅ |
| Security (SCA) | Dependabot + npm audit | ✅ |
| Secret Scanning | TruffleHog | ✅ |
| Performance | Lighthouse CI | ✅ |

## 📁 Project Structure
```
onedress/
├── app/               # Next.js App Router (UI — 7-step flow in progress)
├── lib/
│   ├── youcam/        # typed API client (the only place calls are made)
│   ├── color/         # CIELAB pipeline: ITA°, hue angle, ΔE2000
│   ├── colorway/      # 24 swatches + the maximin scoring engine
│   └── earring/       # faceShape + undertone → silhouette + metal
├── __tests__/         # 77 unit tests, 100% coverage
├── e2e/               # Playwright specs
├── scripts/spike.ts   # live 5-endpoint proof
├── docs/              # README assets
└── .github/           # CI/CD, CodeQL, Dependabot, community health
```

## 📽️ Demo

**Live:** [onedress.edycu.dev](https://onedress.edycu.dev) · **Video:** posted at submission

## 🗺️ Roadmap

Pre-submission (deadline 2026-08-17).

- [x] Typed YouCam client — file → task → poll, rate limit, retry/backoff
- [x] Live 5-endpoint proof (`npm run spike`) — all green, cost measured
- [x] CIELAB pipeline + published maximin scoring engine, 77 unit tests at 100% coverage
- [x] Full harness: 6-stage CI, CodeQL, Dependabot, Playwright, Lighthouse
- [ ] 7-step interactive UI (Create · Measure · Score · Compare · Render · Finish · Verdict)
- [ ] Cached zero-unit demo party — the live URL's default, no key required
- [ ] `npm run bench` — published p50/p95 and exact call counts
- [ ] Post-hackathon: real garment catalogue integration, shareable party links

## 📄 License
[MIT](LICENSE) © 2026 Edy Cu

## 🙏 Acknowledgments
Built for the **YouCam API Skin AI & Apparel VTO Hackathon**. Thank you to Perfect Corp for
the YouCam API.
