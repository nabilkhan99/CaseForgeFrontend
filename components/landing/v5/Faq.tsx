'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface QA {
  question: string;
  answer: string[];
}

const FAQS: QA[] = [
  {
    question: 'Will this actually help me pass?',
    answer: [
      "We're confident enough to put real money behind it. Pass all 200 stations, sit your SCA, and if you don't pass, we pay you £500 in cash. No other provider takes that risk with you.",
      "It's also the most comprehensive SCA preparation you'll find. Most options give you one dimension in isolation: a single day of lectures, a single day of small-group coaching, or an AI subscription on its own. The Complete SCA Course combines all three. You get AI voice practice on 200 stations, three 4-hour teaching sessions from a GP educator who knows what examiners are looking for, and three 3-hour small-group coaching sessions with a GP tutor, where you consult a case in person and get it broken down for you. All three are built from the RCGP curriculum and the three marking domains, so nothing in the real exam catches you out.",
    ],
  },
  {
    question: 'Can I use my study budget for this?',
    answer: [
      'The Complete SCA Course is built as a course, not a subscription, which is the distinction most NHS England study budgets care about (they typically cap around £600, and it is priced at £599). Eligibility varies by deanery, so check your local study budget policy before you book. Most trainees pay nothing out of pocket.',
    ],
  },
  {
    question: 'If I fail, do I actually get the £500?',
    answer: [
      "Yes, and it is a cash payment, not a credit. The condition is that you pass all 200 mock stations first, not just attempt them. You get unlimited tries at each one, with no cap, so passing every station is entirely in your hands. Once you've passed all 200, if you then sit your real SCA and don't pass, email us a screenshot of your result. We confirm you've passed all 200, and we pay you £500 within 5 working days.",
    ],
  },
  {
    question: 'Which plan do I actually need?',
    answer: [
      'Most trainees choose the Complete SCA Course, which is why we recommend it: AI practice plus live teaching and small-group coaching. The Self-Study plan is the AI practice on its own, best if you just want stations to work through. The Intensive plan adds weekly one-to-one coaching and starts with a call rather than checkout, for trainees who want individual support throughout.',
    ],
  },
  {
    question: 'Can I start practising straight away?',
    answer: [
      'Yes. Your AI practice unlocks the moment you join, so you can start your first station today. That access runs for three months. For the Complete SCA Course, the three months are counted from the first day of your intake month, not your join date, so booking earlier means longer access at no extra cost. For example, if you join the November intake on 15 September, you get access straight away on 15 September and keep it until the end of January. With the Self-Study plan, access starts immediately and runs for three months from your purchase date.',
      'One exception applies to our first intake in September. Because the course goes live on 1 September, all September access, on both the Self-Study and Complete plans, starts on 1 September, whenever you book. If you buy in July or August, your access still begins on 1 September, not on your purchase date.',
    ],
  },
  {
    question: 'Is this actually like the real SCA?',
    answer: [
      "Yes, deliberately so. Every AI station is a voice consultation, exactly like sitting across from a simulated patient on the day, built from the RCGP curriculum and scored across the three official marking domains: data gathering, clinical management, and relating to others. But practice alone isn't what gets you over the line. The teaching covers the core curriculum in a structured way, so you learn the frameworks properly rather than picking them up piecemeal. The small-group coaching puts you in front of a GP tutor who watches you consult a live case and gives you feedback in person, on your own performance, not a generic model answer. That is the point of blending all three: the AI gives you the volume and repetition, the teaching gives you the structure and raw learning, and the coaching gives you the personalisation. By the time you walk into your SCA, the format, the pressure, and the marking already feel familiar.",
    ],
  },
  {
    question: 'When are the live teaching and small-group coaching sessions?',
    answer: [
      'The live teaching and the small-group coaching each run once a month, for every month of your programme. They will not always land on the same weekend as each other, so we give you the exact dates for your intake when you book, or on request. Each session takes place on a Saturday or Sunday, once a month, so you can plan around your timetable well in advance. All sessions are remote, and a link to join is sent in advance.',
    ],
  },
  {
    question: 'What happens if I miss a session?',
    answer: [
      "Teaching sessions are recorded, so you can catch up on your own session whenever suits you. Coaching runs live and isn't recorded. If you can't make yours, we'll do our best to fit you into another class that month where a place is free, but we can't promise it, so tell us as early as you can.",
    ],
  },
  {
    question: "What if I don't have three months before my exam?",
    answer: [
      "You can still make it work. Your AI practice is unlimited and available the moment you buy, so you can begin straight away and go at whatever pace your exam date demands. From December 2026, once we've recorded a full teaching cycle, you'll also get access to recorded lectures covering the whole syllabus, so the core content is there even if some of your own live sessions fall close to or after your exam. If your exam is sooner than that, get in touch with us first so we can work out the best way to get you the content you need in time. For coaching, if a slot happens to be free in an earlier class we'll try to get you into it, but that depends on availability and isn't something we can guarantee. Around three months gives you the ideal spacing to absorb everything, but the course can be completed in less time.",
    ],
  },
  {
    question: 'How much time will this take each week?',
    answer: [
      'The AI patients are available to practise with 24/7, so you set the pace around your timetable and fit stations in whenever you have a gap. The only fixed commitment is light: a 4-hour teaching session and a 3-hour coaching session, each once a month on a weekend date confirmed in advance, so you can plan around them.',
    ],
  },
  {
    question: 'What if I change my mind?',
    answer: [
      'All of our plans are non-refundable. Please make sure the intake you choose works for you before you complete checkout, and if you are unsure which one suits your exam date, ask us first and we will help you choose.',
    ],
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="px-5 py-6 sm:px-8 sm:py-10">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-5 text-center text-xs font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:mb-8 sm:text-sm"
      >
        Common questions
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="mx-auto max-w-3xl rounded-2xl border border-[#E4DDC9] bg-white px-5 sm:px-8"
      >
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={faq.question}
              className={
                index !== FAQS.length - 1
                  ? 'border-b border-[#E4DDC9]'
                  : ''
              }
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-medium text-heading sm:py-5 sm:text-base"
              >
                {faq.question}
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-[#854F0B] transition-transform duration-150 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="pb-4 sm:pb-6">
                  {faq.answer.map((paragraph, paragraphIndex) => (
                    <p
                      key={paragraphIndex}
                      className={`text-sm leading-relaxed text-body sm:text-base ${
                        paragraphIndex !== 0 ? 'mt-3 sm:mt-4' : ''
                      }`}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}
