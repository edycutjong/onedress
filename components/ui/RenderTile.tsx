import type { Colorway } from '@/lib/colorway/data';
import type { BridesmaidState } from '@/lib/pipeline/types';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { Chip, FitzBadge, Swatch } from '@/components/ui/Chips';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Portrait } from '@/components/ui/Portrait';
import { ScoreBar } from '@/components/ui/Score';
import { score as fmtScore, hex as fmtHex } from '@/lib/demo/format';

/**
 * One bridesmaid in the winning colorway — the tile the render cascade and the
 * verdict lineup are both made of. Same component, same geometry, two modes:
 *
 *   lineup  the composed payoff — identical crop, shared baseline, one photograph
 *           of one wedding in one colour
 *   render  the same tile as a SKELETON IN ITS FINAL POSITION, plus the reference
 *           swatch and the ΔE slot. When a render lands it fills in place; nothing
 *           reflows, which is the single detail that separates premium from dev-dump
 */

export function RenderTile({
  bridesmaid,
  index,
  colorway,
  flatter,
  mode = 'lineup',
  onRetry,
}: {
  bridesmaid: BridesmaidState;
  index: number;
  colorway: Colorway;
  /** her flatter score under this colorway, if she was measured */
  flatter?: number;
  mode?: 'lineup' | 'render';
  onRetry?: (id: string) => void;
}) {
  const name = bridesmaid.name ?? `Bridesmaid ${index + 1}`;
  const measurement = bridesmaid.measure.result;
  const stage = bridesmaid.render;
  const failed = stage.status === 'failed' && stage.error;
  const rendered = stage.status === 'done' ? bridesmaid.finalUrl : undefined;
  const pending = !rendered && !failed;

  return (
    <Card tone={failed ? 'warning' : 'default'} stagger={index}>
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/25">
        {measurement ? (
          // h-full is load-bearing: without it a landscape source frame sizes to its
          // own aspect ratio and leaves a dead band under the picture instead of
          // filling the 3:4 slot.
          <div className={`h-full w-full ${mode === 'render' && pending ? 'opacity-45' : ''}`}>
            <Portrait
              id={`${mode}-${bridesmaid.id}`}
              name={name}
              skinHex={measurement.skinHex}
              dressHex={colorway.hex}
              dressName={colorway.name}
              photoUrl={rendered ?? null}
              photoTag="cloth-v3 render"
              photoAlt={`${name}, photographed and then rendered by cloth-v3 wearing the ${colorway.name} colorway.`}
            />
          </div>
        ) : (
          <div className="h-full w-full bg-white/[0.04]" />
        )}

        {mode === 'render' && pending ? (
          <>
            <span aria-hidden="true" className="shimmer absolute inset-0" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-6 text-[0.6875rem] text-text-mid">
              {stage.status === 'skipped'
                ? 'No render in the cached party — a live run fills this frame.'
                : `Rendering on ${name}…`}
            </span>
          </>
        ) : null}
      </div>

      <CardHeader
        title={name}
        eyebrow={mode === 'render' ? `slot ${index + 1}` : undefined}
        trailing={<FitzBadge numeral={measurement?.fitzpatrick} skinHex={measurement?.skinHex} />}
        // A seven-up lineup leaves each tile ~150px wide; at text-lg the name and the
        // Fitzpatrick badge cannot both fit and the name truncates to "Perso…".
        titleClassName="text-base"
        className="pt-3"
      />

      <CardBody className="pb-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {measurement ? (
            <Chip>
              <Swatch color={measurement.skinHex} />
              <span className="sr-only">measured skin hex</span>
            </Chip>
          ) : null}
          {flatter === undefined ? null : (
            <Chip tone="winner" className="tabular font-mono">
              {fmtScore(flatter)}
              <span className="font-sans text-[0.625rem] font-normal text-text-mid">flatter</span>
            </Chip>
          )}
        </div>
        {flatter === undefined ? null : <ScoreBar value={flatter} className="mt-2.5" />}
        {measurement && !measurement.faceShape ? (
          <Chip
            tone="warning"
            className="mt-2.5"
            title="No face shape on record, so the earring silhouette falls back to a hoop. Skin hex, Fitzpatrick and every score are unaffected."
          >
            hoop fallback
          </Chip>
        ) : null}
      </CardBody>

      {/* The render screen is where a failure is actionable, so it gets the full note
          with its re-shoot guidance. The verdict lineup is a composed six-up frame:
          the same failure there is still stated, but as a chip, because a card that
          grows three times taller than its neighbours wrecks the one image the whole
          flow is building towards. */}
      {failed ? (
        <CardBody className="pt-0">
          {mode === 'render' ? (
            <ErrorNote error={stage.error!} onAction={onRetry && (() => onRetry(bridesmaid.id))} />
          ) : (
            <div>
              <Chip tone="warning" title={stage.error!.guidance}>
                no render
              </Chip>
              {/* The raw code on its own line: a chip wide enough to hold both would
                  overflow a lineup tile, and the code is the part a judge can check. */}
              <p className="mt-1.5 font-mono text-[0.625rem] text-text-low">{stage.error!.code}</p>
            </div>
          )}
        </CardBody>
      ) : null}

      {mode === 'render' ? (
        <CardFooter className="justify-between">
          <Chip>
            <Swatch color={colorway.hex} label={`ref ${fmtHex(colorway.hex)}`} />
          </Chip>
          <Chip title="CIE2000 distance between the reference garment colour and the delivered render">
            <span className="tabular font-mono">ΔE —</span>
            <span className="text-text-low">
              {rendered
                ? 'not measured in-app'
                : failed
                  ? 'no render to sample'
                  : 'awaiting render'}
            </span>
          </Chip>
        </CardFooter>
      ) : null}
    </Card>
  );
}
