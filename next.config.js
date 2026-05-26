/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    const backendUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8000'
      : 'https://caseforge2025a.azurewebsites.net';

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
      destination: `${backendUrl}/api/${route}`,
    }));
  },
}

module.exports = nextConfig;
