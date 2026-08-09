'use client';

import { Chip } from '@/components/ui/Chips';
import type { CreditState } from '@/components/shell/useCredit';

/**
 * The unit meter — visible on every screen (design.md §Persistent shell). It shows
 * the real grant balance next to what this party has actually cost, so the honest
 * answer on the judged deployment is "demo mode · 0 spent", not a fake ticker.
 */

export function UnitMeter({
  credit,
  spent,
  estimated,
}: {
  credit: CreditState;
  spent: number;
  estimated: number;
}) {
  const balance =
    credit.kind === 'live' ? (
      <>
        <span className="tabular font-mono text-text-hi">{credit.units.toLocaleString()}</span>{' '}
        units left
      </>
    ) : credit.kind === 'loading' ? (
      'checking balance…'
    ) : credit.kind === 'error' ? (
      'balance unavailable'
    ) : (
      'demo mode — no API key'
    );

  return (
    <Chip
      tone={credit.kind === 'live' ? 'ok' : 'default'}
      className="tabular"
      title="live grant balance · units spent on this party / estimated cost of one live run"
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: credit.kind === 'live' ? 'var(--accent)' : 'var(--text-low)' }}
      />
      <span>{balance}</span>
      <span aria-hidden="true" className="text-text-low">
        ·
      </span>
      <span>
        <span className="font-mono">{spent}</span>
        <span className="text-text-low">/{estimated}</span> units spent
      </span>
    </Chip>
  );
}
