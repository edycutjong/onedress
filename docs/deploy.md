# Deployment

One repository, one Vercel project, one deploy — three surfaces:

| Route | Served from | Kind |
| --- | --- | --- |
| `/` | `public/landing.html` | static HTML, rewritten in `next.config.mjs` |
| `/pitch` | `public/pitch.html` | static HTML, rewritten in `next.config.mjs` |
| `/party` | `app/party/page.tsx` | the Next.js product |
| `/api/*` | `app/api/**` | route handlers |

The two static pages are hand-authored single-file HTML (inline CSS + inline JS).
They are served verbatim rather than ported to React: nothing about them benefits
from hydration, and re-typing 115 KB of tuned markup into JSX would only add risk.
They are excluded from Prettier in `.prettierignore` for the same reason.

Because `/` is a public file and not a route, the rewrites must be in the
`beforeFiles` bucket — that bucket runs ahead of the filesystem check, which is
the only way `/` can resolve to `public/landing.html`. There is deliberately no
`app/page.tsx`.

## GitHub Actions → Vercel

`.github/workflows/deploy.yml` runs the official Vercel CLI flow:

- **pull request** → `vercel pull --environment=preview` → `vercel build` →
  `vercel deploy --prebuilt` (preview URL, posted to the job summary)
- **push to `main`** → the same with `--prod` (production deploy)

### Required repository secrets

Add these under **Settings → Secrets and variables → Actions → New repository
secret**. Until all three exist the workflow's `preflight` job prints exactly
which are missing and skips the deploy jobs — it never fails inside the CLI with
an opaque auth error, and it never blocks a merge.

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → **Create Token**, scoped to the team that owns the project |
| `VERCEL_ORG_ID` | run `npx vercel link` in this repo, then read `orgId` from the generated `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | the same `.vercel/project.json` → `projectId` |

`.vercel/` is gitignored — it holds the link and any pulled environment.

### Environment variables

`YOUCAM_API_KEY` (and the other values in `.env.example`) belong in the Vercel
project's own environment settings, not in this repo. Without a key the app still
works: `/party` opens on the cached demo party and spends zero API units. That is
the judged path.

## Custom domain

`onedress.edycu.dev` is attached in the Vercel dashboard, not by this workflow, and
nothing in this repo assumes which project currently owns it. Historically it
served a separate standalone `site` project holding the landing page and deck —
the two files now in `public/`. **After the first production deploy from this
repo, confirm the domain points at this project**; if it still resolves to the old
project, `/party` will 404 on the custom domain even though it works on the
`*.vercel.app` deployment URL.
