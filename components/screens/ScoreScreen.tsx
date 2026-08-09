'use client';

import { useMemo, useState } from 'react';
import { WEIGHTS } from '@/lib/colorway/engine';
import type { ColorwaySummary, PartyRun } from '@/lib/pipeline/types';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Chip, Swatch } from '@/components/ui/Chips';
import { ScoreBar, ScoreDial } from '@/components/ui/Score';
import { ScreenHeading, SectionHeading } from '@/components/ui/ScreenHeading';
import { hex as fmtHex, score as fmtScore } from '@/lib/demo/format';

/**
 * Score — all 24 colorways against the whole party, and the one interaction that
 * makes the thesis arguable rather than asserted: the objective toggle.
 *
 * Flip it from max-of-minimum to best-on-average and **the winner changes**. That
 * is not a visual effect; it is the same numbers re-ranked by a different objective,
 * which is exactly the choice the product is about. The formula card sits on the
 * same screen, above the fold, because a score nobody can audit is a vibe.
 */

type Objective = 'maximin' | 'mean';

const OBJECTIVES: Array<{ id: Objective; label: string; gloss: string }> = [
  {
    id: 'maximin',
    label: 'Max-of-minimum',
    gloss: 'Rank by the WORST score in the party. This is what OneDress does.',
  },
  {
    id: 'mean',
    label: 'Best on average',
    gloss: 'Rank by the party mean. This is how the colour gets picked today.',
  },
];

const TERMS = [
  {
    symbol: 'U',
    weight: WEIGHTS.U,
    name: 'Undertone harmony',
    gloss: 'Does the dress run warm or cool the same way her skin does?',
  },
  {
    symbol: 'C',
    weight: WEIGHTS.C,
    name: 'Value contrast',
    gloss: 'Is |ΔL*| inside the flattering band — not too close, not maximal?',
  },
  {
    symbol: 'S',
    weight: WEIGHTS.S,
    name: 'Saturation separation',
    gloss: 'Does the colour read as its own, instead of muddying into skin?',
  },
];

function FormulaCard() {
  return (
    <Card>
      <CardHeader eyebrow="disclosed, not a black box" title="How we score" />
      <CardBody className="pt-2">
        <p className="tabular overflow-x-auto whitespace-nowrap rounded-[var(--radius-8)] bg-black/30 px-4 py-3 font-mono text-sm text-text-hi">
          flatter(person, colour) = {WEIGHTS.U.toFixed(2)}·U + {WEIGHTS.C.toFixed(2)}·C +{' '}
          {WEIGHTS.S.toFixed(2)}·S
        </p>
        <dl className="mt-4 flex flex-col gap-3">
          {TERMS.map((t) => (
            <div key={t.symbol} className="flex gap-3">
              <dt className="flex shrink-0 items-start gap-2">
                <span className="tabular inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-full)] bg-white/10 font-mono text-xs font-semibold text-text-hi">
                  {t.symbol}
                </span>
                <span className="tabular pt-0.5 font-mono text-xs text-text-low">
                  ×{t.weight.toFixed(2)}
                </span>
              </dt>
              <dd className="text-sm leading-snug">
                <span className="text-text-hi">{t.name}</span>{' '}
                <span className="text-text-mid">— {t.gloss}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-text-low">
          Colour maths is fixed physics — CIELAB, ITA°, hue angle. The three weights and the band
          edges are calibrated parameters, stated here rather than buried, and due to be fit to a
          blind human-preference study. Scoring costs zero API units: it is pure local maths over
          the measured hexes.
        </p>
      </CardBody>
    </Card>
  );
}

function ColorwayCard({
  summary,
  rank,
  objective,
  isPick,
}: {
  summary: ColorwaySummary;
  rank: number;
  objective: Objective;
  isPick: boolean;
}) {
  const headline = objective === 'maximin' ? summary.groupScore : summary.mean;
  const secondary = objective === 'maximin' ? summary.mean : summary.groupScore;

  return (
    <Card tone={isPick ? 'winner' : 'default'} stagger={Math.min(rank, 6)} className="w-full">
      {/* The swatch band carries the rank and the headline number, so the colorway
          name gets the full card width and never truncates at six columns. */}
      <div className="relative h-16 w-full" style={{ background: summary.colorway.hex }}>
        <span className="tabular absolute left-2 top-2 rounded-[var(--radius-4)] bg-black/45 px-1.5 py-0.5 font-mono text-[0.625rem] text-white">
          #{rank}
        </span>
        <span className="tabular absolute bottom-1.5 right-2 rounded-[var(--radius-4)] bg-black/45 px-1.5 py-0.5 font-mono text-base font-semibold text-white">
          {fmtScore(headline)}
        </span>
      </div>
      <CardHeader
        eyebrow={summary.colorway.family}
        title={summary.colorway.name}
        titleClassName="text-base"
        className="pt-3"
      />
      <CardBody className="pb-3 pt-2">
        <ScoreBar value={headline} color={summary.colorway.hex} />
        <p className="tabular mt-2 font-mono text-[0.6875rem] text-text-mid">
          <span className="text-text-low">{objective === 'maximin' ? 'floor' : 'mean'}</span>{' '}
          {fmtScore(headline)}
          <span className="text-text-low">
            {' '}
            · {objective === 'maximin' ? 'mean' : 'floor'}
          </span>{' '}
          {fmtScore(secondary)}
        </p>
      </CardBody>
      <CardFooter>
        <Chip title="the person this colour serves worst">
          worst: {summary.worst.name ?? summary.worst.id}
          <span className="tabular font-mono text-text-hi">{fmtScore(summary.worst.flatter)}</span>
        </Chip>
      </CardFooter>
    </Card>
  );
}

export function ScoreScreen({ run }: { run: PartyRun }) {
  const [objective, setObjective] = useState<Objective>('maximin');
  const scoring = run.scoring;

  const ranked = useMemo(() => {
    if (!scoring) return [];
    if (objective === 'maximin') return scoring.ranked;
    return [...scoring.ranked].sort((a, b) => b.mean - a.mean || a.variance - b.variance);
  }, [scoring, objective]);

  if (!scoring) {
    return (
      <ScreenHeading
        eyebrow="Score"
        title="Nothing to score"
        lead="No bridesmaid in this party has a measured skin hex yet."
      />
    );
  }

  const pick = ranked[0];
  const changesWinner = scoring.differsFromByEye;

  return (
    <div className="flex flex-col gap-12">
      <ScreenHeading
        eyebrow={`Score · ${scoring.ranked.length} colorways · 0 API units`}
        title="Twenty-four colours, one objective"
        lead={
          <>
            Every colorway is scored against every measured bridesmaid, then the party is reduced to
            a single number — and <em>which</em> number you reduce to is the whole argument. Switch
            the objective below and watch the winner change.
          </>
        }
      />

      <section aria-labelledby="objective-heading">
        <SectionHeading
          id="objective-heading"
          title="The objective"
          note={
            changesWinner
              ? 'For this party the two objectives disagree — which is the normal case, not a contrived one.'
              : 'For this party the two objectives agree: its skin tones sit close enough together that no colorway can serve one person materially worse than the rest. Compare says why in full.'
          }
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardBody>
              <div role="group" aria-label="Ranking objective" className="flex flex-wrap gap-2">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setObjective(o.id)}
                    aria-pressed={objective === o.id}
                    className={`btn ${objective === o.id ? 'btn--primary' : ''}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm leading-snug text-text-mid">
                {OBJECTIVES.find((o) => o.id === objective)?.gloss}
              </p>

              {pick ? (
                <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[var(--border-subtle)] pt-5">
                  <span
                    aria-hidden="true"
                    className="h-16 w-16 shrink-0 rounded-[var(--radius-12)] ring-1 ring-inset ring-white/25"
                    style={{ background: pick.colorway.hex }}
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-low">
                      This objective picks
                    </p>
                    <p className="font-display text-2xl text-text-hi">{pick.colorway.name}</p>
                    <p className="tabular font-mono text-xs text-text-mid">
                      {fmtHex(pick.colorway.hex)}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-5">
                    <ScoreDial
                      value={pick.groupScore}
                      label="group floor"
                      size="md"
                      color={pick.colorway.hex}
                    />
                    <ScoreDial
                      value={pick.mean}
                      label="party mean"
                      size="md"
                      color="var(--text-low)"
                    />
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <FormulaCard />
        </div>
      </section>

      <section aria-labelledby="board-heading">
        <SectionHeading
          id="board-heading"
          title={`All ${scoring.ranked.length}, ranked by ${objective === 'maximin' ? 'the group floor' : 'the party mean'}`}
          note="Every card shows both numbers and names the bridesmaid that colour serves worst — the losing colours are as informative as the winner."
          trailing={
            <Chip tone="winner">
              <Swatch color={scoring.winner.colorway.hex} label={scoring.winner.colorway.name} />
              <span className="text-text-mid">is the shipped pick</span>
            </Chip>
          }
        />
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {ranked.map((summary, i) => (
            <li key={summary.colorway.id} className="flex">
              <ColorwayCard summary={summary} rank={i + 1} objective={objective} isPick={i === 0} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
