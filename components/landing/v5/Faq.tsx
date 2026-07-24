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
      "It's also the most comprehensive SCA preparation you'll find. Most options give you one dimension in isolation: a set of lectures, a day of small-group coaching, or an AI subscription on its own. The Complete SCA Course combines all three. You get AI voice practice on 200 stations, 12 hours of lectures, and a full-day Small-Group Coaching session with a GP tutor (9am to 6pm), where you consult full mock stations live and get each one broken down for you. All three are built from the RCGP curriculum and the three marking domains, so nothing in the real exam catches you out.",
    ],
  },
  {
    question: 'Can I use my study budget for this?',
    answer: [
      'The Complete SCA Course is built as a course, not a subscription, which is the distinction most NHS England study budgets care about (they typically cap around £600, and it is priced at £599). Eligibility varies by deanery. Most trainees pay nothing out of pocket.',
    ],
  },
  {
    question: 'If I fail, do I actually get the £500?',
    answer: [
      "Yes, and it is a cash payment, not a credit. The condition is that you pass all 200 mock stations first, not just attempt them. You get unlimited tries at each one, with no cap, so passing every station is entirely in your hands. Once you've passed all 200, if you then sit your real SCA and don't pass, email us a screenshot of your result. We confirm you've passed all 200 of our mock AI stations, and we pay you £500 within 5 working days.",
    ],
  },
  {
    question: 'Which plan do I actually need?',
    answer: [
      'Most trainees choose the Complete SCA Course, which is why we recommend it: AI practice plus on-demand lectures and Small-Group Coaching. The Self-Study plan is the AI practice on its own, best if you just want stations to work through. The Intensive plan adds weekly one-to-one coaching and starts with a call rather than checkout, for trainees who want individual support throughout.',
    ],
  },
  {
    question: 'Can I start practising straight away?',
    answer: [
      "Not yet — this is a pre-order. The course goes live on 1 September 2026, and everything starts together on that date: your AI practice, the on-demand lectures, and the coaching days. Your 3 months' access runs from 1 September, not from the day you order, so ordering early costs you nothing — it locks in your place and your pick of coaching day.",
    ],
  },
  {
    question: 'Is this actually like the real SCA?',
    answer: [
      "Yes, deliberately so. Every AI station is a voice consultation, exactly like sitting across from a simulated patient on the day, built from the RCGP curriculum and scored across the three official marking domains: data gathering, clinical management, and relating to others. But practice alone isn't what gets you over the line. The lectures cover the core curriculum in a structured way, so you learn the frameworks properly rather than picking them up piecemeal. The Small-Group Coaching puts you in front of a GP tutor who watches you consult a live case and gives you feedback on your own performance, not a generic model answer. That is the point of combining all three: the AI gives you the volume and repetition, the lectures give you the structure and raw learning, and the coaching gives you the personalisation. By the time you walk into your SCA, the format, the pressure, and the marking already feel familiar.",
    ],
  },
  {
    question: 'When do the lectures and the coaching day happen?',
    answer: [
      "The lectures are on demand, so you watch them whenever suits you, from any device, as often as you like, throughout your 3 months' access. Your Small-Group Coaching runs as one full day, 9am to 6pm, on a Saturday or Sunday: you pick your date from the available coaching days at checkout. The coaching day is remote and live, and a link to join is sent in advance.",
    ],
  },
  {
    question: "What happens if I can't make my coaching day?",
    answer: [
      "The lectures are on demand, so there is nothing to miss there. The coaching day runs live and isn't recorded, so tell us as early as you can if your date no longer works. We'll do our best to move you onto another coaching day where a place is free, but places are capped at six per class, so we can't promise it.",
    ],
  },
  {
    question: 'What if my exam is soon?',
    answer: [
      "That's exactly what this is built for. Your AI practice is unlimited and available the moment you buy, and the lectures are on demand, so you can work through all 12 hours as quickly as your exam date demands: there is no fixed schedule holding you to a slower pace. For the coaching day, simply pick the date at checkout that falls before your exam.",
    ],
  },
  {
    question: 'How much time will this take each week?',
    answer: [
      'The AI patients are available to practise with 24/7, and the lectures are on demand, so you set the pace around your timetable and fit both in whenever you have a gap. The only fixed commitment is one full coaching day, 9am to 6pm on a weekend, on a date you choose at checkout.',
    ],
  },
  {
    question: 'What if I change my mind?',
    answer: [
      'All of our plans are non-refundable. Please make sure the coaching day you choose works for you before you complete checkout, and if you are unsure, ask us first and we will help you choose.',
    ],
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
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
              className={index !== FAQS.length - 1 ? 'border-b border-[#E4DDC9]' : ''}
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
