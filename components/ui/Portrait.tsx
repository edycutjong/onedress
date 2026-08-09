/* eslint-disable @next/next/no-img-element -- the real-photo branch takes an arbitrary
   presigned S3 URL that expires in two hours; next/image would try to optimise and
   cache it. Plain <img> is correct here. */
import { hex as fmtHex } from '@/lib/demo/format';

/**
 * Where a party member's picture goes — and, more importantly, the one place that
 * decides what an image on this screen is allowed to claim to be.
 *
 * Every frame carries a corner tag naming what it actually is, and the tag is not
 * optional decoration:
 *
 *   no photoUrl   an unmistakably diagrammatic bust — a shape filled with the
 *                 **measured** skin hex wearing a shape filled with the colorway hex,
 *                 hatched and tagged "illustration". A picture of two numbers, not
 *                 of a person. The synthetic demo party is entirely this, because
 *                 those six are reference profiles rather than people.
 *   photoUrl      a real photograph, tagged with what it is via `photoTag` — a
 *                 measured source frame, or a cloth-v3 render of one. Callers must
 *                 pass a truthful `photoAlt`: this component cannot know whether it
 *                 was handed a render or the frame the analyzers ran on.
 */

export function Portrait({
  id,
  name,
  skinHex,
  dressHex,
  dressName,
  photoUrl = null,
  photoAlt,
  photoTag = 'photograph',
  className = '',
  showTag = true,
  crop = 'figure',
}: {
  /** stable id — namespaces the SVG defs so two portraits never collide */
  id: string;
  name: string;
  skinHex: string;
  dressHex: string;
  dressName: string;
  photoUrl?: string | null;
  /** what the photograph actually shows — required reading for a screen reader, and
   *  the reason this component never guesses on the caller's behalf */
  photoAlt?: string;
  /** the corner tag on a real photograph, e.g. "cloth-v3 render" or "source frame" */
  photoTag?: string;
  className?: string;
  /** thumbnails too small to carry the corner tag legibly turn it off; the hatch,
   *  the flat shapes and the aria-label still say what this is */
  showTag?: boolean;
  /** 'face' zooms the same drawing onto the head — the measure cards are about the
   *  skin reading, not the dress, so they crop to it rather than use a second asset */
  crop?: 'figure' | 'face';
}) {
  if (photoUrl) {
    return (
      <div className={`relative h-full w-full ${className}`}>
        <img
          src={photoUrl}
          alt={photoAlt ?? `${name} wearing the ${dressName} colorway, rendered from a real photo.`}
          className="h-full w-full object-cover"
        />
        {showTag ? (
          <span
            aria-hidden="true"
            className="absolute left-2 top-2 rounded-[var(--radius-4)] bg-black/55 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-text-mid backdrop-blur-sm"
          >
            {photoTag}
          </span>
        ) : null}
      </div>
    );
  }

  const hatchId = `hatch-${id}`;
  const shadeId = `shade-${id}`;
  const description =
    crop === 'face'
      ? `Illustration, not a photograph: ${name}’s measured skin tone ${fmtHex(skinHex)}.`
      : `Illustration, not a photograph: ${name}’s measured skin tone ${fmtHex(skinHex)} ` +
        `with the ${dressName} colorway ${fmtHex(dressHex)}.`;

  return (
    <div className={`relative h-full w-full ${className}`}>
      <svg
        viewBox={crop === 'face' ? '22 16 76 76' : '0 0 120 160'}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        role="img"
        aria-label={description}
      >
        <defs>
          <pattern id={hatchId} width="7" height="7" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
          <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
          </linearGradient>
        </defs>

        <rect width="120" height="160" fill="#1b0f18" />
        <rect width="120" height="160" fill={`url(#${hatchId})`} />

        {/* neck first, so the bodice overlaps it the way a neckline does */}
        <path d="M52 68 h16 v26 q-8 4 -16 0 Z" fill={skinHex} />
        {/* the dress — the colorway under test: shoulder line into a floor-length skirt */}
        <path
          d="M34 100 C38 89 48 86 60 86 C72 86 82 89 86 100 L96 160 L24 160 Z"
          fill={dressHex}
        />
        {/* head — her measured skin hex */}
        <ellipse cx="60" cy="52" rx="19" ry="24" fill={skinHex} />
        {/* one soft form pass so the shapes read as a figure, not a logo */}
        <rect width="120" height="160" fill={`url(#${shadeId})`} />
      </svg>

      {showTag ? (
        <span
          aria-hidden="true"
          className="absolute left-2 top-2 rounded-[var(--radius-4)] bg-black/55 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-text-mid backdrop-blur-sm"
        >
          illustration
        </span>
      ) : null}
    </div>
  );
}
