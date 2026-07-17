'use client';

import { motion } from 'framer-motion';
import { Square } from 'lucide-react';

interface FeatureRow {
  lead: string;
  tail: string;
}

const AI_PRACTICE_ROWS: FeatureRow[] = [
  { lead: 'Voice consultations', tail: 'just like the real exam' },
  { lead: '200 stations', tail: 'built from the RCGP curriculum' },
  { lead: 'Unlimited attempts', tail: 'no station credits' },
  { lead: 'Personalised feedback', tail: 'mapped to each RCGP domain' },
];

const LECTURE_ROWS: FeatureRow[] = [
  { lead: 'Everything you need for the exam', tail: 'the whole SCA, taught in 12 structured hours' },
  { lead: 'Why candidates fail', tail: 'and how to avoid it' },
  { lead: 'Difficult consultations', tail: 'bad news, negotiation, third-party' },
  { lead: 'A GP educator', tail: 'who knows what examiners look for' },
];

const COACHING_ROWS: FeatureRow[] = [
  { lead: 'Max 6 per class', tail: 'so the whole day stays interactive' },
  { lead: '12 full timed mocks', tail: 'you consult 2 yourself, live with the tutor' },
  { lead: 'Every station broken down', tail: 'by a GP tutor: the marking, the fixes' },
  { lead: 'High-yield teaching blocks', tail: 'exam technique and the marks most candidates miss' },
  { lead: 'Learn from your peers', tail: 'different cases, different mistakes' },
];

type TimetableStyle = 'teaching' | 'standard' | 'muted';

// Teaching titles are placeholders pending the GP educator's sign-off; the
// 3 x 30 min teaching / 12 x 30 min mock / 3 x 30 min break structure is fixed.
const TIMETABLE: { time: string; item: string; style: TimetableStyle }[] = [
  { time: '09:00', item: 'Teaching: how the SCA is marked', style: 'teaching' },
  { time: '09:30', item: 'Mock stations 1 to 4', style: 'standard' },
  { time: '11:30', item: 'Break', style: 'muted' },
  { time: '12:00', item: 'Mock stations 5 and 6', style: 'standard' },
  { time: '13:00', item: 'Lunch', style: 'muted' },
  { time: '13:30', item: 'Teaching: the 12-minute consultation', style: 'teaching' },
  { time: '14:00', item: 'Mock stations 7 to 9', style: 'standard' },
  { time: '15:30', item: 'Break', style: 'muted' },
  { time: '16:00', item: 'Mock stations 10 to 12', style: 'standard' },
  { time: '17:30', item: 'Teaching: where candidates lose marks', style: 'teaching' },
  { time: '18:00', item: 'Finish', style: 'standard' },
];

const TEAL = '#0F6E56';
const AMBER = '#854F0B';

function FeatureRows({ rows, color }: { rows: FeatureRow[]; color: string }) {
  return (
    <div>
      {rows.map((row, index) => (
        <div
          key={row.lead}
          className={`flex gap-3 py-3 ${index > 0 ? 'border-t-[0.5px] border-[#E4DDC9]' : ''}`}
        >
          <Square
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-heading">{row.lead}</p>
            <p className="text-[13px] leading-snug text-muted">{row.tail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500 sm:text-xs">
      {children}
    </p>
  );
}

function Timetable() {
  return (
    <div>
      <p className="pb-2 text-sm font-semibold text-heading">Your coaching day</p>
      <div className="flex flex-col gap-1.5">
        {TIMETABLE.map((slot) => (
          <div key={`${slot.time}-${slot.item}`} className="flex gap-3 text-[13px] leading-relaxed">
            <span className="w-11 flex-shrink-0 font-mono text-muted">{slot.time}</span>
            <span
              className={
                slot.style === 'teaching'
                  ? 'font-medium text-[#854F0B]'
                  : slot.style === 'muted'
                    ? 'text-muted'
                    : 'text-heading'
              }
            >
              {slot.item}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

/** "The Complete Course" section: what you get, and your coaching day. */
export default function CompleteCourse() {
  return (
    <section className="px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {/* Heading block */}
        <motion.div {...fadeUp} className="text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#B45309] sm:text-sm">
            The Complete Course
          </p>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-heading sm:text-xl">
            3 months of unlimited AI stations and lectures, from the day you buy.
          </p>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-heading sm:text-xl">
            Plus one live coaching day, on a date you choose.
          </p>
        </motion.div>

        {/* Plus-strip: inline on desktop, stacked with centred + on mobile */}
        <motion.div
          {...fadeUp}
          className="mt-7 flex flex-col items-center gap-1.5 sm:mt-9 sm:flex-row sm:justify-center sm:gap-3"
        >
          {['Unlimited AI Practice', '12 Hours of On-Demand Lectures', '9-Hour Coaching Day'].map(
            (chip, index) => (
              <div key={chip} className="contents">
                {index > 0 && (
                  <span className="text-lg font-medium text-muted" aria-hidden="true">
                    +
                  </span>
                )}
                <span className="rounded-xl border border-[#E4DDC9] bg-white px-5 py-2.5 text-center text-sm font-medium text-heading shadow-elevation-1">
                  {chip}
                </span>
              </div>
            ),
          )}
        </motion.div>

        {/* Zone 1 — every day, at your pace */}
        <motion.div {...fadeUp} className="mt-10 sm:mt-14">
          <ZoneLabel>Every day, at your pace</ZoneLabel>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
            <div className="rounded-2xl border border-[#E4DDC9] bg-white px-5 py-5 shadow-elevation-1 sm:px-6">
              <p className="text-lg font-semibold text-heading">AI Practice</p>
              <p className="mt-0.5 text-[13px] font-medium" style={{ color: TEAL }}>
                3 months of access · unlimited
              </p>
              <div className="mt-3">
                <FeatureRows rows={AI_PRACTICE_ROWS} color={TEAL} />
              </div>
              <p className="mt-2 border-t-[0.5px] border-[#E4DDC9] pt-3 text-xs text-muted">£299 value</p>
            </div>

            <div className="rounded-2xl border border-[#E4DDC9] bg-white px-5 py-5 shadow-elevation-1 sm:px-6">
              <p className="text-lg font-semibold text-heading">On-Demand Lectures</p>
              <p className="mt-0.5 text-[13px] font-medium" style={{ color: TEAL }}>
                3 months of access · watch anytime
              </p>
              <div className="mt-3">
                <FeatureRows rows={LECTURE_ROWS} color={TEAL} />
              </div>
              <p className="mt-2 border-t-[0.5px] border-[#E4DDC9] pt-3 text-xs text-muted">£599 value</p>
            </div>
          </div>
        </motion.div>

        {/* Zone 2 — one day, live */}
        <motion.div {...fadeUp} className="mt-10 sm:mt-14">
          <ZoneLabel>One day, live</ZoneLabel>
          <div className="rounded-2xl border border-[#E4DDC9] bg-white px-5 py-5 shadow-elevation-1 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg font-semibold text-heading">Small-Group Coaching</p>
              <span className="self-start rounded-lg bg-[#FAEEDA] px-3 py-1 text-[12px] font-medium text-[#854F0B]">
                One full day · 9am to 6pm · Remote
              </span>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:gap-8">
              <div className="sm:flex-1">
                <FeatureRows rows={COACHING_ROWS} color={AMBER} />
                {/* Desktop: value under the rows; mobile: moved below the timetable */}
                <p className="mt-2 hidden border-t-[0.5px] border-[#E4DDC9] pt-3 text-xs text-muted sm:block">
                  Max 6 · £599 value
                </p>
              </div>

              <div className="mt-5 border-t-[0.5px] border-[#E4DDC9] pt-5 sm:mt-0 sm:w-[46%] sm:flex-shrink-0 sm:border-l-[0.5px] sm:border-t-0 sm:pl-8 sm:pt-0">
                <Timetable />
              </div>
            </div>

            <p className="mt-4 border-t-[0.5px] border-[#E4DDC9] pt-3 text-xs text-muted sm:hidden">
              Max 6 · £599 value
            </p>
          </div>
        </motion.div>

        {/* Closing strip */}
        <motion.div {...fadeUp} className="mt-10 border-t-[0.5px] border-[#D8CBB0] pt-6 text-center sm:mt-14">
          <p className="text-base font-medium text-heading sm:text-lg">
            Then sit your SCA.{' '}
            <span className="font-semibold text-[#27500A]">Pass, or claim your £500.</span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
