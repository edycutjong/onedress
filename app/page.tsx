export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="font-mono text-sm text-accent">OneDress</p>
      <h1 className="font-display text-4xl font-semibold leading-tight text-text-hi">
        Six bridesmaids, six skin tones, one dress color.
      </h1>
      <p className="max-w-xl text-lg text-text-mid">
        Measure each bridesmaid’s real skin hex and Fitzpatrick depth, find the single color where{' '}
        <em>no one is anyone’s worst option</em>, and render it photorealistically on every
        bridesmaid at once.
      </p>
      <p className="font-mono text-xs text-text-low">
        Scaffold live. The 7-step flow lands in Phase&nbsp;2.
      </p>
    </main>
  );
}
