'use client';

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV_LINKS = [
  { label: 'Home', href: '/dashboard', exact: true },
  { label: 'Library', href: '/dashboard/library' },
  { label: 'Lectures', href: '/dashboard/lectures', lockable: true },
  { label: 'History', href: '/dashboard/history' },
  { label: 'Portfolio', href: '/portfolio' },
];

/**
 * Quiet marker for a tab the plan doesn't include. The tab stays — hiding it
 * means a self-study trainee never learns the course exists; disabling it
 * reads as broken. The page behind it carries the upsell.
 */
function LockGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-label="Included with Complete" className="ml-1 opacity-40 inline-block align-[-1px]">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function AppNavbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // null until known — never flash a lock at a Complete customer.
  const [hasLectures, setHasLectures] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.hasLectures === 'boolean') setHasLectures(data.hasLectures);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const showLock = (link: { lockable?: boolean }) => Boolean(link.lockable) && hasLectures === false;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { scrollYProgress } = useScroll();

  const navBg = useTransform(
    scrollYProgress,
    [0, 0.02],
    ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.95)']
  );
  const navShadow = useTransform(
    scrollYProgress,
    [0, 0.02],
    ['0 1px 0 rgba(0,0,0,0)', '0 1px 0 rgba(0,0,0,0.06)']
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
        });
      }
    });
  }, []);

  const initial = user?.name?.charAt(0).toUpperCase() || '?';

  // A tap on a nav row navigates but leaves the panel mounted otherwise, and
  // the browser back button doesn't unmount it either — close on every route
  // change rather than relying on each link's own onClick.
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dropdownOpen]);

  // Lock the page behind the open menu. Without this the page scrolls under the
  // panel on a phone, so closing the menu drops you somewhere you didn't choose.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname?.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    // The page sets viewportFit: 'cover', so on a notched phone the wordmark and
    // hamburger would sit under the sensor housing in landscape and under the
    // status bar in a home-screen launch without these insets.
    <div className="fixed top-[max(1rem,env(safe-area-inset-top))] left-0 right-0 z-50 flex justify-center pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      {/* Click-catcher for the avatar dropdown. It sits outside <motion.nav>
          deliberately: the nav is transformed by Framer, which makes it the
          containing block for `position: fixed` children, so an inset-0 overlay
          nested inside it would only ever cover the navbar. */}
      {dropdownOpen && (
        <div
          className="hidden md:block fixed inset-0 z-40"
          onClick={() => setDropdownOpen(false)}
          aria-hidden="true"
        />
      )}
      <motion.nav
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={{ maxWidth: 'min(92%, 1200px)', backgroundColor: navBg, boxShadow: navShadow } as any}
        className="relative z-50 w-full backdrop-blur-2xl border border-hairline rounded-[14px] px-5 py-2.5 flex items-center justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        {/* Wordmark */}
        <Link href="/dashboard" className="flex items-center cursor-pointer">
          <span className="text-[14px] font-semibold text-heading tracking-tight">
            Fourteen Fisherman
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                isActive(link.href, link.exact)
                  ? 'text-primary bg-primary/[0.06]'
                  : 'text-body hover:text-heading hover:bg-black/[0.03]'
              }`}
            >
              {link.label}
              {showLock(link) && <LockGlyph />}
            </Link>
          ))}
        </div>

        {/* Right side: user avatar */}
        <div className="hidden md:flex items-center gap-3 relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-semibold cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
          >
            {initial}
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="absolute top-12 right-0 w-48 bg-surface-raised border border-hairline rounded-xl shadow-elevation-3 py-1 z-50"
              >
                <div className="px-3 py-2 border-b border-hairline">
                  <div className="text-[13px] font-medium text-heading truncate">{user?.name}</div>
                  <div className="text-[11px] text-muted truncate">{user?.email}</div>
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center px-3 py-2 min-h-[44px] text-[13px] text-body hover:text-heading hover:bg-black/[0.03] transition-colors"
                >
                  Settings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 min-h-[44px] flex items-center text-[13px] text-danger hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile hamburger */}
        <motion.button
          className="md:hidden min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-[5px] cursor-pointer"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="app-mobile-menu"
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
          <>
            {/* Full-screen backdrop. Tapping outside a menu is the universal
                "close this" gesture on a phone; without an element to catch it
                the tap fell through and fired whatever row was underneath, so
                you ended up on a page you never chose with the menu still open. */}
            <motion.div
              // Not a button: the hamburger is already the labelled "Close
              // menu" control and Escape closes it too, so a second focusable
              // element with the same name is noise for a screen reader.
              aria-hidden="true"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 md:hidden cursor-default"
              style={{ background: 'rgba(28,25,23,0.18)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            />
          <motion.div
            id="app-mobile-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            // Not `glass-panel`: at 0.65 alpha the page text read straight
            // through the menu rows. Blur is a finish, not a legibility device.
            className="absolute top-14 left-0 right-0 mx-4 z-50 rounded-2xl p-4 flex flex-col gap-1 border border-hairline shadow-elevation-3 backdrop-blur-2xl"
            style={{ maxWidth: 'min(92%, 1200px)', margin: '0 auto', background: 'rgba(255,252,248,0.97)' }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`min-h-[44px] flex items-center px-3 py-2.5 rounded-xl text-[14px] transition-all duration-150 ${
                  isActive(link.href, link.exact)
                    ? 'text-primary bg-primary/[0.06] font-medium'
                    : 'text-body hover:text-heading hover:bg-black/[0.03]'
                }`}
              >
                {link.label}
                {showLock(link) && <LockGlyph />}
              </Link>
            ))}
            <div className="my-1 border-t border-hairline" />
            <Link
              href="/dashboard/settings"
              onClick={() => setMobileOpen(false)}
              className="min-h-[44px] flex items-center px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="min-h-[44px] flex items-center w-full px-3 py-2.5 rounded-xl text-[14px] text-left text-danger hover:bg-red-50 transition-all duration-150 cursor-pointer"
            >
              Sign out
            </button>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
