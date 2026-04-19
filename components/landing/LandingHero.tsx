'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const PINK = '#C03B7B';

function DeviceFrame({ isFail = false }: { isFail?: boolean }) {
  return (
    <div
      className={`w-[280px] h-[580px] rounded-[48px] p-3 relative overflow-hidden transition-all duration-500 ${
        isFail ? 'opacity-95' : ''
      }`}
      style={{
        backgroundColor: '#1a1a1a',
        boxShadow: isFail
          ? '0 20px 40px -15px rgba(0,0,0,0.15)'
          : '0 30px 60px -20px rgba(0,0,0,0.25)',
      }}
    >
      {/* Screen */}
      <div className="w-full h-full bg-white rounded-[38px] overflow-hidden flex flex-col">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1a1a1a] rounded-b-2xl z-30" />

        {/* Header */}
        <div className="pt-10 px-6 pb-6 border-b-[6px] border-[#F5F5F5]">
          <h2 className="text-2xl font-medium" style={{ color: PINK }}>
            SCA exam
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col text-[#333333]">
          <div className="space-y-4 flex-1">
            <p className="text-2xl font-normal mb-1">06/01/2026</p>

            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ backgroundColor: 'rgba(192,59,123,0.08)' }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill={PINK}>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <span className="text-lg font-normal" style={{ color: PINK }}>
                Cases and feedback
              </span>
            </div>

            <div className="space-y-0.5">
              <p className="text-lg font-normal text-black/80">Exam name</p>
              <p className="text-xl font-normal text-black">SCA January 2026</p>
            </div>

            <div className="space-y-0.5">
              <p className="text-lg font-normal text-black/80">Result</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-normal">{isFail ? 'Failed' : 'Passed'}</p>
                {isFail ? (
                  <div
                    className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                    style={{ boxShadow: '0 0 8px rgba(239,68,68,0.4)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </div>
                ) : (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#4CD964', boxShadow: '0 0 8px rgba(76,217,100,0.4)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-lg font-normal text-black/80">Overall</p>
              <p className="text-2xl font-bold">{isFail ? '60' : '112'}</p>
            </div>

            <div className="space-y-0.5">
              <p className="text-lg font-normal text-black/80">Pass mark</p>
              <p className="text-2xl font-normal">78</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-8 lg:pt-24 lg:pb-0 lg:min-h-[90dvh]">
      <main className="max-w-[1400px] mx-auto px-6 sm:px-8 py-4 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8 xl:gap-16 items-center">
          {/* Left Column: Text */}
          <div className="space-y-8 z-10 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-[11px] font-mono font-medium tracking-[0.14em] uppercase text-primary block mb-6">
                For GP Trainees Preparing for the SCA
              </span>

              <h1 className="text-[clamp(36px,5vw+1rem,72px)] font-bold text-heading tracking-[-0.03em] leading-[1.05] mb-6">
                Would you pass the SCA if it were{' '}
                <span className="relative inline-block">
                  <span className="relative z-10" style={{ color: '#B45309' }}>
                    tomorrow
                  </span>
                  <motion.span
                    className="absolute inset-0 -inset-x-1.5 -inset-y-0.5 rounded-md -z-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(180,83,9,0.18))',
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
                  />
                </span>
                ?
              </h1>

              <p className="text-lg lg:text-xl text-body/60 max-w-md leading-relaxed mx-auto lg:mx-0">
                Test yourself against our AI patients and find out if you&apos;re ready to pass
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              <Link href="/waitlist">
                <motion.div
                  className="px-8 py-4 rounded-full text-white font-semibold flex items-center gap-2 cursor-pointer"
                  style={{ backgroundColor: '#B45309' }}
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
                  className="px-8 py-4 rounded-full font-semibold border border-black/10 hover:bg-black/[0.03] transition-colors cursor-pointer text-heading"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View cases
                </motion.div>
              </Link>
            </motion.div>
          </div>

          {/* Right Column: Phone Mockups */}
          <div className="relative flex justify-center py-0 lg:py-0 overflow-visible">
            <div className="flex flex-row items-center justify-center gap-3 lg:gap-6 w-full transform scale-[0.45] -my-[140px] sm:scale-[0.55] sm:-my-[100px] md:scale-[0.8] md:my-0 lg:scale-[0.85] xl:scale-100 origin-center lg:origin-right">
              {/* Fail Card (Left) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="z-10"
              >
                <DeviceFrame isFail />
              </motion.div>

              {/* Pass Card (Right) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
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
