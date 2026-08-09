/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Rendered try-on results are served from Perfect Corp's S3/CDN.
    remotePatterns: [
      { protocol: 'https', hostname: '**.makeupar.com' },
      { protocol: 'https', hostname: '**.perfectcorp.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },

  /**
   * One deploy, three surfaces.
   *
   * The marketing landing page and the pitch deck are hand-written single-file
   * HTML that predate the app; they live in `public/` and are served as-is. The
   * product is the Next app at `/party`. These rewrites give both static pages a
   * clean URL:
   *
   *   /       → public/landing.html   (the brochure; CTA into /party)
   *   /pitch  → public/pitch.html     (10-slide deck)
   *   /party  → app/party/page.tsx    (the product)
   *
   * `beforeFiles` matters: it runs ahead of the filesystem check, which is what
   * lets `/` resolve to a public file at all — there is deliberately no
   * `app/page.tsx`.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/landing.html' },
        { source: '/pitch', destination: '/pitch.html' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  // Carried over from the standalone site's vercel.json so the consolidated
  // deploy keeps the same response headers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
