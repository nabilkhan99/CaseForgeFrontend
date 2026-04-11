import './globals.css'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import AnalyticsWrapper from '@/components/common/AnalyticsWrapper'
import type { Metadata, Viewport } from 'next'

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

export const metadata: Metadata = {
  title: 'Fourteen Fisherman - The Gold Standard for SCA Prep',
  description: 'Master the Simulated Consultation Assessment with AI-powered patient simulations. Practice 24/7 with realistic clinical scenarios mapped to the RCGP curriculum.',
  keywords: 'SCA exam, RCGP, GP training, medical simulation, clinical assessment, AI patient, consultation practice',
  openGraph: {
    type: 'website',
    url: 'https://www.fourteenfisherman.com/',
    title: 'Fourteen Fisherman - The Gold Standard for SCA Prep',
    description: 'Master the Simulated Consultation Assessment with AI-powered patient simulations.',
    images: ['https://www.fourteenfisherman.com/fourteenfishermann.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fourteen Fisherman - The Gold Standard for SCA Prep',
    description: 'Master the Simulated Consultation Assessment with AI-powered patient simulations.',
    images: ['https://www.fourteenfisherman.com/fourteenfishermann.png'],
  },
  alternates: {
    canonical: 'https://www.fourteenfisherman.com/',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${jakarta.variable} ${jetbrains.variable} font-sans bg-surface text-body antialiased overflow-x-hidden`}>
        {children}
        <AnalyticsWrapper />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
