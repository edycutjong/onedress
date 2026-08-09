import type { Colorway } from '@/lib/colorway/data';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Chip, FitzBadge, Swatch } from '@/components/ui/Chips';
import { Portrait } from '@/components/ui/Portrait';
import { ScoreDial } from '@/components/ui/Score';
import { score as fmtScore, signed } from '@/lib/demo/format';
import type { CounterfactualView } from '@/lib/demo/select';

/**
 * The counterfactual: the same bridesmaid, in the colour today's method picks, and
 * in the colour OneDress picks. Two colours, one woman, two numbers.
 *
 * It appears twice by design — alone as the Compare screen, then recapped inside the
 * verdict — so the proof lands on its own and again in context.
 */

export interface CounterfactualProps extends CounterfactualView {
  /** her real render in the by-eye colour, once one exists */
  photoByEye?: string | null;
  /** her real render in the winning colour, once one exists */
  photoWinner?: string | null;
}

function Side({
  side,
  eyebrow,
  colorway,
  value,
  dialLabel,
  props,
  dialColor,
  photo,
}: {
  side: 'by-eye' | 'winner';
  eyebrow: string;
  colorway: Colorway;
  value: number;
  dialLabel: string;
  props: CounterfactualProps;
  dialColor: string;
  photo?: string | null;
}) {
  return (
    <Card tone={side === 'winner' ? 'winner' : 'default'} className="flex-1">
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Portrait
          id={`cf-${side}-${props.subjectId}`}
          name={props.subjectName}
          skinHex={props.subjectSkinHex}
          dressHex={colorway.hex}
          dressName={colorway.name}
          photoUrl={photo ?? null}
        />
      </div>
      <CardHeader
        eyebrow={eyebrow}
        title={colorway.name}
        trailing={
          <Chip>
            <Swatch color={colorway.hex} size={16} />
          </Chip>
        }
      />
      <CardBody className="flex items-center gap-4">
        <ScoreDial value={value} label={dialLabel} size="lg" color={dialColor} />
        <p className="text-sm leading-snug text-text-mid">
          {side === 'by-eye' ? (
            <>
              How the colour gets picked today: whatever looks best <em>on average</em>. It scores{' '}
              <span className="tabular font-mono text-text-hi">{fmtScore(value)}</span> on{' '}
              {props.subjectName} — the lowest score in the party.
            </>
          ) : (
            <>
              OneDress maximises the <em>minimum</em>. The same woman, the same measurement, scores{' '}
              <span className="tabular font-mono text-text-hi">{fmtScore(value)}</span> — and nobody
              else drops below the floor to pay for it.
            </>
          )}
        </p>
      </CardBody>
    </Card>
  );
}

export function CounterfactualSplit(props: CounterfactualProps) {
  const lift = props.winnerScore - props.byEyeScore;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="font-display text-xl text-text-hi">{props.subjectName}</p>
        <FitzBadge numeral={props.subjectFitzpatrick} skinHex={props.subjectSkinHex} />
        <Chip>
          <Swatch color={props.subjectSkinHex} />
          <span className="sr-only">measured skin hex</span>
        </Chip>
        <Chip tone="winner" className="tabular font-mono">
          {signed(lift)}
          <span className="font-sans text-[0.625rem] font-normal text-text-mid">
            flatter, same woman
          </span>
        </Chip>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <Side
          side="by-eye"
          eyebrow="Picked by eye · best on average"
          colorway={props.byEyeColorway}
          value={props.byEyeScore}
          dialLabel="her flatter score"
          dialColor="var(--color-warning)"
          props={props}
          photo={props.photoByEye}
        />
        <div
          aria-hidden="true"
          className="flex items-center justify-center px-1 font-display text-2xl text-text-low md:flex-col"
        >
          →
        </div>
        <Side
          side="winner"
          eyebrow="Picked by OneDress · max-of-minimum"
          colorway={props.winnerColorway}
          value={props.winnerScore}
          dialLabel="her flatter score"
          dialColor="var(--winner)"
          props={props}
          photo={props.photoWinner}
        />
      </div>
    </div>
  );
}

/** The compact recap that sits inside the verdict, under the guarantee. */
export function CounterfactualRecap(props: CounterfactualProps) {
  const lift = props.winnerScore - props.byEyeScore;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {(
        [
          ['by eye', props.byEyeColorway, props.byEyeScore],
          ['OneDress', props.winnerColorway, props.winnerScore],
        ] as const
      ).map(([label, colorway, value]) => (
        <div key={label} className="flex items-center gap-3">
          <div className="h-[4.5rem] w-14 shrink-0 overflow-hidden rounded-[var(--radius-8)]">
            <Portrait
              id={`recap-${label.replace(/\s/g, '')}-${props.subjectId}`}
              name={props.subjectName}
              skinHex={props.subjectSkinHex}
              dressHex={colorway.hex}
              dressName={colorway.name}
              showTag={false}
            />
          </div>
          <div>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-low">
              {label}
            </p>
            <p className="font-display text-base text-text-hi">{colorway.name}</p>
            <p className="tabular font-mono text-sm text-text-mid">{fmtScore(value)}</p>
          </div>
        </div>
      ))}
      <p className="max-w-xs text-sm leading-snug text-text-mid">
        Same woman, same measured skin tone, two colours:{' '}
        <span className="tabular font-mono text-text-hi">{signed(lift)}</span> flatter under the
        max-of-minimum pick.
      </p>
    </div>
  );
}
