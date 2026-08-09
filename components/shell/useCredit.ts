'use client';

import { useEffect, useState } from 'react';

/**
 * The live grant balance, read once per page load from `GET /api/credit`.
 *
 * That route answers `{ configured: false }` rather than an error when the
 * deployment has no API key, because "unconfigured" is a normal state here: the
 * judged URL runs the cached demo party. Two surfaces need this — the unit meter
 * and the demo-mode banner — so it is fetched once and shared.
 */

export type CreditState =
  | { kind: 'loading' }
  | { kind: 'demo' }
  | { kind: 'live'; units: number }
  | { kind: 'error' };

export function useCredit(): CreditState {
  const [state, setState] = useState<CreditState>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    fetch('/api/credit')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { configured?: boolean; units?: number | null }) => {
        if (!alive) return;
        setState(
          data.configured && typeof data.units === 'number'
            ? { kind: 'live', units: data.units }
            : { kind: 'demo' },
        );
      })
      .catch(() => {
        if (alive) setState({ kind: 'error' });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
