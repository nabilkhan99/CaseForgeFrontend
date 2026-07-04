'use client';

import { motion } from 'framer-motion';

interface Testimonial {
  name: string;
  meta: string;
  quote: string;
  avatar: React.ReactNode;
}

const SarahAvatar = (
  <svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true">
    <rect width="34" height="34" fill="#DCE8D5" />
    <circle cx="17" cy="13" r="6.5" fill="#F1C9A5" />
    <path
      d="M17 6 a6.5 6.5 0 0 1 6.5 6.5 q-2 -3 -6.5 -3 -4.5 0 -6.5 3 a6.5 6.5 0 0 1 6.5 -6.5z"
      fill="#6B4226"
    />
    <path d="M10.5 12 q-1 8 2 11 l-3.5 0 q-1 -6 1.5 -11z" fill="#6B4226" />
    <path d="M23.5 12 q1 8 -2 11 l3.5 0 q1 -6 -1.5 -11z" fill="#6B4226" />
    <path d="M5 34 q0 -12 12 -12 q12 0 12 12z" fill="#37536B" />
    <circle cx="14.5" cy="12.5" r="0.9" fill="#1B1B1B" />
    <circle cx="19.5" cy="12.5" r="0.9" fill="#1B1B1B" />
    <path
      d="M15 16 q2 1.5 4 0"
      stroke="#1B1B1B"
      strokeWidth="0.8"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const JamesAvatar = (
  <svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true">
    <rect width="34" height="34" fill="#E8DED2" />
    <circle cx="17" cy="13" r="6.5" fill="#EAC086" />
    <path
      d="M17 6 a6.5 6.5 0 0 1 6.5 7 l-1.8 -0.6 q0.5 -3 -2 -4.4 -1.5 1.5 -4.7 1.5 -2.7 0 -3.5 -1 -1 1 -1 4 l-1.8 0.5 a6.5 6.5 0 0 1 8.3 -7z"
      fill="#2B2B2B"
    />
    <path d="M5 34 q0 -12 12 -12 q12 0 12 12z" fill="#5F7470" />
    <circle cx="14.5" cy="13" r="0.9" fill="#1B1B1B" />
    <circle cx="19.5" cy="13" r="0.9" fill="#1B1B1B" />
    <path
      d="M15 16.5 q2 1.5 4 0"
      stroke="#1B1B1B"
      strokeWidth="0.8"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M13.5 19 q3.5 2.5 7 0 l0 1.5 q-3.5 2 -7 0z"
      fill="#2B2B2B"
      opacity="0.55"
    />
  </svg>
);

const AminaAvatar = (
  <svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true">
    <rect width="34" height="34" fill="#F0E3D0" />
    <path
      d="M17 5 q8 0 8 9 l0 6 q0 3 -2.5 3 l-11 0 q-2.5 0 -2.5 -3 l0 -6 q0 -9 8 -9z"
      fill="#7A4E2D"
    />
    <circle cx="17" cy="14" r="5.8" fill="#B57A4A" />
    <circle cx="14.8" cy="13.5" r="0.9" fill="#1B1B1B" />
    <circle cx="19.2" cy="13.5" r="0.9" fill="#1B1B1B" />
    <path
      d="M15.2 17 q1.8 1.4 3.6 0"
      stroke="#1B1B1B"
      strokeWidth="0.8"
      fill="none"
      strokeLinecap="round"
    />
    <path d="M5 34 q0 -12 12 -12 q12 0 12 12z" fill="#8A4A5E" />
    <path
      d="M9 21 q-1.5 -8 3 -12 M25 21 q1.5 -8 -3 -12"
      stroke="#7A4E2D"
      strokeWidth="2.6"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah',
    meta: 'GP2, London',
    avatar: SarahAvatar,
    quote:
      'The voice consultations feel like the real exam. I did stations on my lunch breaks, and the feedback showed me exactly which domain I was losing marks in.',
  },
  {
    name: 'James',
    meta: 'ST3, Yorkshire',
    avatar: JamesAvatar,
    quote:
      "Doing a full timed mock in front of five others was daunting, but the coach's breakdown changed how I consult. I learnt as much from their stations as my own.",
  },
  {
    name: 'Amina',
    meta: 'GP registrar, West Midlands',
    avatar: AminaAvatar,
    quote:
      'The teaching sessions gave my revision a structure it never had. How each domain is marked, and why people fail, finally made sense.',
  },
];

export default function Testimonials() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto flex max-w-5xl snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pb-0">
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="w-[80%] flex-shrink-0 snap-start rounded-2xl border border-[#E4DDC9] bg-white p-5 shadow-elevation-1 sm:w-auto sm:p-6"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="h-[34px] w-[34px] flex-shrink-0 overflow-hidden rounded-full">
                {t.avatar}
              </div>
              <div>
                <div
                  className="text-xs tracking-widest text-[#EF9F27]"
                  aria-label="5 out of 5 stars"
                >
                  ★★★★★
                </div>
                <p className="text-xs font-medium text-heading sm:text-sm">
                  {t.name} · {t.meta}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-body sm:text-sm">
              {t.quote}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
