'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function FinalCTA() {
  return (
    <section className="py-[60px] px-6">
      <div className="max-w-[560px] mx-auto text-center">
        <motion.h2
          className="text-[40px] font-bold text-heading tracking-[-0.02em] mb-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          Start your first consultation
        </motion.h2>

        <motion.p
          className="text-[16px] text-stone-500 mb-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.1 }}
        >
          Pick a case. Talk to your patient. Get scored. No account needed.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 100, damping: 16, delay: 0.2 }}
        >
          <Link href="/try">
            <motion.div
              className="inline-flex items-center gap-2 px-12 py-4 rounded-[14px] text-[14px] font-semibold text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                boxShadow: '0 8px 24px rgba(180,83,9,0.18)',
              }}
              whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(180,83,9,0.25)' }}
              whileTap={{ scale: 0.98 }}
            >
              Try a free case →
            </motion.div>
          </Link>
        </motion.div>

        <motion.p
          className="mt-4 text-[13px] text-muted"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </motion.p>
      </div>
    </section>
  );
}
