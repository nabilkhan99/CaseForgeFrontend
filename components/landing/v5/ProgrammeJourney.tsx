'use client';

import { motion } from 'framer-motion';
import { Check, MessageCircle, GraduationCap, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface OfferCard {
  icon: LucideIcon;
  name: string;
  when: string;
  remote?: boolean;
  bullets: React.ReactNode[];
  value: string;
}

const OFFERS: OfferCard[] = [
  {
    icon: MessageCircle,
    name: 'AI Practice',
    when: 'Every day, unlimited',
    bullets: [
      'Voice consultations, just like the real exam',
      '200 stations, built from the RCGP curriculum',
      'Unlimited attempts, no station credits',
      'Personalised feedback, mapped to each RCGP domain',
    ],
    value: '£299 value',
  },
  {
    icon: GraduationCap,
    name: 'Live Teaching',
    when: 'Once a month (weekend)',
    remote: true,
    bullets: [
      '12 hours of live teaching, split across three half-day sessions (each session lasts 4 hours)',
      'Consultation frameworks, time management, how each domain is marked',
      'Why candidates fail, and how to avoid it',
      'Difficult consultations: bad news, negotiation, third-party, telephone',
      'Delivered by an experienced GP educator',
      'Each session takes place on a Saturday or Sunday, once a month (specific dates provided on booking or upon request)',
    ],
    value: '£599 value',
  },
  {
    icon: Users,
    name: 'Small-Group Coaching',
    when: 'Once a month (weekend)',
    remote: true,
    bullets: [
      '9 hours of live coaching across three sessions (each session lasts 3 hours)',
      <>
        <strong className="font-semibold">Max class size of six</strong>, so
        every session stays personal
      </>,
      '6 full 12-minute mock stations per session, one consulted by each trainee',
      'An expert coach breaks down each one: how it would be marked, what to fix',
      "Different cases, different mistakes — your peers' stations teach you too",
      'Each session takes place on a Saturday or Sunday, once a month (specific dates provided on booking or upon request)',
    ],
    value: 'Max 6 · £599 value',
  },
];

function OfferCardView({ icon: Icon, name, when, remote, bullets, value }: OfferCard) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#E4DDC9] bg-white sm:mt-4">
      <div className="flex items-center gap-3 bg-[#FDF9F0] px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#FAEEDA] sm:h-10 sm:w-10">
          <Icon className="h-4 w-4 text-[#854F0B] sm:h-5 sm:w-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-heading sm:text-base">{name}</p>
        <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
          <span className="whitespace-nowrap rounded-md bg-[#E1F5EE] px-2 py-0.5 text-[9px] font-medium text-[#0F6E56] sm:text-xs">
            {when}
          </span>
          {remote && (
            <span className="whitespace-nowrap rounded-md bg-[#E1F5FE] px-2 py-0.5 text-[9px] font-medium text-[#0E7490] sm:text-xs">
              Remote
            </span>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 pt-0.5 sm:px-6 sm:pb-4">
        {bullets.map((bullet, index) => (
          <div key={index} className="mb-1 flex gap-2 text-xs leading-relaxed text-body sm:text-sm">
            <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-[#639922] sm:h-3.5 sm:w-3.5" aria-hidden="true" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-[10px] text-muted sm:px-6 sm:pb-4 sm:text-xs">{value}</p>
    </div>
  );
}

export default function ProgrammeJourney() {
  return (
    <section className="px-5 py-6 sm:px-8 sm:py-10">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-2 text-center text-xs font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-sm"
      >
        The complete programme
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.06 }}
        className="mb-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:mb-14 sm:gap-x-4"
      >
        {[
          { top: 'Unlimited AI', bottom: 'Practice' },
          { top: '12 Hours', bottom: 'Live Teaching' },
          { top: '9 Hours', bottom: 'Small-group Coaching' },
        ].map((box, index) => (
          <div key={box.top} className="flex items-center gap-x-3 sm:gap-x-4">
            {index > 0 && (
              <span className="text-lg font-medium text-muted sm:text-xl" aria-hidden="true">
                +
              </span>
            )}
            <div className="min-w-[7rem] rounded-xl border border-[#E4DDC9] bg-[#FDF9F0] px-4 py-3 text-center sm:min-w-[9rem] sm:px-6 sm:py-4">
              <p className="text-sm font-semibold text-heading sm:text-base">{box.top}</p>
              <p className="text-xs text-body sm:text-sm">{box.bottom}</p>
            </div>
          </div>
        ))}
      </motion.div>

      <div className="mx-auto max-w-2xl">
        {/* Stage 1: Sign up */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex gap-3 sm:gap-4"
        >
          <div className="flex w-10 flex-shrink-0 flex-col items-center sm:w-12">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1C1C1A] text-sm font-medium text-[#FAC775] sm:h-12 sm:w-12 sm:text-base">
              1
            </div>
            <div className="min-h-4 w-0 flex-1 border-l-[1.5px] border-dashed border-[#D8B98A]" />
          </div>
          <div className="min-w-0 flex-1 pb-4 sm:pb-6">
            <p className="mt-2 text-sm font-medium text-heading sm:mt-2.5 sm:text-lg">
              Sign up
            </p>
            <p className="text-xs leading-relaxed text-body sm:text-sm">
              Pick your intake month at checkout. Full AI access opens on the
              1st of your intake month.
            </p>
          </div>
        </motion.div>

        {/* Stage 2: Your 3 months */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="flex gap-3 sm:gap-4"
        >
          <div className="flex w-10 flex-shrink-0 flex-col items-center sm:w-12">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1C1C1A] text-sm font-medium text-[#FAC775] sm:h-12 sm:w-12 sm:text-base">
              2
            </div>
            <div className="min-h-4 w-0 flex-1 border-l-[1.5px] border-dashed border-[#D8B98A]" />
          </div>
          <div className="min-w-0 flex-1 pb-4 sm:pb-6">
            <p className="mt-2 text-sm font-medium text-heading sm:mt-2.5 sm:text-lg">
              Your 3 months
            </p>
            <p className="text-xs leading-relaxed text-body sm:text-sm">
              One platform you use every day. Two live sessions you attend
              every month.
            </p>
            {OFFERS.map((offer) => (
              <OfferCardView key={offer.name} {...offer} />
            ))}
          </div>
        </motion.div>

        {/* Stage 3: Sit the SCA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="flex gap-3 sm:gap-4"
        >
          <div className="flex w-10 flex-shrink-0 flex-col items-center sm:w-12">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1C1C1A] text-sm font-medium text-[#FAC775] sm:h-12 sm:w-12 sm:text-base">
              3
            </div>
            <div className="min-h-4 w-0 flex-1 border-l-[1.5px] border-dashed border-[#D8B98A]" />
          </div>
          <div className="min-w-0 flex-1 pb-4 sm:pb-6">
            <p className="mt-2 text-sm font-medium text-heading sm:mt-2.5 sm:text-lg">
              Sit the SCA
            </p>
            <p className="text-xs leading-relaxed text-body sm:text-sm">
              Walk in having consulted hundreds of times: alone, with a coach,
              and under the clock.
            </p>
          </div>
        </motion.div>

        {/* Pass */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="flex gap-3 sm:gap-4"
        >
          <div className="flex w-10 flex-shrink-0 flex-col items-center sm:w-12">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#27500A] text-[#EAF3DE] sm:h-12 sm:w-12">
              <Check className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mt-2 text-sm font-medium text-heading sm:mt-2.5 sm:text-lg">
              Pass
            </p>
            <p className="text-xs leading-relaxed text-body sm:whitespace-nowrap sm:text-[13px]">
              Or claim your £500: pass 200 stations, still fail your SCA? We pay
              you within 5 working days.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
