import type { PartyRun, StageStatus } from '@/lib/pipeline/types';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip, Swatch } from '@/components/ui/Chips';
import { RenderTile } from '@/components/ui/RenderTile';
import { ScreenHeading, SectionHeading } from '@/components/ui/ScreenHeading';
import { countCap as fmtCountCap, hex as fmtHex } from '@/lib/demo/format';
import { nounsOf, renderNoteOf } from '@/lib/demo/parties';
import { flatterOf, lineupGridClass } from '@/lib/demo/select';

/**
 * Render — six cards that exist as **skeletons in their final position** before a
 * single image arrives, so when one lands it fills in place and nothing on the page
 * moves. That zero-reflow property is the whole design of this screen.
 *
 * The synthetic demo party has no renders, and this screen says so plainly rather
 * than dressing up an illustration as a result: those cards sit in the `skipped`
 * state with the reference swatch pinned and the ΔE badge empty. The measured party
 * does have real `cloth-v3` output, and one card in it is `failed` with the API's own
 * `error_pose` — that card stays in the cascade rather than being quietly dropped.
 */

const STATUS_COPY: Partial<Record<StageStatus, string>> = {
  pending: 'queued',
  running: 'rendering',
  done: 'rendered',
  failed: 'needs a re-shoot',
  skipped: 'not run',
};

export function RenderScreen({ run, onRetry }: { run: PartyRun; onRetry?: (id: string) => void }) {
  const scoring = run.scoring;

  if (!scoring) {
    return (
      <ScreenHeading
        eyebrow="Render"
        title="No colour chosen yet"
        lead="There is nothing to render until the party has been measured and scored."
      />
    );
  }

  const winner = scoring.winner;
  const { noun } = nounsOf(run);
  const counts = run.bridesmaids.reduce<Record<string, number>>((acc, b) => {
    acc[b.render.status] = (acc[b.render.status] ?? 0) + 1;
    return acc;
  }, {});
  const delivered = counts.done ?? 0;

  return (
    <div className="flex flex-col gap-12">
      <ScreenHeading
        eyebrow="Render · the winning colour on everyone"
        title={`${fmtCountCap(run.bridesmaids.length)} try-ons in ${winner.colorway.name}`}
        lead={
          <>
            Each {noun}’s photo goes to <code className="font-mono text-text-hi">cloth-v3</code>{' '}
            against the same reference garment, so every frame in the lineup is the same colour by
            construction — not the same colour by eye.
          </>
        }
        trailing={
          <div className="flex flex-wrap justify-end gap-2">
            {Object.entries(counts).map(([status, n]) => (
              <Chip key={status} tone={status === 'failed' ? 'warning' : 'default'}>
                <span className="tabular font-mono text-text-hi">{n}</span>
                {STATUS_COPY[status as StageStatus] ?? status}
              </Chip>
            ))}
          </div>
        }
      />

      <section aria-labelledby="cascade-heading">
        <SectionHeading
          id="cascade-heading"
          title="The cascade"
          note={renderNoteOf(run)}
          trailing={
            <Chip tone="winner">
              <Swatch
                color={winner.colorway.hex}
                label={`reference ${fmtHex(winner.colorway.hex)}`}
              />
            </Chip>
          }
        />
        <div className={lineupGridClass(run.bridesmaids.length)}>
          {run.bridesmaids.map((b, i) => (
            <RenderTile
              key={b.id}
              bridesmaid={b}
              index={i}
              colorway={winner.colorway}
              flatter={flatterOf(winner, b.id)}
              mode="render"
              onRetry={onRetry}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="fidelity-heading">
        <SectionHeading
          id="fidelity-heading"
          title="How the colour is checked"
          note="A render that comes back the wrong colour would quietly invalidate every score on the verdict screen, so fidelity is measured rather than trusted."
        />
        <Card>
          <CardBody className="grid gap-6 py-5 md:grid-cols-3">
            <div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-low">
                Reference
              </p>
              <p className="mt-2 flex items-center gap-2 font-display text-lg text-text-hi">
                <span
                  aria-hidden="true"
                  className="inline-block h-6 w-6 rounded-[var(--radius-4)] ring-1 ring-inset ring-white/25"
                  style={{ background: winner.colorway.hex }}
                />
                {winner.colorway.name}
              </p>
              <p className="tabular mt-1 font-mono text-xs text-text-mid">
                {fmtHex(winner.colorway.hex)} — the same garment file for all{' '}
                {run.bridesmaids.length}, uploaded once and reused by file id.
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-low">
                Delivered
              </p>
              <p className="mt-2 font-display text-lg text-text-hi">
                {delivered > 0 ? `${delivered} real renders` : 'Awaiting a live run'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-mid">
                {delivered > 0
                  ? 'These frames came back from cloth-v3, but the ΔE badge is still empty: sampling the delivered garment colour is not wired into the app yet, and an estimate would be worse than a blank.'
                  : 'Each card carries a ΔE badge that stays empty until there is a real render to sample. No render, no number — the badge is never filled with an estimate.'}
              </p>
            </div>
            <div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-text-low">
                Then earrings
              </p>
              <p className="mt-2 font-display text-lg text-text-hi">A second, optional pass</p>
              <p className="mt-1 text-xs leading-relaxed text-text-mid">
                Metal comes from the measured undertone, silhouette from the face shape. If the
                chain fails, the dress render stands as the final image and the verdict is
                unaffected — earrings are the finishing touch, not the deliverable.
              </p>
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
