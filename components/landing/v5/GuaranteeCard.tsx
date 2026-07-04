'use client';

import { motion } from 'framer-motion';

interface Step {
  number: number;
  text: React.ReactNode;
}

const STEPS: Step[] = [
  { number: 1, text: 'Subscribe to any of our plans' },
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
      <>
        We verify your progress and pay you{' '}
        <span className="whitespace-nowrap rounded-md bg-[#EAF3DE] px-2 py-0.5 font-medium text-[#27500A]">
          £500 cash
        </span>{' '}
        within 5 working days
      </>
    ),
  },
];

export default function GuaranteeCard() {
  return (
    <section className="px-5 py-6 sm:px-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-5xl rounded-2xl border border-[#E4DDC9] bg-white p-6 shadow-elevation-1 sm:p-12"
      >
        <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:mb-8 sm:text-sm">
          How the guarantee works
        </p>

        <div className="mx-auto mb-5 flex max-w-md flex-col gap-3 sm:mb-8 sm:max-w-xl sm:gap-5">
          {STEPS.map((step) => (
            <div key={step.number} className="flex items-start gap-3 sm:gap-4">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#FAEEDA] text-xs font-medium text-[#854F0B] sm:h-8 sm:w-8 sm:text-sm">
                {step.number}
              </span>
              <span className="text-sm leading-relaxed text-body sm:text-base">
                {step.text}
              </span>
            </div>
          ))}
        </div>

        <p className="text-center text-sm font-medium text-heading sm:text-base">
          We&apos;ve never had to pay this out. We don&apos;t expect to start
          with you.
        </p>
      </motion.div>
    </section>
  );
}
