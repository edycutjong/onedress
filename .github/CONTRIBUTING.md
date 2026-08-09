# Contributing

Thanks for your interest in improving OneDress! 🎉

## Getting Started
1. Fork the repo and branch from `main`: `git checkout -b feat/your-feature`
2. Install dependencies: `npm install`
3. Copy the env template: `cp .env.example .env.local` and add your YouCam key
4. Start the dev server: `npm run dev`

## Before You Open a PR
- `npm run ci` passes (format:check, lint, typecheck, tests + coverage).
- `npm run e2e` passes (Playwright).
- Add or update tests for any behavior change — the scoring engine
  (`lib/colorway/`) and color math (`lib/color/`) are covered by unit tests and
  must stay green.
- Keep commits conventional (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).

## Reporting Bugs / Requesting Features
Open an issue using the provided templates. Include repro steps, expected vs.
actual behavior, and environment details.
