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
};

export default nextConfig;
