'use client';

import { PARTY_DATASETS, type PartyDatasetId } from '@/lib/demo/parties';

/**
 * The dataset switch. Two cached parties ship with the app and they make different
 * claims, so the control names both of them literally — "synthetic" and "real
 * photos" — rather than hiding the difference behind A/B labels.
 *
 * The synthetic party is first and is the default: it is the one where the two
 * objectives diverge, which is the argument the product is making. The measured
 * party is the evidence that the same engine, unchanged, reports no divergence when
 * a party does not have one.
 */
export function PartySwitcher({
  active,
  onSelect,
}: {
  active: PartyDatasetId;
  onSelect: (id: PartyDatasetId) => void;
}) {
  return (
    <div className="border-t border-[var(--border-subtle)]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <span
          id="dataset-label"
          className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-low"
        >
          Dataset
        </span>
        <div role="group" aria-labelledby="dataset-label" className="flex flex-wrap gap-2">
          {PARTY_DATASETS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              aria-pressed={active === d.id}
              title={d.sublabel}
              className={`btn btn--sm ${active === d.id ? 'btn--primary' : ''}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
