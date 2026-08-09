import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

/**
 * Type is self-hosted through next/font (no third-party request, no layout shift).
 * The three families are exactly the ones every other shipped OneDress surface uses
 * — icon, OG image, README hero, landing page — so the product reads as one thing.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

const TITLE = 'OneDress — one color, every complexion';
const DESCRIPTION =
  'Measure each bridesmaid’s real skin tone and find the single dress color that provably flatters the whole party — then render it on everyone at once.';

export const metadata: Metadata = {
  metadataBase: new URL('https://onedress.edycu.dev'),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'OneDress',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OneDress' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
