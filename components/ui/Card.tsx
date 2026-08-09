import type { CSSProperties, ReactNode } from 'react';

/**
 * THE card. Face cards, colorway cards and render cards are all this component —
 * that shared silhouette is what makes six screens read as one product rather than
 * six pages (design.md §Design language, "one card component, three data states").
 *
 * Anatomy: header row (eyebrow / title / trailing chip) · body · footer chip row.
 * Tone only ever changes the border and the wash — never the geometry — so a card
 * that flips from pending to winner does not move a pixel.
 */

export type CardTone = 'default' | 'winner' | 'muted' | 'warning';

const TONE: Record<CardTone, string> = {
  default: 'surface',
  winner: 'surface surface--winner',
  muted: 'surface surface--muted',
  warning: 'surface surface--warning',
};

export interface CardProps {
  tone?: CardTone;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** index in a list — drives the entrance stagger, capped so nothing feels slow */
  stagger?: number;
}

export function Card({ tone = 'default', className = '', style, children, stagger }: CardProps) {
  const staggerStyle =
    stagger === undefined
      ? style
      : ({ ...style, '--stagger': `${Math.min(stagger, 6) * 55}ms` } as CSSProperties);

  return (
    <div
      className={[
        'relative flex flex-col overflow-hidden rounded-[var(--radius-16)] border',
        'shadow-[var(--shadow-md)] backdrop-blur-[2px] transition-colors duration-200',
        TONE[tone],
        stagger === undefined ? '' : 'rise',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={staggerStyle}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  eyebrow,
  title,
  trailing,
  className = '',
  titleClassName = 'text-lg',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
  className?: string;
  /** dense grids drop the title a step so long colorway names still fit */
  titleClassName?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 px-5 pt-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-text-low">
            {eyebrow}
          </p>
        ) : null}
        <div className={`truncate font-display leading-tight text-text-hi ${titleClassName}`}>
          {title}
        </div>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-3 ${className}`}
    >
      {children}
    </div>
  );
}
