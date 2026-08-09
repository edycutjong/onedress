import type { ColorwaySummary, PartyRun } from '@/lib/pipeline/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip, FitzBadge, Swatch } from '@/components/ui/Chips';
import { CounterfactualSplit } from '@/components/ui/CounterfactualSplit';
import { ScoreBar } from '@/components/ui/Score';
import { ScreenHeading, SectionHeading } from '@/components/ui/ScreenHeading';
import { count as fmtCount, degrees as fmtDeg, score as fmtScore } from '@/lib/demo/format';
import { datasetOf, nounsOf, partyDataset } from '@/lib/demo/parties';
import { counterfactualView, displayName, flatterOf, itaSpan } from '@/lib/demo/select';

/**
 * Compare — the counterfactual, standing on its own before the render cascade.
 *
 * There are two honest outcomes here and the screen commits to both.
 *
 * **They diverge.** The by-eye pick wins on average and ruins one person, so the
 * screen does two things and nothing else: the split (one woman, two colours, two
 * numbers), then the spread — where each pick lands on everyone.
 *
 * **They agree.** On a party whose skin tones sit close together, no colorway can
 * serve one member materially worse than the rest, so the colour that lifts the mean
 * is already the colour that protects the floor. That is a *finding*, not a failure,
 * and it is reported as one: the screen states it, shows the measured spread that
 * causes it, and points at the party where the divergence does appear. Nothing here
 * apologises, and nothing manufactures a delta to fill the space.
 */

interface SpreadColumn {
  key: string;
  summary: ColorwaySummary;
  label: string;
}

function Spread({ columns, run }: { columns: readonly SpreadColumn[]; run: PartyRun }) {
  const { noun } = nounsOf(run);
  const heading = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">
            Flatter score for every {noun} in the party under{' '}
            {columns.map((c) => `${c.label} (${c.summary.colorway.name})`).join(' and ')}.
          </caption>
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th scope="col" className="w-40 py-2 pr-4 text-left font-medium text-text-mid">
                {heading}
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="py-2 pl-4 text-left">
                  <span className="block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-low">
                    {c.label}
                  </span>
                  <span className="mt-1 flex items-center gap-2 font-display text-base text-text-hi">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3.5 w-3.5 rounded-[3px] ring-1 ring-inset ring-white/25"
                      style={{ background: c.summary.colorway.hex }}
                    />
                    {c.summary.colorway.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {run.bridesmaids.map((b, i) => {
              const measurement = b.measure.result;
              return (
                <tr key={b.id} className="border-b border-[var(--border-subtle)]">
                  <th scope="row" className="py-3 pr-4 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <FitzBadge
                        numeral={measurement?.fitzpatrick}
                        skinHex={measurement?.skinHex}
                      />
                      <span className="text-text-hi">{displayName(b, i)}</span>
                    </span>
                  </th>
                  {columns.map((c) => {
                    const value = flatterOf(c.summary, b.id);
                    const isWorst = c.summary.worst.id === b.id;
                    return (
                      <td key={c.key} className="py-3 pl-4 align-middle">
                        <span className="flex items-center gap-3">
                          <ScoreBar
                            value={value ?? 0}
                            color={c.summary.colorway.hex}
                            className="max-w-[10rem]"
                          />
                          <span className="tabular w-12 shrink-0 font-mono text-text-hi">
                            {value === undefined ? '—' : fmtScore(value)}
                          </span>
                          {isWorst ? (
                            <Chip tone="warning" className="shrink-0">
                              lowest
                            </Chip>
                          ) : null}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-3 pr-4 text-left font-medium text-text-mid">
                Group floor <span className="text-text-low">(the worst score)</span>
              </th>
              {columns.map((c) => (
                <td key={c.key} className="tabular py-3 pl-4 font-mono text-lg text-text-hi">
                  {fmtScore(c.summary.groupScore)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="py-1 pr-4 text-left font-medium text-text-mid">
                Party mean
              </th>
              {columns.map((c) => (
                <td key={c.key} className="tabular py-1 pl-4 font-mono text-text-mid">
                  {fmtScore(c.summary.mean)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </CardBody>
    </Card>
  );
}

/**
 * The no-divergence screen. Everything on it is computed from this run and the other
 * cached party — the ITA° spans, the runner-up gap, the lift over there. There is no
 * hard-coded number and no hedging.
 */
function Agreement({ run }: { run: PartyRun }) {
  const scoring = run.scoring!;
  const winner = scoring.winner;
  const { noun } = nounsOf(run);
  const n = run.bridesmaids.length;

  const here = itaSpan(run);
  const other = datasetOf(run) ? partyDataset(datasetOf(run)!.otherId) : null;
  const otherSpan = other ? itaSpan(other.party) : null;
  const otherScoring = other?.party.scoring;
  const otherLift =
    otherScoring && otherScoring.differsFromByEye
      ? (otherScoring.winner.perPerson.find((p) => p.id === otherScoring.mostHurt.id)?.flatter ??
          0) - otherScoring.mostHurt.flatter
      : 0;

  const runnerUp = scoring.ranked[1];

  return (
    <div className="flex flex-col gap-12">
      <ScreenHeading
        eyebrow="Compare · the two objectives agree"
        title="Both objectives picked the same colour"
        lead={
          <>
            On this party, maximising the <em>worst</em> score and maximising the <em>average</em>{' '}
            land on the same colorway — {winner.colorway.name}. There is no counterfactual here,
            because there is genuinely nothing to counter. This screen shows why rather than staging
            a comparison with itself.
          </>
        }
        trailing={
          <Chip tone="ok" className="justify-end">
            <Swatch color={winner.colorway.hex} label={winner.colorway.name} />
            <span className="text-text-mid">both picks</span>
          </Chip>
        }
      />

      <section aria-labelledby="why-heading">
        <SectionHeading
          id="why-heading"
          title="Why there is nothing to compare"
          note="The objective only bites when the palette genuinely serves someone worse than everyone else. Whether any colorway can is a property of the party, not of the maths."
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardBody className="flex flex-col gap-4 py-6">
              <p className="text-sm leading-relaxed text-text-mid">
                {here ? (
                  <>
                    These {fmtCount(n)} measured skin tones span ITA{' '}
                    <span className="tabular font-mono text-text-hi">{fmtDeg(here.max)}</span> down
                    to <span className="tabular font-mono text-text-hi">{fmtDeg(here.min)}</span> —
                    a range of{' '}
                    <span className="tabular font-mono text-text-hi">{fmtDeg(here.span)}</span>.
                    That is too narrow for any of the {scoring.ranked.length} colorways to single
                    one {noun} out.{' '}
                  </>
                ) : null}
                The colour that lifts the average is already the colour that protects the floor, so
                the two objectives cannot disagree — and OneDress says so instead of inventing a
                disagreement.
              </p>
              {other && otherSpan && otherLift > 0 ? (
                <p className="text-sm leading-relaxed text-text-mid">
                  The divergence appears when a party spans wider. Switch to{' '}
                  <strong className="font-semibold text-text-hi">{other.label}</strong> — ITA{' '}
                  <span className="tabular font-mono text-text-hi">{fmtDeg(otherSpan.max)}</span> to{' '}
                  <span className="tabular font-mono text-text-hi">{fmtDeg(otherSpan.min)}</span>,{' '}
                  <span className="tabular font-mono text-text-hi">{fmtDeg(otherSpan.span)}</span>{' '}
                  wide, more than double this one — and the same engine, unchanged, splits:{' '}
                  {otherScoring!.winner.colorway.name} by max-of-minimum,{' '}
                  {otherScoring!.byEye.colorway.name} by average, and{' '}
                  <span className="tabular font-mono text-text-hi">+{otherLift.toFixed(1)}</span>{' '}
                  for the one the average was quietly sacrificing.
                </p>
              ) : null}
              <p className="text-sm leading-relaxed text-text-mid">
                A tool that reports “your party is close enough that this does not matter” is worth
                more than one that manufactures a dramatic delta every time. The honest claim was
                never “max-of-minimum always beats the average” — it is that when a party spreads
                far enough that no single colour suits everyone, the two diverge, and the difference
                lands on the person the average was sacrificing.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex h-full flex-col justify-center gap-5 py-6">
              <div>
                <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-text-low">
                  The agreed pick
                </p>
                <p className="mt-2 flex items-center gap-3 font-display text-2xl text-text-hi">
                  <span
                    aria-hidden="true"
                    className="inline-block h-8 w-8 shrink-0 rounded-[var(--radius-8)] ring-1 ring-inset ring-white/25"
                    style={{ background: winner.colorway.hex }}
                  />
                  {winner.colorway.name}
                </p>
                <p className="tabular mt-2 font-mono text-xs text-text-mid">
                  floor {fmtScore(winner.groupScore)} · mean {fmtScore(winner.mean)} — the top of
                  both rankings.
                </p>
              </div>
              {runnerUp ? (
                <div className="border-t border-[var(--border-subtle)] pt-4">
                  <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-text-low">
                    Next best floor
                  </p>
                  <p className="mt-2 font-display text-lg text-text-hi">{runnerUp.colorway.name}</p>
                  <p className="tabular mt-1 font-mono text-xs text-text-mid">
                    floor {fmtScore(runnerUp.groupScore)} —{' '}
                    {fmtScore(winner.groupScore - runnerUp.groupScore)} below the pick. Agreement is
                    not a tie: the winner leads on both numbers.
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </section>

      <section aria-labelledby="spread-heading">
        <SectionHeading
          id="spread-heading"
          title="Where the pick lands on everyone"
          note={`One column, not two, because there is only one pick. ${winner.colorway.name} is both the max-of-minimum and the best-on-average choice for this party.`}
        />
        <Spread
          columns={[{ key: 'winner', summary: winner, label: 'Picked by OneDress · and by eye' }]}
          run={run}
        />
      </section>
    </div>
  );
}

export function CompareScreen({ run }: { run: PartyRun }) {
  const cf = counterfactualView(run);
  const scoring = run.scoring;

  if (!scoring) {
    return (
      <ScreenHeading
        eyebrow="Compare"
        title="Nothing to compare"
        lead="This party has not been scored yet."
      />
    );
  }

  // Two different things can leave us without a counterfactual view, and conflating
  // them would be exactly the dishonesty this screen exists to avoid: the objectives
  // genuinely agreeing, or the subject having dropped out of the run.
  if (!cf) {
    if (!scoring.differsFromByEye) return <Agreement run={run} />;
    return (
      <ScreenHeading
        eyebrow="Compare"
        title="The counterfactual subject is missing"
        lead={`The two objectives disagree on this party — ${scoring.byEye.colorway.name} by average, ${scoring.winner.colorway.name} by max-of-minimum — but the person the average hurts most is no longer in the run, so there is nothing to draw.`}
      />
    );
  }

  const meanCost = scoring.byEye.mean - scoring.winner.mean;
  const floorGain = scoring.winner.groupScore - scoring.byEye.groupScore;

  return (
    <div className="flex flex-col gap-12">
      <ScreenHeading
        eyebrow="Compare · what the by-eye pick costs"
        title="One of them pays for the average"
        lead={
          <>
            Pick the colour that looks best <em>on average</em> and you get {cf.byEyeColorway.name}.
            It is a good colour — on four of the six. On {cf.subjectName} it scores{' '}
            <span className="tabular font-mono text-text-hi">{fmtScore(cf.byEyeScore)}</span>, and
            she is the one who wears it all day.
          </>
        }
        trailing={
          <div className="flex flex-col gap-2 text-right">
            <Chip tone="winner" className="tabular justify-end font-mono">
              +{floorGain.toFixed(1)}
              <span className="font-sans text-[0.625rem] font-normal text-text-mid">
                floor gained
              </span>
            </Chip>
            <Chip className="tabular justify-end font-mono">
              −{meanCost.toFixed(1)}
              <span className="font-sans text-[0.625rem] font-normal text-text-mid">
                mean given up
              </span>
            </Chip>
          </div>
        }
      />

      <section aria-labelledby="split-heading">
        <SectionHeading
          id="split-heading"
          title="Same woman, two colours"
          note="Both frames are illustrations of the measured values — her real skin hex against each colorway’s real hex. Live renders replace them in place."
          trailing={
            <Chip>
              <Swatch color={cf.subjectSkinHex} />
              <span className="sr-only">her measured skin hex</span>
            </Chip>
          }
        />
        <CounterfactualSplit {...cf} />
      </section>

      <section aria-labelledby="spread-heading">
        <SectionHeading
          id="spread-heading"
          title="Where each pick lands on everyone"
          note={`${scoring.byEye.colorway.name} wins the average by ${meanCost.toFixed(1)} and loses the floor by ${floorGain.toFixed(1)}. That trade is the entire product.`}
        />
        <Spread
          columns={[
            { key: 'byEye', summary: scoring.byEye, label: 'Picked by eye' },
            { key: 'winner', summary: scoring.winner, label: 'Picked by OneDress' },
          ]}
          run={run}
        />
      </section>
    </div>
  );
}
