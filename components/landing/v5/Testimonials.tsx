'use client';

import { motion } from 'framer-motion';
import { TILE } from './editorial';

interface Testimonial {
  name: string;
  meta: string;
  quote: string;
  avatar: React.ReactNode;
}

const AmirAvatar = (
  <img
    src="/images/reviews/amir-hussain.jpeg"
    alt="Dr Amir Hussain"
    width={68}
    height={68}
    className="h-full w-full rounded-full object-cover"
  />
);

const HarmeetAvatar = (
  <img
    src="/images/reviews/harmeet-makan.jpeg"
    alt="Dr Harmeet Makan"
    width={68}
    height={68}
    className="h-full w-full rounded-full object-cover"
  />
);

const ZainAvatar = (
  <img
    src="/images/reviews/zain-chowdhary.jpeg"
    alt="Dr Zain Chowdhary"
    width={68}
    height={68}
    className="h-full w-full rounded-full object-cover object-top"
  />
);

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Dr Amir Hussain',
    meta: 'GP Registrar, Wessex',
    avatar: AmirAvatar,
    quote:
      'Consulting a full mock in front of five other trainees was as grim as it sounds, at first. But there were only six of us, so the tutor had time to take my consultation apart properly, show me exactly where I was going wrong, and explain how to fix it. I picked up as much from watching the others as I did from having my own consultation reviewed in detail.',
  },
  {
    name: 'Dr Harmeet Makan',
    meta: 'GP Registrar, East Midlands',
    avatar: HarmeetAvatar,
    quote:
      'I’d tried other AI tools before and wasn’t impressed, so I went in sceptical. But with Fourteen Fisherman, the AI patients felt like those in my own clinics, and the feedback felt specific enough to be like having my ES sit in on the consultation. It also made practising super flexible: no hassle arranging study partners, and it was ready whenever I had time.',
  },
  {
    name: 'Dr Zain Chowdhary',
    meta: 'GP Registrar, London',
    avatar: ZainAvatar,
    quote:
      'I expected the usual exam-technique waffle from the lectures. Instead, they were genuinely high yield: the things that separate a pass from a fail in each domain, the small habits that cost people marks, and exactly how to improve them. I’ve carried so much of it into the way I structure consultations and communicate with patients in everyday practice.',
  },
];

export default function Testimonials() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      {/* overflow-y-hidden is load-bearing: setting only overflow-x makes the
          CSS-computed overflow-y `auto`, so the carousel scrolled vertically
          as well as horizontally on mobile. */}
      <div className="mx-auto flex max-w-5xl snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pt-1 pb-5 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pt-0 sm:pb-0">
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`flex w-[80%] flex-shrink-0 snap-start flex-col ${TILE} p-6 sm:w-auto sm:p-7`}
          >
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full">
                {t.avatar}
              </span>
              <span>
                <span className="block text-sm font-semibold text-heading">{t.name}</span>
                <span className="block text-xs text-muted">{t.meta}</span>
              </span>
              <span
                className="ml-auto text-[11px] tracking-widest text-[#EF9F27]"
                aria-label="5 out of 5 stars"
              >
                ★★★★★
              </span>
            </div>
            <blockquote className="mt-5 flex-1">
              <p className="text-[15px] leading-[1.65] text-body">{t.quote}</p>
            </blockquote>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}
