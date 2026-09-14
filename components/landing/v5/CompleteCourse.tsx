'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Accent, Pill, TILE } from './editorial';

interface FeatureRow {
  lead: string;
  tail: string;
  /** Inner marks of a 24x24 feature icon (from the approved icon system). */
  icon: ReactNode;
}

const AI_PRACTICE_ROWS: FeatureRow[] = [
  {
    lead: 'Voice consultations',
    tail: 'just like the real exam',
    icon: (
      <>
        <rect x="9.25" y="3" width="5.5" height="9.5" rx="2.75" />
        <path d="M5.5 10.5a6.5 6.5 0 0 0 13 0" />
        <path d="M12 17v3.5M9 20.5h6" />
      </>
    ),
  },
  {
    lead: '200 stations',
    tail: 'built from the RCGP curriculum',
    icon: (
      <>
        <path d="M12 3.5 20 7.5 12 11.5 4 7.5Z" />
        <path d="M4 12l8 4 8-4" />
        <path d="M4 16.5l8 4 8-4" />
      </>
    ),
  },
  {
    lead: 'Unlimited attempts',
    tail: 'no station credits',
    icon: (
      <>
        <path d="M12 12c-1-1.8-2.1-2.9-3.4-2.9A2.9 2.9 0 0 0 5.7 12a2.9 2.9 0 0 0 2.9 2.9c1.3 0 2.4-1.1 3.4-2.9z" />
        <path d="M12 12c1-1.8 2.1-2.9 3.4-2.9A2.9 2.9 0 0 1 18.3 12a2.9 2.9 0 0 1-2.9 2.9c-1.3 0-2.4-1.1-3.4-2.9z" />
      </>
    ),
  },
  {
    lead: 'Personalised feedback',
    tail: 'mapped to each RCGP domain',
    icon: (
      <>
        <path d="M6 4h12.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-3.5 3.2V15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="M8.7 9.7l2.1 2.1 4.4-4.4" />
      </>
    ),
  },
];

const LECTURE_ROWS: FeatureRow[] = [
  {
    lead: 'Everything you need for the exam',
    tail: 'the whole SCA, taught across 14 lectures and 8.5 hours',
    icon: (
      <>
        <path d="M12 7c-2-1.5-4.5-2.1-8-2.1V18.4c3.5 0 6 .6 8 2.1 2-1.5 4.5-2.1 8-2.1V4.9c-3.5 0-6 .6-8 2.1z" />
        <path d="M12 7v13.5" />
      </>
    ),
  },
  {
    lead: 'Why candidates fail',
    tail: 'and how to avoid it',
    icon: (
      <>
        <path d="M10.3 4.9a2 2 0 0 1 3.4 0l7.1 12.1a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3z" />
        <path d="M12 9.3v4.4" />
        <circle cx="12" cy="16.6" r="0.4" fill="currentColor" />
      </>
    ),
  },
  {
    lead: 'Difficult consultations',
    tail: 'bad news, negotiation, third-party',
    icon: (
      <>
        <path d="M6 4h12.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-3.5 3.2V15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="M7.7 10.6l2.1-2.1 2.2 2.1 2.1-2.1 2.2 2.1" />
      </>
    ),
  },
  {
    lead: 'A GP educator',
    tail: 'who knows what examiners look for',
    icon: (
      <>
        <path d="M5 3.5v5a4.5 4.5 0 0 0 9 0v-5" />
        <path d="M9.5 13v2.5a5 5 0 0 0 10 0v-1.9" />
        <circle cx="19.5" cy="11.1" r="2.3" />
      </>
    ),
  },
];

const TEAL = '#0F6E56';

interface FeatureRowsProps {
  rows: FeatureRow[];
  color: string;
  tint: string;
}

function FeatureRows({ rows, color, tint }: FeatureRowsProps) {
  return (
    <div>
      {rows.map((row, index) => (
        <div
          key={row.lead}
          className={`flex items-start gap-3.5 py-3 ${index > 0 ? 'border-t border-heading/[0.06]' : ''}`}
        >
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: tint }}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[19px] w-[19px]"
              fill="none"
              stroke={color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {row.icon}
            </svg>
          </span>
          <div className="min-w-0 pt-0.5">
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
    <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500">
      {children}
    </p>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

/**
 * "The Complete Course" section: what the course includes. The two self-paced
 * tiles (AI practice and lectures) only. The 3 hour one to one coaching session
 * is not repeated here as a tile: `OneToOneCoaching` sits directly below this
 * section and covers it in full.
 */
export default function CompleteCourse() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        {/* Heading block */}
        <motion.div {...fadeUp} className="text-center">
          <Pill>The Complete Course</Pill>
          <h2 className="mx-auto mt-7 max-w-2xl text-3xl font-medium leading-[1.14] tracking-tight text-heading sm:text-5xl">
            3 months of unlimited AI stations and lectures.{' '}
            <Accent>Plus a private 3 hour coaching session.</Accent>
          </h2>
          <p className="mx-auto mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[15px] font-medium text-heading sm:text-lg">
            {['Unlimited AI Practice', '8.5 Hours of On-Demand Lectures', 'One to One Coaching'].map(
              (chip, index) => (
                <span key={chip} className="contents">
                  {index > 0 && (
                    <span className="text-primary" aria-hidden="true">
                      +
                    </span>
                  )}
                  <span>{chip}</span>
                </span>
              ),
            )}
          </p>
        </motion.div>

        {/* Zone 1: every day, at your pace */}
        <motion.div {...fadeUp} className="mt-14 sm:mt-16">
          <ZoneLabel>Every day, at your pace</ZoneLabel>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
            <div className={`${TILE} px-6 py-6 sm:px-7`}>
              <p className="text-xl font-semibold text-heading">AI Practice</p>
              <p className="mt-0.5 text-[13px] font-medium" style={{ color: TEAL }}>
                3 months of access · unlimited
              </p>
              <div className="mt-3">
                <FeatureRows rows={AI_PRACTICE_ROWS} color={TEAL} tint="rgba(15,110,86,0.10)" />
              </div>
              <p className="mt-2 border-t border-heading/[0.06] pt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                £299 value
              </p>
            </div>

            <div className={`${TILE} px-6 py-6 sm:px-7`}>
              <p className="text-xl font-semibold text-heading">On-Demand Lectures</p>
              <p className="mt-0.5 text-[13px] font-medium" style={{ color: TEAL }}>
                3 months of access · watch anytime
              </p>
              <div className="mt-3">
                <FeatureRows rows={LECTURE_ROWS} color={TEAL} tint="rgba(15,110,86,0.10)" />
              </div>
              <p className="mt-2 border-t border-heading/[0.06] pt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                £599 value
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
