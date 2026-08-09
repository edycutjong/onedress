'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PartyRun } from '@/lib/pipeline/types';
import { AppShell } from '@/components/shell/AppShell';
import { DemoBanner } from '@/components/shell/DemoBanner';
import { PartySwitcher } from '@/components/shell/PartySwitcher';
import { useCredit } from '@/components/shell/useCredit';
import { CompareScreen } from '@/components/screens/CompareScreen';
import { CreateScreen } from '@/components/screens/CreateScreen';
import { MeasureScreen } from '@/components/screens/MeasureScreen';
import { RenderScreen } from '@/components/screens/RenderScreen';
import { ScoreScreen } from '@/components/screens/ScoreScreen';
import { VerdictScreen } from '@/components/screens/VerdictScreen';
import { DEFAULT_PARTY_ID, partyDataset, type PartyDatasetId } from '@/lib/demo/parties';
import { accentHex, stepStatuses } from '@/lib/demo/select';
import { stepById } from '@/lib/demo/steps';

/**
 * The product, served at `/party` (the landing page owns `/`, the deck owns
 * `/pitch` — all three come out of this one deploy). It opens on the **synthetic
 * demo party's verdict** — no API key, no units, no upload — because that is the
 * frame that shows what OneDress is in one look, and every earlier step is one click
 * back along the spine.
 *
 * Two cached datasets ship, switchable from the shell. The synthetic party is the
 * default because it is the one where the two objectives diverge, which is the
 * argument. The measured party is seven real people run through the live API; on it
 * the objectives agree, and the app reports that rather than dressing it up.
 *
 * All seven steps read the same `PartyRun` object, which is exactly the shape
 * `/api/party/[id]` and the SSE stream emit. A live run therefore drops straight in
 * with no second code path — and it takes precedence over whichever dataset is
 * selected, because a real measurement beats a cached one.
 */

export default function PartyPage() {
  const [datasetId, setDatasetId] = useState<PartyDatasetId>(DEFAULT_PARTY_ID);
  const [liveRun, setLiveRun] = useState<PartyRun | null>(null);
  const [activeStepId, setActiveStepId] = useState('verdict');
  const credit = useCredit();

  const dataset = partyDataset(datasetId);
  const party = liveRun ?? dataset.party;

  // A live run replaces the cached party and moves the spine to Measure once, then
  // leaves navigation alone — the visitor should be able to look around while it runs.
  const handleParty = useCallback((run: PartyRun) => {
    setLiveRun(run);
    setActiveStepId((current) => (current === 'create' ? 'measure' : current));
  }, []);

  // Choosing a dataset is an explicit request to see that dataset, so it drops the
  // live run rather than leaving a switch that visibly does nothing.
  const handleDataset = useCallback((id: PartyDatasetId) => {
    setDatasetId(id);
    setLiveRun(null);
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
      banner={
        <>
          <PartySwitcher active={datasetId} onSelect={handleDataset} />
          <DemoBanner credit={credit} cached={Boolean(party.cached)} dataset={dataset} />
        </>
      }
    >
      {/*
        `key` on the screen wrapper is what makes the transition exist: changing it
        remounts the subtree, so the enter animation replays on every step change.
        Without it React reconciles in place and screens swap in a single frame —
        which reads as a glitch on camera rather than as navigation.
      */}
      <div key={step.screen} className="screen-enter">
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
      </div>
    </AppShell>
  );
}
