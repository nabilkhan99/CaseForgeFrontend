'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface QA {
  question: string;
  answer: string;
}

const FAQS: QA[] = [
  {
    question: 'What counts as a fail for the guarantee?',
    answer:
      "Pass all 200 mock stations first. If you then sit your real SCA and don't achieve a pass, email us a screenshot of your results. We verify your progress and pay you £500 within 5 working days.",
  },
  {
    question: 'Is this actually aligned with the real exam?',
    answer:
      'Every case is built directly from the RCGP curriculum and scored across the three official marking domains: Data gathering, Clinical management, Relating to others.',
  },
  {
    question: 'When does my access start?',
    answer:
      "Your AI platform access opens on the 1st of your intake month. For the September intake, that's 1 September. Teaching and coaching sessions run during your intake months as scheduled.",
  },
  {
    question: 'When do the teaching and coaching sessions happen?',
    answer:
      'Both run once a month on a weekend: one half-day teaching session and one small-group coaching session each month of your programme. Exact dates are confirmed when you book your intake.',
  },
  {
    question: 'What happens if I miss a session?',
    answer:
      "Teaching sessions are recorded, so you can catch up anytime. Coaching sessions run live and can't be replayed: if you can't make yours, we'll try to book you into another class that month where space allows, though this isn't guaranteed.",
  },
  {
    question: 'Will my deanery reimburse this?',
    answer:
      'Complete is structured as a course to fit most NHS England study budgets, which typically cap around £600. Eligibility varies by deanery, so check your local policy first.',
  },
  {
    question: 'Can I choose which month I start?',
    answer:
      'Yes. Every month is individually bookable, so you can pick the intake that fits your SCA date at checkout.',
  },
  {
    question: "What's the difference between the three plans?",
    answer:
      'Self-Study is AI practice only. Complete adds live teaching and small-group coaching. Intensive adds weekly 1:1 coaching on top, and starts with a call rather than self-serve checkout.',
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
                <p className="pb-4 text-sm leading-relaxed text-body sm:pb-6 sm:text-base">
                  {faq.answer}
                </p>
              )}
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}
