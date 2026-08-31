'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import ProofNumbers from '@/components/landing/v5/ProofNumbers';
import { Accent, CROSSHATCH_DARK } from '@/components/landing/v5/editorial';

const STEPS: readonly string[] = [
  'Join any plan and pass all 200 mock stations, with unlimited attempts.',
  'Fail your real SCA? Email us a screenshot of your result.',
  'We verify and pay you £500 cash within 5 working days.',
];

interface GuaranteeCardProps {
  /**
   * Show the three proof numbers beneath the card. The homepage folds its
   * trust numbers into this section; /pricing and the trial feedback page
   * want the guarantee on its own.
   */
  proof?: boolean;
}

/**
 * The £500 guarantee, as one warm amber card: a display-size numeral rail, the
 * promise, and the three steps that deliver it. Shared by the homepage,
 * /pricing and the trial feedback page, so the promise reads identically
 * wherever a trainee meets it.
 */
export default function GuaranteeCard({ proof = false }: GuaranteeCardProps) {
  return (
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-3xl bg-primary px-6 py-10 text-[#FFF7E4] shadow-[0_26px_52px_-34px_rgba(180,83,9,0.75)] sm:px-12 sm:py-12"
          style={CROSSHATCH_DARK}
        >
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-12">
            {/* Numeral rail */}
            <div className="w-full flex-shrink-0 border-b border-white/25 pb-7 text-center sm:w-auto sm:border-b-0 sm:border-r sm:pb-0 sm:pr-12">
              <p className="font-[family-name:var(--font-display)] text-[4.5rem] font-bold leading-none tracking-[-0.04em] text-white sm:text-[5.5rem] lg:text-[6.5rem]">
                £500
              </p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FAC775] sm:text-xs">
                Paid in cash
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-[family-name:var(--font-display)] text-[1.75rem] font-bold leading-[1.12] tracking-[-0.025em] text-white sm:text-[2.25rem] lg:text-[2.5rem]">
                If you don&apos;t pass the SCA, we&apos;ll pay you £500.
              </h2>

              <ol className="mt-6 grid gap-3.5">
                {STEPS.map((step, i) => (
                  <motion.li
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                    className="flex items-baseline gap-3.5"
                  >
                    <span
                      className="flex-shrink-0 font-mono text-[13px] text-[#FAC775]"
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[15px] leading-[1.55] sm:text-base">
                      {step}
                    </span>
                  </motion.li>
                ))}
              </ol>

              {/* Kept at 24px and up: the accent tone only clears its contrast
                  threshold on the amber card at large-text sizes. */}
              <p className="mt-7 text-2xl font-medium leading-snug text-white sm:text-[1.75rem]">
                We&apos;ve never had to pay this out.{' '}
                <Accent dark className="!text-[#FAC775]">
                  We don&apos;t expect to start with you.
                </Accent>
              </p>

              <Link
                href="/terms"
                className="mt-4 inline-block border-b border-white/45 pb-0.5 text-sm font-medium text-[#FFF7E4] transition-colors hover:border-white hover:text-white"
              >
                Full terms and conditions
              </Link>
            </div>
          </div>
        </motion.div>

        {proof && <ProofNumbers />}
      </div>
    </section>
  );
}
