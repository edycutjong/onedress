'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PartyRun } from '@/lib/pipeline/types';
import { AppShell } from '@/components/shell/AppShell';
import { DemoBanner } from '@/components/shell/DemoBanner';
import { useCredit } from '@/components/shell/useCredit';
import { CompareScreen } from '@/components/screens/CompareScreen';
import { CreateScreen } from '@/components/screens/CreateScreen';
import { MeasureScreen } from '@/components/screens/MeasureScreen';
import { RenderScreen } from '@/components/screens/RenderScreen';
import { ScoreScreen } from '@/components/screens/ScoreScreen';
import { VerdictScreen } from '@/components/screens/VerdictScreen';
import { DEMO_PARTY } from '@/lib/demo/demo-party';
import { accentHex, stepStatuses } from '@/lib/demo/select';
import { stepById } from '@/lib/demo/steps';

/**
 * The product, served at `/party` (the landing page owns `/`, the deck owns
 * `/pitch` — all three come out of this one deploy). It opens on the **cached demo
 * party's verdict** — no API key, no units, no upload — because that is the frame
 * that shows what OneDress is in one look, and every earlier step is one click back
 * along the spine.
 *
 * All seven steps read the same `PartyRun` object, which is exactly the shape
 * `/api/party/[id]` and the SSE stream emit. A live run therefore drops straight in
 * with no second code path.
 */

export default function PartyPage() {
  const [party, setParty] = useState<PartyRun>(DEMO_PARTY);
  const [activeStepId, setActiveStepId] = useState('verdict');
  const credit = useCredit();

  // A live run replaces the cached party and moves the spine to Measure once, then
  // leaves navigation alone — the visitor should be able to look around while it runs.
  const handleParty = useCallback((run: PartyRun) => {
    setParty(run);
    setActiveStepId((current) => (current === 'create' ? 'measure' : current));
  }, []);

  const statuses = useMemo(() => stepStatuses(party), [party]);
  const step = stepById(activeStepId);

  return (
    <AppShell
      activeStepId={activeStepId}
      statuses={statuses}
      onSelect={setActiveStepId}
      accent={accentHex(party)}
      credit={credit}
      spent={party.units.spent ?? 0}
      estimated={party.units.estimated}
      banner={<DemoBanner credit={credit} cached={Boolean(party.cached)} />}
    >
      {step.screen === 'verdict' ? (
        <VerdictScreen run={party} />
      ) : step.screen === 'compare' ? (
        <CompareScreen run={party} />
      ) : step.screen === 'measure' ? (
        <MeasureScreen run={party} />
      ) : step.screen === 'score' ? (
        <ScoreScreen run={party} />
      ) : step.screen === 'render' ? (
        <RenderScreen run={party} />
      ) : (
        <CreateScreen onParty={handleParty} onGoToVerdict={() => setActiveStepId('verdict')} />
      )}
    </AppShell>
  );
}
