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
