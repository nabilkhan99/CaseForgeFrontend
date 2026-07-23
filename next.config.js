/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Baked at build time so ?voicedebug=1 logs can prove which commit is
    // actually deployed (stale preview builds cost us two debug rounds).
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: true,
    domains: ['case-forge-frontend-n5fd.vercel.app','www.fourteenfisherman.com'],
  },
  async rewrites() {
    // Only proxy the Azure Functions (portfolio tool) routes — everything
    // else is a Next.js API route and should be handled locally.
    const azureRoutes = [
      'capabilities',
      'generate-review',
      'improve-review',
      'improve-section',
      'select-capabilities',
      'select-experience-groups',
    ];

    return azureRoutes.map(route => ({
      source: `/api/${route}`,
      destination: `http://localhost:8000/api/${route}`,
    }));
  },
}

module.exports = nextConfig;
