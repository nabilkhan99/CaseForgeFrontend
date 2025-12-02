'use client';

import './globals.css'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import { useEffect } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { initAnalytics } from '@/lib/analytics'
import Head from 'next/head'

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
    <html lang="en">
      <head>
        <title>Fourteen Fisherman - AI-Powered Case Review & Portfolio Builder</title>
        <meta name="description" content="Transform your GP Trainee experience into compelling case studies. Fourteen Fisherman uses AI to help you craft professional portfolio reviews that showcase your expertise and capabilities." />
        <meta name="keywords" content="GP Trainee portfolio, case studies, AI case review, GP Trainee experience, portfolio builder, professional services" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.fourteenfisherman.com/" />
        <meta property="og:title" content="Fourteen Fisherman - AI-Powered Case Review" />
        <meta property="og:description" content="Transform your GP Trainee experience into compelling case studies with AI-powered case reviews." />
        <meta property="og:image" content="https://www.fourteenfisherman.com/fourteenfishermann.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://www.fourteenfisherman.com/" />
        <meta property="twitter:title" content="Fourteen Fisherman - AI-Powered Case Review" />
        <meta property="twitter:description" content="Transform your GP Trainee experience into compelling case studies with AI-powered case reviews." />
        <meta property="twitter:image" content="https://www.fourteenfisherman.com/fourteenfishermann.png" />
        
        <link rel="canonical" href="https://www.fourteenfisherman.com/" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen">
          <nav className="backdrop-blur-lg bg-black/20 border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center h-full py-2">
                  <Image 
                    src="/fourteenfishermann.png"
                    alt="Fourteen Fisherman Logo"
                    width={60}
                    height={48}
                    priority
                    className="h-full w-auto"
                  />
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}