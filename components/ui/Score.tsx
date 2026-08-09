import { score as fmtScore } from '@/lib/demo/format';

/**
 * Flatter scores, 0–100. Always drawn as ring **plus number plus label** — never
 * colour alone (design.md §Trust & legibility, and the AA gate). The ring is a
 * plain stroke-dasharray arc: no chart library, no runtime cost.
 */

const SIZES = {
  sm: { box: 46, stroke: 4, text: 'text-sm' },
  md: { box: 68, stroke: 5, text: 'text-lg' },
  lg: { box: 104, stroke: 7, text: 'text-3xl' },
} as const;

export type ScoreSize = keyof typeof SIZES;

export function ScoreDial({
  value,
  label,
  size = 'md',
  color = 'var(--winner)',
}: {
  value: number;
  /** what the number means, e.g. "group floor" — read out to screen readers too */
  label: string;
  size?: ScoreSize;
  color?: string;
}) {
  const { box, stroke, text } = SIZES[size];
  const r = (box - stroke) / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: box, height: box }}>
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={stroke}
          />
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
          />
        </svg>
        <span
          className={`tabular absolute inset-0 flex items-center justify-center font-mono font-semibold text-text-hi ${text}`}
          aria-hidden="true"
        >
          {fmtScore(value)}
        </span>
      </div>
      <figcaption className="text-center text-[0.6875rem] leading-tight text-text-mid">
        <span className="sr-only">
          {fmtScore(value)} out of 100 — {label}.{' '}
        </span>
        <span aria-hidden="true">{label}</span>
      </figcaption>
    </figure>
  );
}

/**
 * The per-person bar used wherever six people are compared at once. Same rule:
 * the number is printed, the bar is decoration.
 */
export function ScoreBar({
  value,
  color = 'var(--winner)',
  className = '',
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`relative block h-2 w-full overflow-hidden rounded-[var(--radius-full)] bg-white/10 ${className}`}
      aria-hidden="true"
    >
      <span
        className="absolute inset-y-0 left-0 rounded-[var(--radius-full)] transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </span>
  );
}
