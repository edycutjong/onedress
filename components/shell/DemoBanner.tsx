'use client';

import type { CreditState } from '@/components/shell/useCredit';

/**
 * The honesty banner. It is the first thing under the spine on the judged URL, and
 * it draws the line the rest of the UI holds to: the measurements and all 24 scores
 * are real engine output; the photographs are not, because they do not exist yet.
 *
 * It disappears the moment a key is configured and a live run replaces the party —
 * this is a state, not a disclaimer bolted to the layout.
 */
export function DemoBanner({ credit, cached }: { credit: CreditState; cached: boolean }) {
  if (!cached) return null;

  const live = credit.kind === 'live';

  return (
    <div className="border-t border-[var(--border-subtle)] bg-white/[0.02]">
      <p className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-xs leading-relaxed text-text-mid sm:px-6">
        <span className="chip chip--winner">cached demo party</span>
        <span>
          Six synthetic Fitzpatrick I–VI profiles. Every hex, every score and all 24 rankings below
          are computed by the shipped engine — no API call, no units.{' '}
          <strong className="font-semibold text-text-hi">
            Photoreal renders are not included:
          </strong>{' '}
          there are no bridesmaid photographs yet, so every image slot is drawn as a labelled
          illustration rather than a fabricated one.
          {live
            ? ' This deployment has a live API key — start a run from Create to fill them for real.'
            : ' This deployment has no API key, so live runs are disabled.'}
        </span>
      </p>
    </div>
  );
}
