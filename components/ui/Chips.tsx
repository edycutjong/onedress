import type { ReactNode } from 'react';
import { hex as fmtHex, inkOn } from '@/lib/demo/format';

/**
 * The small data carriers. Every measured value is shown AS DATA (design.md §Trust
 * & legibility): the hex printed literally, Fitzpatrick as a roman numeral, ΔE as a
 * number — never a colour swatch on its own, which would encode meaning in colour.
 */

export type ChipTone = 'default' | 'winner' | 'warning' | 'ok';

const CHIP_TONE: Record<ChipTone, string> = {
  default: 'chip',
  winner: 'chip chip--winner',
  warning: 'chip chip--warning',
  ok: 'chip chip--ok',
};

export function Chip({
  tone = 'default',
  className = '',
  title,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={`${CHIP_TONE[tone]} ${className}`} title={title}>
      {children}
    </span>
  );
}

/** A colour square with its hex printed beside it. */
export function Swatch({
  color,
  size = 14,
  label,
}: {
  color: string;
  size?: number;
  /** overrides the printed hex — pass a colorway name when the hex is shown elsewhere */
  label?: string;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-block shrink-0 rounded-[3px] ring-1 ring-inset ring-white/25"
        style={{ width: size, height: size, background: color }}
      />
      <span className="tabular font-mono">{label ?? fmtHex(color)}</span>
    </>
  );
}

/** Measured skin hex — the single most load-bearing value in the app. */
export function HexChip({ value, label = 'measured' }: { value: string; label?: string }) {
  return (
    <Chip>
      <Swatch color={value} />
      <span className="sr-only">{label} skin hex</span>
    </Chip>
  );
}

/**
 * The Fitzpatrick badge. Roman numerals I–VI, filled with the measured hex so the
 * six badges together read as the tone ramp — inclusivity visible at a glance.
 */
export function FitzBadge({ numeral, skinHex }: { numeral?: string; skinHex?: string }) {
  if (!numeral) {
    return (
      <Chip tone="warning">
        <span>Fitzpatrick n/a</span>
      </Chip>
    );
  }
  return (
    <span
      className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-[var(--radius-full)] px-2 font-mono text-xs font-semibold ring-1 ring-inset ring-white/25"
      style={skinHex ? { background: skinHex, color: inkOn(skinHex) } : { color: 'var(--text-hi)' }}
      title={`Fitzpatrick type ${numeral}`}
    >
      <span aria-hidden="true">{numeral}</span>
      <span className="sr-only">Fitzpatrick type {numeral}</span>
    </span>
  );
}
