import type { ColorwaySummary, PartyRun } from '@/lib/pipeline/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip, FitzBadge, Swatch } from '@/components/ui/Chips';
import { CounterfactualSplit } from '@/components/ui/CounterfactualSplit';
import { ScoreBar } from '@/components/ui/Score';
import { ScreenHeading, SectionHeading } from '@/components/ui/ScreenHeading';
import { score as fmtScore } from '@/lib/demo/format';
import { counterfactualView, displayName, flatterOf } from '@/lib/demo/select';

/**
 * Compare — the counterfactual, standing on its own before the render cascade.
 *
 * This is the screen that converts "trust the maths" into "see the difference", so
 * it does two things and nothing else: the split (one woman, two colours, two
 * numbers), then the spread — where each pick lands on all six, which is the whole
 * argument in one table. The by-eye pick wins on average and ruins one person; the
 * fair pick gives up 0.9 of a point of average to lift the floor by 19.
 */

function Spread({
  byEye,
  winner,
  run,
}: {
  byEye: ColorwaySummary;
  winner: ColorwaySummary;
  run: PartyRun;
}) {
  const columns = [
    { key: 'byEye', summary: byEye, label: 'Picked by eye' },
    { key: 'winner', summary: winner, label: 'Picked by OneDress' },
  ] as const;

  return (
    <Card>
      <CardBody className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">
            Flatter score for every bridesmaid under the by-eye pick ({byEye.colorway.name}) and the
            OneDress pick ({winner.colorway.name}).
          </caption>
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th scope="col" className="w-40 py-2 pr-4 text-left font-medium text-text-mid">
                Bridesmaid
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

export function CompareScreen({ run }: { run: PartyRun }) {
  const cf = counterfactualView(run);
  const scoring = run.scoring;

  if (!scoring || !cf) {
    return (
      <ScreenHeading
        eyebrow="Compare"
        title="Nothing to compare"
        lead={
          scoring
            ? 'For this party the max-of-minimum pick and the best-on-average pick are the same colour. There is no counterfactual, and manufacturing one would be dishonest.'
            : 'This party has not been scored yet.'
        }
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
        <Spread byEye={scoring.byEye} winner={scoring.winner} run={run} />
      </section>
    </div>
  );
}
