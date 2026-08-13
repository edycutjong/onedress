/**
 * The 404. One deploy serves three surfaces — the brochure at `/`, the deck at
 * `/pitch`, the product at `/party` — so the only useful thing a not-found page
 * can do is name all three and hand the visitor to the one they wanted. Anything
 * a judge mistypes lands here, which makes it a real surface: it wears the same
 * wordmark, the same Fraunces/mono pairing and the same button shapes as the app
 * it sits in front of.
 *
 * Server Component on purpose: it holds no state and runs no effects, so there is
 * no reason to ship a kilobyte of client JS to render a signpost.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="border-b border-[var(--border-subtle)] px-4 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-[1240px]">
          {/* Byte-for-byte the shell's wordmark: 32px mark, Fraunces 460 at
              1.22rem, "Dress" as a rose italic. Three surfaces, one logo. */}
          <a href="/" aria-label="OneDress — home" className="flex items-center gap-3 no-underline">
            {/* Plain <img>: a 1KB static SVG needs no optimisation pipeline. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={32} height={32} className="rounded-[9px]" />
            <span className="font-display text-[1.22rem] font-[460] leading-none tracking-[0.01em] text-text-hi">
              One<em className="font-[420] italic text-[var(--primary)]">Dress</em>
            </span>
          </a>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[1240px] flex-1 items-center px-4 py-16 sm:px-6"
      >
        <div className="max-w-2xl">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--primary)]">
            404 · no such page
          </p>
          <h1 className="mt-2 font-display text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.02em] text-text-hi sm:text-[2.75rem]">
            This one isn&rsquo;t in the party.
          </h1>
          <p className="mt-4 max-w-prose text-[1.0625rem] leading-relaxed text-text-mid">
            There is nothing at this address. OneDress is three pages on one deploy, and every one
            of them is one click away: the story of why a single dress color for a whole bridal
            party is a fairness problem, the ten-slide version of that argument, and the working
            product that measures six complexions and picks the color with the best worst case.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/party" className="btn btn--primary no-underline">
              Open the live app
              <span aria-hidden="true">→</span>
            </a>
            <a href="/" className="btn no-underline">
              Back to the landing page
            </a>
            <a href="/pitch" className="btn no-underline">
              See the pitch deck
            </a>
          </div>

          <p className="mt-8 font-mono text-[0.6875rem] leading-relaxed text-text-low">
            / — the landing page · /party — the product · /pitch — the deck
          </p>
        </div>
      </main>

      <footer className="border-t border-[var(--border-subtle)] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <p className="text-xs leading-relaxed text-text-low">
            The app opens on a cached demo party — six measured bridesmaids, zero API units spent,
            no key required.
          </p>
        </div>
      </footer>
    </div>
  );
}
