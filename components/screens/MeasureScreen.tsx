import type { ReactNode } from 'react';
import type { BridesmaidState, PartyRun } from '@/lib/pipeline/types';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Chip, FitzBadge, Swatch } from '@/components/ui/Chips';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Portrait } from '@/components/ui/Portrait';
import { ScreenHeading, SectionHeading } from '@/components/ui/ScreenHeading';
import { count as fmtCount, countCap as fmtCountCap, hex as fmtHex } from '@/lib/demo/format';
import { nounsOf } from '@/lib/demo/parties';
import { displayName, lineupGridClass } from '@/lib/demo/select';

/**
 * Measure — the screen where the product stops guessing.
 *
 * Three analyzers run per bridesmaid off the same face selfie, and the card shows
 * all three as data: the literal measured hex, the Fitzpatrick roman numeral, and
 * the face shape. Only the hex is load-bearing; the card says so when the other two
 * are missing rather than hiding a degraded read behind a clean-looking card.
 *
 * The demo party is built so the six badges read I, II, III, IV, V, VI — the range
 * the whole product exists to serve, visible in one glance.
 */

const ANALYZERS = [
  { key: 'skin', endpoint: 'skin-tone-analysis', label: 'Skin tone' },
  { key: 'fitz', endpoint: 'fitzpatrick-scale-analyzer', label: 'Fitzpatrick' },
  { key: 'shape', endpoint: 'face-attr-analysis', label: 'Face shape' },
] as const;

function FaceCard({
  bridesmaid,
  index,
  onRetry,
}: {
  bridesmaid: BridesmaidState;
  index: number;
  onRetry?: (id: string) => void;
}) {
  const name = displayName(bridesmaid, index);
  const stage = bridesmaid.measure;
  const m = stage.result;

  const values: Record<string, ReactNode> = {
    skin: m?.skinHex ? <Swatch color={m.skinHex} size={12} /> : undefined,
    fitz: m?.fitzpatrick,
    shape: m?.faceShape,
  };

  return (
    <Card tone={stage.status === 'failed' ? 'warning' : 'default'} stagger={index}>
      <div className="relative aspect-square w-full overflow-hidden bg-black/25">
        {m ? (
          <Portrait
            id={`face-${bridesmaid.id}`}
            name={name}
            skinHex={m.skinHex}
            dressHex="#2a1a24"
            dressName="none"
            crop="face"
            // The frame the three analyzers actually ran on, where it is ours to
            // show. A live run never sets this — an uploaded selfie belongs to the
            // person who uploaded it and is not kept.
            photoUrl={bridesmaid.photoUrl ?? null}
            photoTag="source frame"
            photoAlt={`The photograph ${name} was measured from — skin tone ${fmtHex(m.skinHex)}, Fitzpatrick ${m.fitzpatrick ?? 'not returned'}.`}
          />
        ) : (
          <span
            aria-hidden="true"
            className={`block h-full w-full bg-white/[0.05] ${stage.status === 'running' ? 'shimmer' : ''}`}
          />
        )}
        {stage.status === 'running' ? (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-6 text-[0.6875rem] text-text-mid">
            Measuring {name}…
          </span>
        ) : null}
      </div>

      <CardHeader
        title={name}
        trailing={<FitzBadge numeral={m?.fitzpatrick} skinHex={m?.skinHex} />}
        className="pt-3"
      />

      <CardBody className="pb-3 pt-2">
        <dl className="flex flex-col gap-1.5 text-xs">
          {ANALYZERS.map((a) => {
            const value = values[a.key];
            return (
              <div key={a.key} className="flex items-baseline justify-between gap-2">
                <dt className="text-text-mid" title={a.endpoint}>
                  {a.label}
                </dt>
                <dd className="tabular flex items-center gap-1.5 font-mono text-text-hi">
                  {value ?? (
                    <span className="text-text-low" title={`${a.endpoint} returned no value`}>
                      n/a
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardBody>

      {stage.status === 'failed' && stage.error ? (
        <CardBody className="pt-0">
          <ErrorNote error={stage.error} onAction={onRetry && (() => onRetry(bridesmaid.id))} />
        </CardBody>
      ) : null}

      {m && !m.faceShape ? (
        <CardFooter>
          <Chip
            tone="warning"
            title="No face shape on record, so the earring silhouette falls back to a hoop. Only the skin hex is load-bearing — this person is still fully scored."
          >
            hoop fallback
          </Chip>
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function MeasureScreen({ run }: { run: PartyRun }) {
  const measured = run.bridesmaids.filter((b) => b.measure.status === 'done');
  const n = run.bridesmaids.length;
  const { noun } = nounsOf(run);

  return (
    <div className="flex flex-col gap-12">
      <ScreenHeading
        eyebrow="Measure · real skin hex + Fitzpatrick I–VI"
        title={`${fmtCountCap(n)} measurements, not ${fmtCount(n)} opinions`}
        lead={
          <>
            One face photo each, three analyzers per person:{' '}
            <code className="font-mono text-text-hi">skin-tone-analysis</code> for the hex that
            drives every score,{' '}
            <code className="font-mono text-text-hi">fitzpatrick-scale-analyzer</code> as an
            independent depth cross-check, and{' '}
            <code className="font-mono text-text-hi">face-attr-analysis</code> for the earring
            silhouette. Only the first is required — the card says so when the others come back
            empty.
          </>
        }
        trailing={
          <Chip tone={measured.length === run.bridesmaids.length ? 'ok' : 'warning'}>
            {measured.length}/{run.bridesmaids.length} measured
          </Chip>
        }
      />

      <section aria-labelledby="ramp-heading">
        <SectionHeading
          id="ramp-heading"
          title="The range this party actually covers"
          note="Every measured hex, in Fitzpatrick order. This strip is the reason the average is the wrong objective."
        />
        <Card>
          <CardBody className="flex flex-wrap gap-3">
            {run.bridesmaids.map((b, i) => {
              const m = b.measure.result;
              if (!m) return null;
              return (
                <div key={b.id} className="flex min-w-[7.5rem] flex-1 flex-col gap-2">
                  <span
                    aria-hidden="true"
                    className="h-12 w-full rounded-[var(--radius-8)] ring-1 ring-inset ring-white/20"
                    style={{ background: m.skinHex }}
                  />
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-text-hi">
                      {m.fitzpatrick ?? '—'}
                    </span>
                    <span className="tabular font-mono text-[0.6875rem] text-text-mid">
                      {fmtHex(m.skinHex)}
                    </span>
                  </span>
                  <span className="sr-only">
                    {displayName(b, i)}, Fitzpatrick {m.fitzpatrick ?? 'unknown'}, measured hex{' '}
                    {fmtHex(m.skinHex)}
                  </span>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="cards-heading">
        <SectionHeading
          id="cards-heading"
          title={`Every reading, per ${noun}`}
          note="Nothing here is rounded, averaged or prettified — it is what the API returned."
        />
        <div className={lineupGridClass(run.bridesmaids.length)}>
          {run.bridesmaids.map((b, i) => (
            <FaceCard key={b.id} bridesmaid={b} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
