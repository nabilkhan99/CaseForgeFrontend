'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function PracticeWithFriend() {
  return (
    <section className="py-[80px] px-6">
      <div className="max-w-[800px] mx-auto">
        <motion.div
          className="rounded-3xl border border-black/[0.06] bg-gradient-to-br from-white/80 to-amber-50/30 p-8 md:p-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="flex-1">
              <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary block mb-4">
                Free Forever
              </span>
              <h2 className="text-[28px] sm:text-[32px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mb-4">
                Practice with a friend
              </h2>
              <p className="text-[16px] text-muted leading-[1.7] mb-3">
                Every case in our library is free — complete with candidate briefs, patient scripts, and marking schemes built from the RCGP super-condensed curriculum.
              </p>
              <p className="text-[16px] text-muted leading-[1.7] mb-6">
                One of you plays the doctor, the other reads the patient script. Use the built-in timer and mark scheme to score each other in real time.
              </p>
              <Link href="/sca-cases">
                <motion.div
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-semibold text-white cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #B45309, #D97706)',
                    boxShadow: '0 4px 16px rgba(180,83,9,0.15)',
                  }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Browse Free SCA Practice Cases →
                </motion.div>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
