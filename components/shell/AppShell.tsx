'use client';

import type { ReactNode } from 'react';
import { ProgressSpine, type StepStatus } from '@/components/shell/ProgressSpine';
import { UnitMeter } from '@/components/shell/UnitMeter';
import type { CreditState } from '@/components/shell/useCredit';

/**
 * The persistent chrome: wordmark, the 7-step spine, the unit meter. Present on 100%
 * of screens — it is what makes the app one product rather than seven pages, and it
 * is how a judge always knows where in the story they are.
 *
 * `accent` is the currently-winning colorway hex. Handing it to `--winner` here
 * recolours the spine, the buttons and every highlight in one assignment: the
 * product's own thesis expressed as chrome.
 */

export function AppShell({
  activeStepId,
  statuses,
  onSelect,
  accent,
  credit,
  spent,
  estimated,
  banner,
  children,
}: {
  activeStepId: string;
  statuses: Record<string, StepStatus>;
  onSelect: (stepId: string) => void;
  accent: string;
  credit: CreditState;
  spent: number;
  estimated: number;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        // The app accent IS the winning colorway.
        ['--winner' as string]: accent,
        ['--winner-soft' as string]: `color-mix(in srgb, ${accent} 16%, transparent)`,
      }}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-x-6 gap-y-2">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-lg font-semibold tracking-tight text-text-hi">
                OneDress
              </span>
              <span className="hidden font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-low sm:inline">
                one color · every complexion
              </span>
            </p>
            <div className="ml-auto shrink-0">
              <UnitMeter credit={credit} spent={spent} estimated={estimated} />
            </div>
          </div>

          {/* The spine gets its own full-width row so no label can ever be clipped
              by the meter — it is the one element that must stay legible at 375px. */}
          <div className="mt-2 min-w-0">
            <ProgressSpine activeStepId={activeStepId} statuses={statuses} onSelect={onSelect} />
          </div>
        </div>
        {banner}
      </header>

      <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-[var(--border-subtle)] px-4 py-6 sm:px-6">
        <p className="mx-auto max-w-[1240px] text-xs leading-relaxed text-text-low">
          Scores are computed locally by the published colorway engine (CIELAB undertone,
          value-contrast and saturation terms, combined max-of-minimum). Measurement and rendering
          run on the YouCam / Perfect Corp API. No photograph in this app is generated or invented —
          where an image is missing, the card says so.
        </p>
      </footer>
    </div>
  );
}
