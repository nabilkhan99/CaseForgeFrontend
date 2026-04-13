'use client';

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

interface LandingNavbarProps {
  user: { id: string } | null;
}

export default function LandingNavbar({ user }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollYProgress } = useScroll();

  const navBg = useTransform(
    scrollYProgress,
    [0, 0.08],
    ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.95)']
  );
  const navShadow = useTransform(
    scrollYProgress,
    [0, 0.08],
    ['0 1px 0 rgba(0,0,0,0)', '0 1px 0 rgba(0,0,0,0.06)']
  );

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <motion.nav
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={{ maxWidth: 'min(92%, 1200px)', backgroundColor: navBg, boxShadow: navShadow } as any}
        className="w-full backdrop-blur-2xl border border-black/[0.06] rounded-[14px] px-5 py-3 flex items-center justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
      >
        {/* Wordmark */}
        <Link href="/" className="flex items-center group cursor-pointer">
          <span className="text-[14px] font-semibold text-heading tracking-tight">
            Fourteen Fisherman
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <a
            href="#journey"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150"
          >
            How it works
          </a>
          <Link
            href="/pricing"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150"
          >
            Pricing
          </Link>
          <Link
            href="/cases"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150"
          >
            Cases
          </Link>
          <Link
            href="/portfolio"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150"
          >
            Portfolio
          </Link>
          <div className="w-px h-4 bg-black/10" />
          {user ? (
            <Link href="/dashboard">
              <motion.div
                className="primary-button text-[13px] !py-2 !px-5"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                Dashboard
              </motion.div>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                className="text-[13px] text-body hover:text-heading transition-colors duration-150"
              >
                Sign in
              </Link>
              <Link href="/try">
                <motion.div
                  className="primary-button text-[13px] !py-2 !px-5"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try a free case
                </motion.div>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <motion.button
          className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-[5px] cursor-pointer"
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
            <a
              href="#journey"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              How it works
            </a>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              Pricing
            </Link>
            <Link
              href="/cases"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              Cases
            </Link>
            <Link
              href="/portfolio"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              Portfolio
            </Link>
            <div className="my-1 border-t border-black/[0.06]" />
            {user ? (
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                <div className="primary-button text-[14px] w-full justify-center">Dashboard</div>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
                >
                  Sign in
                </Link>
                <Link href="/try" onClick={() => setMobileOpen(false)}>
                  <div className="primary-button text-[14px] w-full justify-center mt-1">
                    Try a free case
                  </div>
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
