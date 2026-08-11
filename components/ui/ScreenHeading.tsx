import type { ReactNode } from 'react';

/**
 * Every screen opens the same way: a mono eyebrow that names the step, one h1, and
 * one line of plain-language lead. Exactly one h1 per screen — the heading order is
 * part of the accessibility gate, not decoration.
 */
export function ScreenHeading({
  eyebrow,
  title,
  lead,
  trailing,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-2xl">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--primary)]">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.02em] text-text-hi sm:text-[2.75rem]">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 max-w-prose text-[1.0625rem] leading-relaxed text-text-mid">{lead}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </header>
  );
}

/** Section heading inside a screen — always an h2, always labelled. */
export function SectionHeading({
  id,
  title,
  note,
  trailing,
}: {
  id: string;
  title: string;
  note?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h2 id={id} className="font-display text-[1.375rem] tracking-[-0.01em] text-text-hi">
          {title}
        </h2>
        {note ? <p className="mt-1 max-w-2xl text-sm leading-snug text-text-mid">{note}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
