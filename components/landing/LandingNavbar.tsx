'use client';

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SCA_PILLAR_PATH } from '@/lib/guides/scaPillarGuide';

interface LandingNavbarProps {
  user: { id: string } | null;
  hideAuth?: boolean;
}

export default function LandingNavbar({ user, hideAuth }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { scrollYProgress } = useScroll();
  const guidesActive = pathname?.startsWith('/guides');

  const navBg = useTransform(
    scrollYProgress,
    [0, 0.08],
    ['rgba(255,250,238,0.78)', 'rgba(255,250,238,0.94)']
  );
  const navShadow = useTransform(
    scrollYProgress,
    [0, 0.08],
    [
      '0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 24px -16px rgba(60,30,8,0.18)',
      '0 1px 0 rgba(255,255,255,0.7) inset, 0 12px 28px -16px rgba(60,30,8,0.28)',
    ]
  );

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <motion.nav
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={{ maxWidth: 'min(92%, 1200px)', backgroundColor: navBg, boxShadow: navShadow } as any}
        className="w-full backdrop-blur-2xl border border-[#d9cdb3]/70 rounded-[18px] px-5 py-3 flex items-center justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
      >
        {/* Brand logo */}
        <Link href="/" className="flex items-center group cursor-pointer">
          <Image
            src="/fourteenfishermann.png"
            alt="Fourteen Fisherman"
            width={280}
            height={32}
            priority
            className="h-7 w-auto brightness-0"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/sca-cases"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150"
          >
            Free SCA Cases
          </Link>
          <Link
            href={SCA_PILLAR_PATH}
            aria-current={guidesActive ? 'page' : undefined}
            className={`text-[13px] transition-colors duration-150 ${
              guidesActive ? 'font-semibold text-heading' : 'text-body hover:text-heading'
            }`}
          >
            SCA Guide
          </Link>
          <Link
            href="/gp-portfolio-tool"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150 flex items-baseline gap-2"
          >
            Portfolio AI tool
            <span className="text-[9px] font-semibold px-2 py-[3px] rounded-full bg-primary/10 text-primary border border-primary/15 leading-none inline-flex items-center gap-1">
              <span className="text-[8px]">✦</span> The original
            </span>
          </Link>
          {!hideAuth && (
            <>
              <div className="w-px h-4 bg-black/10" />
              {user ? (
                <Link href="/dashboard">
                  <motion.div
                    className="primary-button text-[13px] !py-2 !px-5 !rounded-full"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Dashboard
                  </motion.div>
                </Link>
              ) : (
                <Link href="/#join">
                  <motion.div
                    className="primary-button text-[13px] !py-2 !px-5 !rounded-full"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Join waitlist
                  </motion.div>
                </Link>
              )}
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <motion.button
          className="md:hidden min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-[5px] cursor-pointer"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full origin-center"
            animate={mobileOpen ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full"
            animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full origin-center"
            animate={mobileOpen ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
        </motion.button>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="absolute top-16 left-0 right-0 mx-4 glass-panel rounded-2xl p-4 flex flex-col gap-1"
            style={{ maxWidth: 'min(92%, 1200px)', margin: '0 auto' }}
          >
            <Link
              href="/sca-cases"
              onClick={() => setMobileOpen(false)}
              className="min-h-[44px] flex items-center px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              Free SCA Cases
            </Link>
            <Link
              href={SCA_PILLAR_PATH}
              aria-current={guidesActive ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
              className={`min-h-[44px] flex items-center px-3 py-2.5 rounded-xl text-[14px] hover:bg-black/[0.03] transition-all duration-150 ${
                guidesActive ? 'font-semibold text-heading' : 'text-body hover:text-heading'
              }`}
            >
              SCA Guide
            </Link>
            <Link
              href="/gp-portfolio-tool"
              onClick={() => setMobileOpen(false)}
              className="min-h-[44px] flex items-baseline px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150 gap-2"
            >
              Portfolio AI tool
              <span className="text-[9px] font-semibold px-2 py-[3px] rounded-full bg-primary/10 text-primary border border-primary/15 leading-none inline-flex items-center gap-1">
                <span className="text-[8px]">✦</span> The original
              </span>
            </Link>
            {!hideAuth && (
              <>
                <div className="my-1 border-t border-black/[0.06]" />
                {user ? (
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <div className="primary-button text-[14px] w-full justify-center">Dashboard</div>
                  </Link>
                ) : (
                  <Link href="/#join" onClick={() => setMobileOpen(false)}>
                    <div className="primary-button text-[14px] w-full justify-center mt-1">
                      Join waitlist
                    </div>
                  </Link>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
