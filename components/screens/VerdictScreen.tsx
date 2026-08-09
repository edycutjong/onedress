'use client';

import { useState } from 'react';
import type { PartyRun } from '@/lib/pipeline/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip, Swatch } from '@/components/ui/Chips';
import { CounterfactualRecap } from '@/components/ui/CounterfactualSplit';
import { RenderTile } from '@/components/ui/RenderTile';
import { ScoreDial } from '@/components/ui/Score';
import { ScreenHeading, SectionHeading } from '@/components/ui/ScreenHeading';
import { hex as fmtHex, score as fmtScore, signed } from '@/lib/demo/format';
import { counterfactualView, flatterOf } from '@/lib/demo/select';

/**
 * The verdict — the composed payoff, and the one screen that alone reads as a
 * finished product. Hierarchy, largest to smallest (design.md §Verdict card):
 * colorway name + swatch · the six as one lineup · the guarantee · the lift stat ·
 * the counterfactual recap · the terminal share beat (the "Finish" step, folded in
 * here rather than given a screen of its own).
 */

function verdictSummary(run: PartyRun): string {
  const s = run.scoring;
  if (!s) return 'OneDress — no verdict yet.';
  const cf = counterfactualView(run);
  const lines = [
    `OneDress verdict — ${s.winner.colorway.name} ${fmtHex(s.winner.colorway.hex)}`,
    `Nobody in the party scores below ${fmtScore(s.winner.groupScore)}/100 (party mean ${fmtScore(s.winner.mean)}).`,
    '',
    ...s.winner.perPerson.map((p) => `  ${p.name ?? p.id}: ${fmtScore(p.flatter)}`),
  ];
  if (cf) {
    lines.push(
      '',
      `Picked by eye (best on average) it would have been ${cf.byEyeColorway.name}, which scores ` +
        `${fmtScore(cf.byEyeScore)} on ${cf.subjectName}. Under ${cf.winnerColorway.name} she scores ` +
        `${fmtScore(cf.winnerScore)} — ${signed(cf.winnerScore - cf.byEyeScore)}.`,
    );
  }
  lines.push('', 'Scored across all 24 colorways by max-of-minimum. onedress.edycu.dev');
  return lines.join('\n');
}

export function VerdictScreen({ run }: { run: PartyRun }) {
  const [copied, setCopied] = useState(false);
  const scoring = run.scoring;
  const cf = counterfactualView(run);

  if (!scoring) {
    return (
      <ScreenHeading
        eyebrow="Verdict"
        title="No verdict yet"
        lead="Nobody in this party has been measured, so there is nothing to score. Start at Create."
      />
    );
  }

  const winner = scoring.winner;
  const lift = cf ? cf.winnerScore - cf.byEyeScore : 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verdictSummary(run));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-12">
      <ScreenHeading
        eyebrow={`Verdict · ${run.bridesmaids.length} bridesmaids · ${scoring.ranked.length} colorways`}
        title={
          <span className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="inline-block h-14 w-14 shrink-0 rounded-[var(--radius-12)] ring-1 ring-inset ring-white/25 sm:h-16 sm:w-16"
              style={{ background: winner.colorway.hex }}
            />
            <span className="text-4xl sm:text-6xl">{winner.colorway.name}</span>
            <span className="tabular font-mono text-sm font-normal text-text-mid">
              {fmtHex(winner.colorway.hex)}
            </span>
          </span>
        }
        lead={
          <>
            Six bridesmaids, six skin tones, one dress color.{' '}
            <strong className="font-semibold text-text-hi">
              Nobody below {fmtScore(winner.groupScore)}.
            </strong>{' '}
            That number is the promise: it is the <em>worst</em> score in the party, not the
            average, so no one is anyone’s worst option.
          </>
        }
        trailing={
          <div className="flex gap-6">
            <ScoreDial value={winner.groupScore} label="group floor" size="lg" />
            <ScoreDial value={winner.mean} label="party mean" size="lg" color="var(--text-low)" />
          </div>
        }
      />

      <section aria-labelledby="lineup-heading">
        <SectionHeading
          id="lineup-heading"
          title="The lineup"
          note="One colour on every complexion — identical crop, shared baseline, one frame. Six people, one decision."
          trailing={
            <Chip>
              <Swatch color={winner.colorway.hex} label={winner.colorway.name} />
            </Chip>
          }
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {run.bridesmaids.map((b, i) => (
            <RenderTile
              key={b.id}
              bridesmaid={b}
              index={i}
              colorway={winner.colorway}
              flatter={flatterOf(winner, b.id)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="proof-heading">
        <SectionHeading
          id="proof-heading"
          title="Why this colour and not the obvious one"
          note="The by-eye method maximises the average, which is exactly how one person ends up carrying the cost."
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <Card>
            <CardBody className="flex h-full flex-col justify-center gap-3 py-6">
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-text-low">
                The lift
              </p>
              {cf ? (
                <>
                  <p className="font-display text-4xl leading-none text-[var(--winner)]">
                    <span className="tabular">{signed(lift)}</span>
                  </p>
                  <p className="text-sm leading-relaxed text-text-mid">
                    The by-eye pick, {cf.byEyeColorway.name}, scores{' '}
                    <span className="tabular font-mono text-text-hi">
                      {fmtScore(cf.byEyeScore)}
                    </span>{' '}
                    on {cf.subjectName} (Fitzpatrick {cf.subjectFitzpatrick}). Under{' '}
                    {cf.winnerColorway.name} she scores{' '}
                    <span className="tabular font-mono text-text-hi">
                      {fmtScore(cf.winnerScore)}
                    </span>
                    . Nobody else was pushed below the floor to buy it.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-text-mid">
                  For this party the fair pick and the by-eye pick agree — there is no
                  counterfactual to show, and inventing one would be the dishonest option.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="py-6">
              {cf ? (
                <CounterfactualRecap {...cf} />
              ) : (
                <p className="text-sm text-text-mid">No counterfactual for this party.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      <section aria-labelledby="finish-heading">
        <SectionHeading
          id="finish-heading"
          title="Finish"
          note="The flow does not dead-end on a static card: the verdict is meant to leave and settle an argument in a group chat."
        />
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4 py-5">
            <p className="max-w-lg text-sm leading-relaxed text-text-mid">
              Copies the winning colorway, its hex, every bridesmaid’s flatter score and the
              counterfactual as plain text. Image export of the six-up lineup lands with the first
              real renders — it is not built yet, and this card will not pretend otherwise.
            </p>
            <button type="button" onClick={copy} className="btn btn--primary">
              {copied ? 'Copied to clipboard' : 'Copy the verdict'}
            </button>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
