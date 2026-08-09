'use client';

import { useMemo, useState } from 'react';
import type { PartyRun } from '@/lib/pipeline/types';
import { AppShell } from '@/components/shell/AppShell';
import { DemoBanner } from '@/components/shell/DemoBanner';
import { useCredit } from '@/components/shell/useCredit';
import { CompareScreen } from '@/components/screens/CompareScreen';
import { MeasureScreen } from '@/components/screens/MeasureScreen';
import { ScoreScreen } from '@/components/screens/ScoreScreen';
import { VerdictScreen } from '@/components/screens/VerdictScreen';
import { Card, CardBody } from '@/components/ui/Card';
import { ScreenHeading } from '@/components/ui/ScreenHeading';
import { DEMO_PARTY } from '@/lib/demo/demo-party';
import { accentHex, stepStatuses } from '@/lib/demo/select';
import { stepById } from '@/lib/demo/steps';

/**
 * The product. It opens on the **cached demo party's verdict** — no API key, no
 * units, no upload — because that is the frame that shows what OneDress is in one
 * look, and every earlier step is one click back along the spine.
 *
 * All seven steps read the same `PartyRun` object, which is exactly the shape
 * `/api/party/[id]` and the SSE stream emit. A live run therefore drops straight in
 * with no second code path.
 */

export default function Home() {
  const [party] = useState<PartyRun>(DEMO_PARTY);
  const [activeStepId, setActiveStepId] = useState('verdict');
  const credit = useCredit();

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
      ) : (
        <>
          <ScreenHeading
            eyebrow={`${step.label} · ${step.gloss}`}
            title={`${step.label} is not wired up yet`}
            lead="This build ships the verdict first; the earlier steps land in the next commits."
          />
          <Card tone="muted">
            <CardBody>
              <p className="text-sm text-text-mid">Jump back to Verdict from the spine above.</p>
            </CardBody>
          </Card>
        </>
      )}
    </AppShell>
  );
}
