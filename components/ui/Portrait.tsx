/* eslint-disable @next/next/no-img-element -- the real-photo branch takes an arbitrary
   presigned S3 URL that expires in two hours; next/image would try to optimise and
   cache it. Plain <img> is correct here. */
import { hex as fmtHex } from '@/lib/demo/format';

/**
 * Where a bridesmaid's picture goes.
 *
 * There are no bridesmaid photographs yet, and this app will never invent one. So
 * when `photoUrl` is null it draws an unmistakably diagrammatic bust — a shape
 * filled with her **measured** skin hex, wearing a shape filled with the colorway
 * hex — hatched, and tagged "illustration". It is a picture of the two numbers, not
 * a picture of a person.
 *
 * Passing a real `photoUrl` swaps the whole thing for the photo. That is the only
 * change needed when renders exist: one field in lib/demo/demo-party.ts.
 */

export function Portrait({
  id,
  name,
  skinHex,
  dressHex,
  dressName,
  photoUrl = null,
  className = '',
  showTag = true,
}: {
  /** stable id — namespaces the SVG defs so two portraits never collide */
  id: string;
  name: string;
  skinHex: string;
  dressHex: string;
  dressName: string;
  photoUrl?: string | null;
  className?: string;
  /** thumbnails too small to carry the corner tag legibly turn it off; the hatch,
   *  the flat shapes and the aria-label still say what this is */
  showTag?: boolean;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${name} wearing the ${dressName} colorway, rendered from her full-length photo.`}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const hatchId = `hatch-${id}`;
  const shadeId = `shade-${id}`;
  const description =
    `Illustration, not a photograph: ${name}’s measured skin tone ${fmtHex(skinHex)} ` +
    `with the ${dressName} colorway ${fmtHex(dressHex)}.`;

  return (
    <div className={`relative h-full w-full ${className}`}>
      <svg
        viewBox="0 0 120 160"
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
