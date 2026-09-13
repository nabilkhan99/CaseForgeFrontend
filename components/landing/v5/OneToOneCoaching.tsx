'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Accent } from './editorial';

/**
 * The one to one coaching session, in the slot the old coaching day
 * timetable used to fill.
 *
 * Built from the supplied design: a matched pair of cards (the circuit, the
 * feedback) above one dominant block (the dashboard review). The pair says
 * what happens in the three hours; the dominant block says why it is worth
 * more than any single station's feedback, so it must never render as an
 * equal third.
 *
 * There is deliberately no timetable or hour by hour breakdown here.
 */

const TEAL = '#0F6E56';
const AMBER = '#B45309';

interface PairRow {
  icon: ReactNode;
  text: string;
}

interface PairCard {
  title: string;
  subtitle: string;
  rows: PairRow[];
}

const PAIR: readonly PairCard[] = [
  {
    title: 'Half a real circuit',
    subtitle: 'six stations · 12 minutes each · no breaks',
    rows: [
      {
        icon: (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l2.6 1.6" />
          </>
        ),
        text: 'Six timed 12 minute stations, back to back, no breaks in between.',
      },
      {
        icon: (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
          </>
        ),
        text: 'Half the length of the real SCA, run the same way, so the fatigue and the pace are real rather than simulated.',
      },
    ],
  },
  {
    title: 'Feedback on all six',
    subtitle: 'station by station · written up',
    rows: [
      {
        icon: (
          <>
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="4.2" />
          </>
        ),
        text: 'What the examiner would have marked you down for, and what to do instead.',
      },
      {
        icon: (
          <>
            <rect x="5" y="4.5" width="14" height="15" rx="1.5" />
            <path d="M8.5 9h7M8.5 12h7M8.5 15h7" />
          </>
        ),
        text: 'Written up so you can work from it afterwards, not just talked through on the call.',
      },
    ],
  },
];

/**
 * Eight practice-history cards. Each has its own shape of grey lines, but the
 * amber line (the recurring weak point) sits in the same place on every one:
 * that sameness across different cards is the whole point of the picture.
 */
const HISTORY_CARDS: readonly (readonly number[])[] = [
  [42, 100, 100, 76],
  [52, 88, 100, 60],
  [48, 96, 100, 70],
  [36, 84, 100, 64],
  [44, 94, 100, 58],
  [54, 80, 100, 72],
  [40, 90, 100, 52],
  [50, 86, 100, 68],
];
const RECURRING_LINE = 2;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <p
      className="font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500 sm:text-xs sm:tracking-[0.24em]"
      style={color ? { color } : undefined}
    >
      {children}
    </p>
  );
}

function PairCardView({ card }: { card: PairCard }) {
  return (
    <div className="rounded-3xl border border-[#EDE3D2] bg-[#FFFDF9] px-6 py-6 shadow-elevation-1 sm:px-9 sm:py-8">
      <h3 className="text-xl font-semibold tracking-tight text-heading sm:text-[26px]">{card.title}</h3>
      <p className="mt-1.5 text-[15px] sm:text-base" style={{ color: TEAL }}>
        {card.subtitle}
      </p>
      <div className="mt-4 border-t border-heading/[0.07] sm:mt-5">
        {card.rows.map((row, index) => (
          <div
            key={row.text}
            className={`flex items-start gap-4 py-4 sm:gap-5 sm:py-5 ${index > 0 ? 'border-t border-heading/[0.07]' : ''}`}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F3EEE6] text-stone-600 sm:h-11 sm:w-11"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {row.icon}
              </svg>
            </span>
            <p className="pt-1.5 text-[15px] leading-relaxed text-body sm:pt-2 sm:text-[17px]">{row.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeHistory() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="rounded-3xl border border-[#EDE3D2] bg-[#FFFDF9] px-5 py-6 shadow-elevation-1 sm:px-8 sm:py-7">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Your practice history</Eyebrow>
        <span className="inline-flex items-center gap-2 text-[13px] font-medium sm:text-sm" style={{ color: AMBER }}>
          <motion.span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: AMBER }}
            animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1] }}
            transition={reduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
          recurring
        </span>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2.5 sm:gap-4" aria-hidden="true">
        {HISTORY_CARDS.map((widths, cardIndex) => (
          <div key={cardIndex} className="flex flex-col gap-[7px] rounded-xl bg-[#F6F1E9] px-2.5 py-3 sm:gap-2 sm:px-4 sm:py-4">
            {widths.map((width, lineIndex) => {
              const recurring = lineIndex === RECURRING_LINE;
              return (
                <motion.span
                  key={lineIndex}
                  className={`block h-[4px] origin-left rounded-full sm:h-[5px] ${recurring ? '' : 'bg-[#E4DCCF]'}`}
                  style={{ width: `${width}%`, ...(recurring ? { backgroundColor: AMBER } : {}) }}
                  initial={recurring && !reduceMotion ? { scaleX: 0 } : false}
                  whileInView={recurring && !reduceMotion ? { scaleX: 1 } : undefined}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: 0.25 + cardIndex * 0.08, ease: 'easeOut' }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted sm:text-[15px]">
        Same weak point, eight different clinical areas.
      </p>
    </div>
  );
}

export default function OneToOneCoaching() {
  return (
    <section id="coaching" className="px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        {/* Heading: claim on the left, subhead sitting on its baseline on the right */}
        <motion.div {...fadeUp} className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-12">
          <div>
            <Eyebrow>Three hours, one to one</Eyebrow>
            <h2 className="mt-5 font-[family-name:var(--font-display)] text-[2.25rem] font-semibold leading-[1.06] tracking-[-0.03em] text-heading sm:mt-6 sm:text-5xl lg:text-[3.4rem]">
              Three hours to find out what is <Accent>actually</Accent> holding you
              back.
            </h2>
          </div>
          <p className="text-base leading-relaxed text-body sm:text-lg lg:pb-2">
            Six stations under exam conditions, then the only review that draws on every station you have ever
            practised.
          </p>
        </motion.div>

        {/* Mobile only: the dominant block sits two tall cards down, so say it is coming. */}
        <motion.a
          {...fadeUp}
          href="#coaching-review"
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#E8C9A0] bg-[#FDF3E6] px-3.5 py-1.5 text-[13px] font-medium sm:hidden"
          style={{ color: AMBER }}
        >
          Then the part nobody else can do
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.a>

        {/* The matched pair */}
        <div className="mt-6 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6">
          {PAIR.map((card, index) => (
            <motion.div key={card.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: index * 0.06 }}>
              <PairCardView card={card} />
            </motion.div>
          ))}
        </div>

        {/* The dominant block */}
        <motion.div
          {...fadeUp}
          id="coaching-review"
          className="mt-4 scroll-mt-24 rounded-[28px] border border-[#E8C9A0] bg-[linear-gradient(135deg,#FDF3E6_0%,#FBF4EA_60%,#FCF7EF_100%)] px-6 py-8 shadow-elevation-2 sm:mt-6 sm:px-12 sm:py-12"
        >
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12">
            <div>
              <Eyebrow color={AMBER}>The part nobody else can do</Eyebrow>
              <h3 className="mt-5 text-[1.85rem] font-semibold leading-[1.1] tracking-[-0.02em] text-heading sm:text-[2.6rem]">
                Not what went wrong today. What keeps going wrong.
              </h3>
              <p className="mt-5 text-base leading-[1.7] text-body sm:text-[19px]">
                Your coach opens your dashboard and looks at every station you have practised: the habit that costs
                you marks in cardiology, paediatrics and palliative care alike.
              </p>
              <p className="mt-5 text-lg font-semibold sm:text-[21px]" style={{ color: AMBER }}>
                One fix, applied everywhere.
              </p>
            </div>
            <PracticeHistory />
          </div>
        </motion.div>

        {/* Supporting line and value tag */}
        <motion.div
          {...fadeUp}
          className="mt-6 flex flex-col gap-2 px-1 sm:mt-8 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          <p className="text-sm text-muted sm:text-[15px]">
            3 hours · remote · weekends, morning or afternoon · you choose your date at checkout
          </p>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500 sm:text-[13px]">£749 value</p>
        </motion.div>
      </div>
    </section>
  );
}
