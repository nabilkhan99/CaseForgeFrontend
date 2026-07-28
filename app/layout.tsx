import './globals.css'
import { Plus_Jakarta_Sans, JetBrains_Mono, DM_Serif_Display, Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import AnalyticsWrapper from '@/components/common/AnalyticsWrapper'
import type { Metadata, Viewport } from 'next'
import { ORGANIZATION_JSON_LD } from '@/lib/seo/site'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['italic', 'normal'],
  variable: '--font-serif',
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.fourteenfisherman.com'),
  applicationName: 'Fourteen Fisherman',
  title: {
    default: 'Fourteen Fisherman — The Complete SCA Course',
    template: '%s | Fourteen Fisherman',
  },
  description: 'AI practice on 200 stations, 10 hours of on-demand lectures and a full-day Small-Group Coaching session. Fail your SCA after passing all 200 stations, and we pay you £500.',
  keywords: 'SCA exam, RCGP, GP training, medical simulation, clinical assessment, AI patient, consultation practice',
  icons: {
    icon: [
      { url: '/favicon-48x48.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'Fourteen Fisherman',
    url: 'https://www.fourteenfisherman.com/',
    title: 'Fourteen Fisherman — The Complete SCA Course',
    description: 'AI practice on 200 stations, 10 hours of on-demand lectures and a full-day Small-Group Coaching session. Fail your SCA after passing all 200 stations, and we pay you £500.',
    images: [
      {
        url: 'https://www.fourteenfisherman.com/og/sca-default.jpg',
        width: 1200,
        height: 1200,
        alt: 'Fourteen Fisherman — everything you need to pass the SCA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fourteen Fisherman — The Complete SCA Course',
    description: 'AI practice on 200 stations, 10 hours of on-demand lectures and a full-day Small-Group Coaching session. Fail your SCA after passing all 200 stations, and we pay you £500.',
    images: ['https://www.fourteenfisherman.com/og/sca-default.jpg'],
  },
  alternates: {
    canonical: 'https://www.fourteenfisherman.com/',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#B45309',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${jakarta.variable} ${jetbrains.variable} ${dmSerif.variable} ${geist.variable} font-sans bg-surface text-body antialiased overflow-x-hidden`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        {children}
        <AnalyticsWrapper />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
