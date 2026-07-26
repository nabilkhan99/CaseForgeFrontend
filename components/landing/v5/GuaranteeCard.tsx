'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import GuaranteeSeal from '@/components/landing/v5/GuaranteeSeal';
import { ClipboardCheck, AudioLines, MailPlus, ChevronRight } from 'lucide-react';
import { Accent, Pill } from '@/components/landing/v5/editorial';

interface Step {
  icon: React.ReactNode;
  ringBg: string;
  title: React.ReactNode;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: <ClipboardCheck className="h-7 w-7" strokeWidth={1.75} />,
    ringBg: '#FAEEDA',
    title: 'Join any of our plans',
    body: 'Choose the plan that works for you and get instant access to the platform.',
  },
  {
    icon: <AudioLines className="h-7 w-7" strokeWidth={1.75} />,
    ringBg: '#E7F1D6',
    title: 'Pass all 200 mock AI SCA stations',
    body: 'Unlimited attempts, no credits. Keep practising until you’re ready.',
  },
  {
    icon: <MailPlus className="h-7 w-7" strokeWidth={1.75} />,
    ringBg: '#E4ECF3',
    title: 'Fail your real SCA? Email us proof',
    body: 'Send us a screenshot of your result.',
  },
  {
    icon: <span className="text-sm font-bold tracking-tight">£500</span>,
    ringBg: '#FDE8C8',
    title: (
      <>
        We verify &amp; pay you{' '}
        <span className="text-[#4A6B1F]">£500</span>
      </>
    ),
    body: 'We’ll verify your progress and send £500 cash within 5 working days.',
  },
];

const ICON_COLOURS = ['#B45309', '#4A6B1F', '#5B7A9B', '#B45309'];

// The whole section is meant to be taken in at a glance, so its desktop rhythm
// is sized to fit a 13" laptop viewport (~760px tall) and only opens back up on
// genuinely tall screens via the `tall:` (min-height) variant. The height is
// taken out of the vertical gaps and the heading — the steps and the £500 card
// keep their full size.
export default function GuaranteeCard() {
  return (
    <section className="px-5 py-12 sm:px-8 sm:py-8 sm:tall:py-16">
      <div className="mx-auto max-w-6xl">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <Pill>How the guarantee works</Pill>
          {/* max-w-4xl at sm keeps this on a single line, which is where most
              of the reclaimed vertical space comes from. */}
          <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-heading sm:max-w-4xl sm:text-[2.75rem] sm:tall:max-w-3xl sm:tall:text-5xl">
            Our SCA Guarantee. <Accent>Real skin in the game.</Accent>
          </h2>
          {/* hand-drawn underline accent */}
          <svg
            className="mx-auto mt-3 h-2.5 w-40 text-primary/70 sm:w-52"
            viewBox="0 0 200 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 7C40 3 90 2 130 4c25 1 50 2 68 1"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>

        {/* Steps */}
        <div className="mt-12 flex flex-col items-stretch gap-10 sm:mt-8 sm:flex-row sm:items-start sm:gap-2 sm:tall:mt-16">
          {STEPS.map((step, i) => (
            <Fragment key={i}>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex flex-1 flex-col items-center px-2 text-center"
              >
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ backgroundColor: step.ringBg, color: ICON_COLOURS[i] }}
                >
                  {step.icon}
                </div>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#B45309] text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <h3 className="text-[15px] font-semibold leading-snug text-heading sm:text-base">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 max-w-[15rem] text-sm leading-relaxed text-body sm:max-w-[16rem]">
                  {step.body}
                </p>
              </motion.div>
              {i < STEPS.length - 1 && (
                <ChevronRight
                  className="mt-8 hidden h-6 w-6 flex-shrink-0 self-start text-stone-300 sm:block"
                  aria-hidden="true"
                />
              )}
            </Fragment>
          ))}
        </div>

        {/* Never-paid-out card with £500 seal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative mt-14 overflow-hidden rounded-3xl border border-heading/[0.08] bg-white/60 px-6 py-10 shadow-elevation-1 sm:mt-8 sm:px-12 sm:py-12 sm:tall:mt-16"
        >
          {/* faint wave texture */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full text-[#B45309]/[0.05]"
            preserveAspectRatio="none"
            viewBox="0 0 600 200"
            fill="none"
            aria-hidden="true"
          >
            {[0, 30, 60, 90, 120, 150].map((y) => (
              <path
                key={y}
                d={`M0 ${y + 40}C120 ${y + 10} 240 ${y + 70} 360 ${y + 40}S600 ${y + 10} 600 ${y + 40}`}
                stroke="currentColor"
                strokeWidth="1.5"
              />
            ))}
          </svg>

          <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:gap-12">
            <GuaranteeSeal />
            <div className="text-center sm:text-left">
              <p className="text-2xl font-medium leading-snug text-heading sm:text-[2rem]">
                We&apos;ve never had to pay this out.{' '}
                <Accent>We don&apos;t expect to start with you.</Accent>
              </p>
              <Link
                href="/terms"
                className="mt-5 inline-block text-sm font-medium text-body underline decoration-heading/30 underline-offset-4 transition hover:text-heading"
              >
                Full terms and conditions
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

