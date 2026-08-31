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
  // pdfkit (under @react-pdf/renderer) loads its built-in font data through a
  // dynamic require that file tracing cannot see, so the deployed function had
  // no pdfkit/js/standard-fonts/* and every receipt PDF render threw
  // MODULE_NOT_FOUND — buyers got the no-receipt fallback email. 184K.
  outputFileTracingIncludes: {
    '/api/stripe/webhook': ['./node_modules/pdfkit/js/standard-fonts/**'],
  },
  async redirects() {
    return [
      // Renamed case slug (was auto-derived as the meaninglessly generic
      // "examination-expected" — see CASE_SEO_OVERRIDES in lib/seo/cases.ts).
      {
        source: '/sca-cases/examination-expected',
        destination: '/sca-cases/remote-triage-acute-headache',
        permanent: true,
      },
      // History and Trend collapsed into one Development page. Both URLs are in
      // people's history and in older emails, and the session list one of them
      // used to show now lives on the Library topic pages — so they redirect to
      // the picture rather than 404ing.
      {
        source: '/dashboard/history',
        destination: '/dashboard/development',
        permanent: true,
      },
      {
        source: '/dashboard/trend',
        destination: '/dashboard/development',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8000'
      : 'https://caseforge2025a.azurewebsites.net';

    // Only proxy the Azure Functions (portfolio tool) routes — everything
    // else is a Next.js API route and should be handled locally.
    //
    // The portfolio-playground/* pair moved here from the Render dev-api when
    // the playground was consolidated onto Azure. They MUST stay listed: this
    // is an explicit allowlist, not a wildcard, so an unlisted path falls
    // through to Next's own /api routes and 404s.
    const azureRoutes = [
      'capabilities',
      'generate-review',
      'improve-review',
      'improve-section',
      'select-capabilities',
      'select-experience-groups',
      'portfolio-playground/prompt',
      'portfolio-playground/generate-review',
    ];

    return [
      // Approver-facing course specification. The study budget checker's
      // pre-approval emails link to fourteenfisherman.com/course-spec
      // verbatim, so this URL must stay stable. Served as a static
      // document from public/course-spec.html.
      {
        source: '/course-spec',
        destination: '/course-spec.html',
      },
      ...azureRoutes.map(route => ({
        source: `/api/${route}`,
        destination: `${backendUrl}/api/${route}`,
      })),
    ];
  },
}

module.exports = nextConfig;
