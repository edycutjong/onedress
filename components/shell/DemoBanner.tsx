'use client';

import type { CreditState } from '@/components/shell/useCredit';
import type { PartyDataset } from '@/lib/demo/parties';

/**
 * The honesty banner. It sits directly under the dataset switch on the judged URL
 * and it draws the line the rest of the UI holds to: the measurements and all 24
 * scores are real engine output, and the images are exactly what the banner says
 * they are — labelled illustrations for the synthetic party, licensed stock
 * photographs and real `cloth-v3` renders for the measured one. Never anything else.
 *
 * The copy comes from the dataset rather than from this component, because the two
 * parties have genuinely different things to disclose and a single hedged sentence
 * covering both would be true of neither.
 *
 * It disappears the moment a key is configured and a live run replaces the party —
 * this is a state, not a disclaimer bolted to the layout.
 */
export function DemoBanner({
  credit,
  cached,
  dataset,
}: {
  credit: CreditState;
  cached: boolean;
  dataset: PartyDataset;
}) {
  if (!cached) return null;

  const live = credit.kind === 'live';

  return (
    <div className="border-t border-[var(--border-subtle)] bg-white/[0.02]">
      <p className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-xs leading-relaxed text-text-mid sm:px-6">
        <span className="chip chip--winner chip--prose">cached · {dataset.sublabel}</span>
        <span>
          {dataset.imageryNote}
          {live
            ? ' This deployment has a live API key — start a run from Create to measure your own party.'
            : ' This deployment has no API key, so live runs are disabled.'}
        </span>
      </p>
    </div>
  );
}
