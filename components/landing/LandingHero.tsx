'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const PINK = '#C03B7B';

function DeviceFrame({ isFail = false }: { isFail?: boolean }) {
  const score = isFail ? '60' : '112';
  const resultText = isFail ? 'FAILED' : 'PASSED';
  const resultColor = isFail ? '#DC2626' : '#4CD964';

  return (
    <div
      className={`w-[280px] rounded-[32px] p-[8px] relative overflow-hidden transition-all duration-500 ${
        isFail ? 'opacity-95' : ''
      }`}
      style={{
        backgroundColor: '#1a1a1a',
        boxShadow: isFail
          ? '0 20px 40px -15px rgba(0,0,0,0.15)'
          : '0 40px 80px -20px rgba(0,0,0,0.15)',
      }}
    >
      <div className="w-full bg-white rounded-[24px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-100 flex items-center justify-between px-5 shrink-0">
          <span className="text-sm font-bold tracking-tight uppercase" style={{ color: PINK }}>
            SCA exam
          </span>
          <div className="flex items-center gap-2 py-1.5 px-3 rounded-full border border-gray-100 bg-gray-50/50">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="7" />
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
            </svg>
            <span className="font-bold text-[8px] text-gray-700 uppercase">feedback</span>
          </div>
        </div>

        {/* Two-column dashboard layout */}
        <div className="p-5 pb-6">
          <div className="grid grid-cols-2 gap-4 items-stretch">
            {/* Left: Details & Result */}
            <div className="flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <span className="text-[7px] uppercase font-bold tracking-widest text-gray-400">Date</span>
                  <p className="text-sm font-bold text-gray-800">06/01/2026</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[7px] uppercase font-bold tracking-widest text-gray-400">Exam</span>
                  <p className="text-sm font-bold text-gray-900 leading-tight">SCA January 2026</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-50">
                <span className="text-[7px] uppercase font-bold tracking-widest text-gray-400">Result</span>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-black text-gray-900 tracking-tighter">{resultText}</p>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: resultColor, boxShadow: `0 4px 12px ${resultColor}40` }}
                  >
                    {isFail ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Scores stacked */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-5 border border-gray-100 flex flex-col justify-center">
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none block">Overall Score</span>
                <p className="text-5xl font-black tracking-tighter text-gray-900 leading-none">{score}</p>
              </div>
              <div className="h-[1px] bg-gray-200 w-full opacity-60" />
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none block">Pass Mark</span>
                <p className="text-2xl font-bold text-gray-500 tracking-tighter">78</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-4 lg:min-h-screen lg:flex lg:items-center lg:pb-0">
      <main className="max-w-[1400px] mx-auto px-6 sm:px-8 py-4 lg:py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 lg:gap-8 xl:gap-16 items-center">
          {/* Left Column: Text */}
          <div className="space-y-5 lg:space-y-8 z-10 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-[clamp(32px,5vw+1rem,72px)] font-bold text-text-primary tracking-[-0.03em] leading-[1.05] mb-5 lg:mb-6">
                Would you pass the SCA{' '}
                <span
                  className="inline"
                  style={{
                    background: 'linear-gradient(135deg, #B45309, #D97706)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  tomorrow?
                </span>
              </h1>

              <p className="text-lg text-text-secondary leading-relaxed max-w-[440px] mx-auto lg:mx-0">
                Test yourself against our AI patients and find out if you&apos;re ready to pass.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <Link href="/waitlist">
                <motion.div
                  className="w-full sm:w-auto px-6 lg:px-8 py-3.5 lg:py-4 rounded-full text-white font-semibold flex items-center justify-center gap-2 cursor-pointer text-[14px] lg:text-base"
                  style={{
                    background: 'linear-gradient(135deg, #B45309, #D97706)',
                    boxShadow: '0 4px 16px rgba(180,83,9,0.18)',
                  }}
                  whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(180,83,9,0.25)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  Join Waitlist
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </motion.div>
              </Link>
              <Link href="/cases">
                <motion.div
                  className="w-full sm:w-auto px-6 lg:px-8 py-3.5 lg:py-4 rounded-full font-semibold border border-black/10 hover:bg-black/[0.03] transition-colors cursor-pointer text-heading text-[14px] lg:text-base text-center"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View cases
                </motion.div>
              </Link>
            </motion.div>
          </div>

          {/* Right Column: Phone Mockups */}
          {/* Desktop: both cards side by side */}
          <div className="hidden lg:flex relative justify-center overflow-visible">
            <div className="flex flex-row items-center justify-center gap-6 w-full transform lg:scale-[0.9] xl:scale-100 origin-right">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                className="z-10"
              >
                <DeviceFrame isFail />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="z-20"
              >
                <DeviceFrame />
              </motion.div>
            </div>
          </div>

        </div>
      </main>

      {/* Background Decor */}
      <div className="fixed bottom-0 right-0 w-1/3 h-1/2 -z-10 opacity-5 pointer-events-none">
        <div
          className="w-full h-full"
          style={{ background: 'radial-gradient(circle at center, #B45309 0%, transparent 70%)' }}
        />
      </div>
    </section>
  );
}
