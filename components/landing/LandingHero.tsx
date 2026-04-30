'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-4 lg:min-h-screen lg:flex lg:items-center lg:pb-0">
      <main className="max-w-[1200px] mx-auto px-6 lg:px-5 py-4 lg:py-8 w-full">
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

          {/* Right Column: Two-phone hero image — desktop only */}
          <motion.div
            className="hidden lg:flex relative justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src="/hero-phones.png"
              alt="SCA exam results on two phones — one failed, one passed"
              width={700}
              height={500}
              priority
              className="w-full max-w-[620px] h-auto object-contain"
            />
          </motion.div>
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
