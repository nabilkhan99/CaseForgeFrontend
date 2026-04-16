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
    const apiDestination = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8000/api/:path*'
      : 'https://caseforge2025a.azurewebsites.net/api/:path*';

    return [
      {
        source: '/api/:path*',
        destination: apiDestination,
      },
    ];
  },
}

module.exports = nextConfig;
