'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const SPECIALTIES = [
  'Cardiovascular Health', 'Dermatology', 'Mental Health', 'Neurology',
  'Respiratory Health', 'Musculoskeletal Health', 'Ophthalmology', 'Gastroenterology',
  'Genetics', 'Haematology', 'Renal and Urology', 'Maternity and Reproductive Health',
  'Sexual Health', 'Ear, Nose and Throat', 'Metabolic Problems and Endocrinology',
  'Older Adults', 'People at the End of Life', 'Learning Disability',
];

export default function CaseLibraryPreview() {
  return (
    <section className="py-[80px] px-6 overflow-hidden">
      <div className="max-w-[1200px] mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary block mb-4">
            Comprehensive Coverage
          </span>
          <h2 className="text-[28px] sm:text-[36px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mb-4">
            200+ RCGP mapped stations
          </h2>
          <p className="text-[16px] text-muted max-w-[480px] mx-auto">
            Every case mapped to the RCGP curriculum. Practice across every specialty you will face in the SCA.
          </p>
        </motion.div>

        {/* Scrolling carousel - two rows, opposite directions */}
        <div className="space-y-3 mb-10">
          <div className="flex gap-3 motion-safe:animate-scroll-left">
            {[...SPECIALTIES.slice(0, 9), ...SPECIALTIES.slice(0, 9)].map((s, i) => (
              <div key={i} className="flex-shrink-0 px-5 py-3 rounded-xl bg-white/60 border border-black/[0.06] text-sm text-body font-medium whitespace-nowrap">
                {s}
              </div>
            ))}
          </div>
          <div className="flex gap-3 motion-safe:animate-scroll-right">
            {[...SPECIALTIES.slice(9), ...SPECIALTIES.slice(9)].map((s, i) => (
              <div key={i} className="flex-shrink-0 px-5 py-3 rounded-xl bg-white/60 border border-black/[0.06] text-sm text-body font-medium whitespace-nowrap">
                {s}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link href="/sca-cases">
            <motion.div
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-semibold text-primary border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/[0.03] transition-all cursor-pointer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Browse Free SCA Practice Cases →
            </motion.div>
          </Link>
        </div>
      </div>
    </section>
  );
}
