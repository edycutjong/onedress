'use client';

import { STEPS } from '@/lib/demo/steps';

/**
 * The 7-step spine. It is on every screen and it is the narrative: Create · Measure ·
 * Score · Compare · Render · Finish · Verdict, current step lit.
 *
 * Each step also carries the run's honest status, so the spine doubles as the run
 * summary — a `skipped` step is drawn as skipped, never quietly as done.
 */

export type StepStatus = 'done' | 'skipped' | 'todo';

const DOT: Record<StepStatus, string> = {
  done: 'bg-[var(--winner)] border-[var(--winner)]',
  skipped: 'bg-transparent border-[var(--border-default)] border-dashed',
  todo: 'bg-transparent border-[var(--border-default)]',
};

const STATUS_TEXT: Record<StepStatus, string> = {
  done: 'complete',
  skipped: 'not run',
  todo: 'not started',
};

export function ProgressSpine({
  activeStepId,
  statuses,
  onSelect,
}: {
  activeStepId: string;
  statuses: Record<string, StepStatus>;
  onSelect: (stepId: string) => void;
}) {
  return (
    <nav aria-label="Progress" className="min-w-0">
      <ol className="flex items-center gap-0.5 overflow-x-auto pb-0.5 sm:gap-1">
        {STEPS.map((step, i) => {
          const active = step.id === activeStepId;
          const status = statuses[step.id] ?? 'todo';
          return (
            <li key={step.id} className="flex shrink-0 items-center">
              {i > 0 ? (
                <span aria-hidden="true" className="mx-0.5 h-px w-3 bg-[var(--border-default)]" />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? 'step' : undefined}
                title={step.gloss}
                className={[
                  'flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1.5 text-xs',
                  'transition-colors duration-200 hover:bg-white/5',
                  active
                    ? 'bg-white/[0.07] font-semibold text-text-hi'
                    : 'font-medium text-text-mid',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full border ${DOT[status]}`}
                />
                <span>{step.label}</span>
                <span className="sr-only">
                  — step {i + 1} of {STEPS.length}, {STATUS_TEXT[status]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
