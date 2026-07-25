'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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

/** Scalloped seal edge — precomputed (28 scallops) so there is no render-time
 *  Math and therefore no SSR/client hydration mismatch. */
const SEAL_POINTS =
  '156.00,80.00 147.57,87.61 154.09,96.91 144.18,102.46 148.47,112.98 137.58,116.18 139.42,127.39 128.08,128.08 127.39,139.42 116.18,137.58 112.98,148.47 102.46,144.18 96.91,154.09 87.61,147.57 80.00,156.00 72.39,147.57 63.09,154.09 57.54,144.18 47.02,148.47 43.82,137.58 32.61,139.42 31.92,128.08 20.58,127.39 22.42,116.18 11.53,112.98 15.82,102.46 5.91,96.91 12.43,87.61 4.00,80.00 12.43,72.39 5.91,63.09 15.82,57.54 11.53,47.02 22.42,43.82 20.58,32.61 31.92,31.92 32.61,20.58 43.82,22.42 47.02,11.53 57.54,15.82 63.09,5.91 72.39,12.43 80.00,4.00 87.61,12.43 96.91,5.91 102.46,15.82 112.98,11.53 116.18,22.42 127.39,20.58 128.08,31.92 139.42,32.61 137.58,43.82 148.47,47.02 144.18,57.54 154.09,63.09 147.57,72.39';

/** Decorative £500 guarantee seal — scalloped orange medallion. */
function GuaranteeSeal() {
  return (
    <svg
      className="h-28 w-28 flex-shrink-0 sm:h-36 sm:w-36"
      viewBox="0 0 160 160"
      aria-label="£500 guarantee seal"
    >
      <polygon points={SEAL_POINTS} fill="#B45309" />
      <circle cx="80" cy="80" r="60" fill="#B45309" />
      <circle
        cx="80"
        cy="80"
        r="58"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <text x="80" y="34" textAnchor="middle" fontSize="11" fill="#FFFFFF" fillOpacity="0.8">
        ★ ★ ★
      </text>
      <text
        x="80"
        y="86"
        textAnchor="middle"
        fontSize="34"
        fontWeight="700"
        fill="#FFFFFF"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        £500
      </text>
      <text
        x="80"
        y="106"
        textAnchor="middle"
        fontSize="12"
        letterSpacing="2"
        fill="#FFFFFF"
        fillOpacity="0.9"
      >
        GUARANTEE
      </text>
      <text x="80" y="130" textAnchor="middle" fontSize="11" fill="#FFFFFF" fillOpacity="0.8">
        ★ ★ ★
      </text>
    </svg>
  );
}
