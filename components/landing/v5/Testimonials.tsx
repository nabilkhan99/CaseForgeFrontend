'use client';

import { motion } from 'framer-motion';

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
      'I’d tried other AI tools before and wasn’t impressed, so I went in sceptical. But with Fourteen Fisherman, the AI patients behave like the ones in my actual clinics, and the feedback was specific enough to feel like having my ES sit in on the consult. I fitted it into odd bits of time between clinics, which would’ve been impossible to arrange with a study partner.',
  },
  {
    name: 'Dr Harmeet Makan',
    meta: 'GP Registrar, East Midlands',
    avatar: HarmeetAvatar,
    quote:
      'Consulting a full mock in front of five other trainees was as grim as it sounds, at first. But there were only six of us, so the tutor had time to take my consultation apart properly and show me exactly where I was going wrong and how to fix it. I picked up as much watching the others as I did from my own turn.',
  },
  {
    name: 'Dr Zain Chowdhary',
    meta: 'GP Registrar, London',
    avatar: ZainAvatar,
    quote:
      'I expected the usual exam-technique waffle from the lectures. Instead it was super high yield: the few things that actually separate a pass from a fail in each domain, and the small habits costing people marks. I’ve carried so much of it into how I actually consult now.',
  },
];

export default function Testimonials() {
  return (
    <section className="px-5 py-6 sm:px-8 sm:py-10">
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
                <p className="text-xs font-medium text-heading sm:text-sm">{t.name}</p>
                <p className="text-[11px] text-muted sm:text-xs">{t.meta}</p>
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
