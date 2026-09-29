'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * "Join session": the coaching video call link, styled as the house primary
 * button. An anchor rather than PrimaryButton because it leaves the site, and a
 * button inside a link is markup neither keyboards nor long-press menus handle.
 *
 * Renders nothing unless the link is https. The API has already validated it;
 * this is the last check before an href.
 */
export default function JoinSessionLink({ href }: { href: string }) {
  const shouldReduceMotion = useReducedMotion();
  if (!href.startsWith('https://')) return null;

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold text-white focus-visible-ring"
      style={{
        background: 'linear-gradient(135deg, #B45309, #D97706)',
        boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
      }}
      whileHover={shouldReduceMotion ? undefined : { y: -2, boxShadow: '0 6px 20px rgba(180,83,9,0.3)' }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
    >
      Join session
      <span aria-hidden="true">&rarr;</span>
      <span className="sr-only">(opens in a new tab)</span>
    </motion.a>
  );
}
