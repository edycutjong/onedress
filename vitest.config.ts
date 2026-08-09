import { defineConfig, type Plugin } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Keeps `istanbul ignore` hints alive.
 *
 * Vite transpiles TS with esbuild, and esbuild drops every comment except LEGAL
 * comments (`/*! … *\/`). The coverage provider instruments AFTER that, so a plain
 * `/* istanbul ignore next *\/` is already gone by the time it could take effect —
 * it fails silently, which is the worst possible failure mode for a coverage hint.
 *
 * So the four hints in this codebase are written in the legal-comment form, which
 * survives esbuild, and this plugin rewrites them back to the form istanbul's
 * `/^\s*istanbul\s+ignore\s+(if|else|next)/` matcher expects. `enforce: 'pre'` is
 * wrong here (it would run before esbuild, where the plain form still exists);
 * this must run in the normal bucket, ahead of vitest's own coverage transform.
 */
const restoreCoverageHints: Plugin = {
  name: 'onedress:restore-coverage-hints',
  transform(code, id) {
    if (!id.includes('/lib/') || !code.includes('/*! istanbul ignore')) return null;
    return { code: code.replaceAll('/*! istanbul ignore', '/* istanbul ignore'), map: null };
  },
};

export default defineConfig({
  plugins: [restoreCoverageHints],
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['node_modules', '.next', 'e2e', 'scripts', 'bench'],
    environment: 'node',
    coverage: {
      // istanbul, not v8: the v8 provider remaps through Vite's SSR transform, which
      // prepends an `Object.defineProperty(__vite_ssr_exports__, …, { get(){ try {…}
      // catch {} } })` shim on generated line 1. Source-mapped back, that shim shows
      // up as a phantom uncovered statement/function/branch on line 1 of EVERY module
      // — code no test can reach because it is not our code. istanbul instruments
      // before the SSR transform, so the report only contains what we actually wrote.
      provider: 'istanbul',
      reporter: ['text', 'html'],
      // Cover the pure logic that the tests actually exercise: the colour maths, the
      // scoring engine, the orchestrator (run against a fake client) and the error
      // taxonomy. The HTTP client itself is proven live by the Phase-0 spike, and
      // head-crop is sharp-bound I/O — neither is unit-covered on purpose.
      include: [
        'lib/color/**',
        'lib/colorway/**',
        'lib/earring/**',
        'lib/pipeline/run-party.ts',
        'lib/pipeline/types.ts',
        'lib/youcam/errors.ts',
        'lib/youcam/features.ts',
      ],
      // Everything in scope is fully covered. Locking it at 100 means a regression is
      // a red build, not a number nobody reads — and it doubles as the canary for the
      // `istanbul ignore` hints above: if the hint plumbing ever breaks, this fails.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
