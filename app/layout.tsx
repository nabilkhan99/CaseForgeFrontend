'use client';

import './globals.css'
import { Inter } from 'next/font/google'
import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { initAnalytics } from '@/lib/analytics'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        <title>Fourteen Fisherman - The Gold Standard for SCA Prep</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <meta name="description" content="Master the Simulated Consultation Assessment with AI-powered patient simulations. Practice 24/7 with realistic clinical scenarios mapped to the RCGP curriculum." />
        <meta name="keywords" content="SCA exam, RCGP, GP training, medical simulation, clinical assessment, AI patient, consultation practice" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.fourteenfisherman.com/" />
        <meta property="og:title" content="Fourteen Fisherman - The Gold Standard for SCA Prep" />
        <meta property="og:description" content="Master the Simulated Consultation Assessment with AI-powered patient simulations." />
        <meta property="og:image" content="https://www.fourteenfisherman.com/fourteenfishermann.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://www.fourteenfisherman.com/" />
        <meta property="twitter:title" content="Fourteen Fisherman - The Gold Standard for SCA Prep" />
        <meta property="twitter:description" content="Master the Simulated Consultation Assessment with AI-powered patient simulations." />
        <meta property="twitter:image" content="https://www.fourteenfisherman.com/fourteenfishermann.png" />
        
        <link rel="canonical" href="https://www.fourteenfisherman.com/" />
      </head>
      <body className={`${inter.className} bg-background-dark text-slate-300 antialiased overflow-x-hidden`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
