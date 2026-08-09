.PHONY: help dev build test coverage lint typecheck ci e2e lighthouse security-scan

help:
	@echo "OneDress — make targets"
	@echo "  dev            Start the Next.js dev server"
	@echo "  build          Production build"
	@echo "  test           Unit tests (Vitest)"
	@echo "  coverage       Unit tests with coverage"
	@echo "  lint           ESLint (next lint)"
	@echo "  typecheck      TypeScript --noEmit"
	@echo "  ci             format:check + lint + typecheck + coverage"
	@echo "  e2e            Playwright E2E tests (demo mode)"
	@echo "  lighthouse     Lighthouse CI audit"
	@echo "  security-scan  npm audit + license check"

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

coverage:
	npm run test:coverage

lint:
	npm run lint

typecheck:
	npm run typecheck

ci:
	npm run ci

# ── Advanced Testing & Security ─────────────────────────────
e2e:
	@echo "🎭 Running Playwright E2E tests (demo mode)..."
	npx playwright test

lighthouse:
	@echo "🔦 Running Lighthouse CI audit..."
	npx lhci autorun

security-scan:
	@echo "=== NPM AUDIT ==="
	npm audit --audit-level=high || true
	@echo ""
	@echo "=== LICENSE CHECK ==="
	npx license-checker --production --failOn "GPL-3.0;AGPL-3.0" --summary || true
