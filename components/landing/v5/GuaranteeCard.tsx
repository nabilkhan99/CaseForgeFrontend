'use client';

import { motion } from 'framer-motion';
import { Accent, Pill, TILE } from '@/components/landing/v5/editorial';

interface Step {
  number: number;
  text: React.ReactNode;
}

const STEPS: Step[] = [
  { number: 1, text: 'Join any of our plans' },
  {
    number: 2,
    text: 'Pass all 200 mock AI SCA stations. Unlimited attempts, no credits',
  },
  {
    number: 3,
    text: 'Fail your real SCA? Email us a screenshot of your results',
  },
  {
    number: 4,
    text: (
      <span className="sm:whitespace-nowrap">
        We verify your progress and pay you{' '}
        <span className="whitespace-nowrap rounded-md bg-[#EAF3DE] px-2 py-0.5 font-medium text-[#27500A]">
          £500 cash
        </span>{' '}
        within 5 working days
      </span>
    ),
  },
];

export default function GuaranteeCard() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={`${TILE} p-7 sm:p-12`}
        >
          <div className="text-center">
            <Pill>How the guarantee works</Pill>
          </div>

          <div className="mx-auto mt-9 flex max-w-2xl flex-col gap-4 sm:mt-11 sm:gap-5">
            {STEPS.map((step) => (
              <div key={step.number} className="flex items-start gap-4">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#FAEEDA] text-xs font-semibold text-[#854F0B] sm:h-8 sm:w-8 sm:text-sm">
                  {step.number}
                </span>
                <p className="pt-1 text-[15px] leading-relaxed text-body sm:text-base">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xl font-medium leading-snug text-heading sm:text-2xl">
          We&apos;ve never had to pay this out.{' '}
          <Accent>We don&apos;t expect to start with you.</Accent>
        </p>
      </div>
    </section>
  );
}
