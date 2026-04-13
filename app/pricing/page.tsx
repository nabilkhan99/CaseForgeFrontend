'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';

const plans = [
  {
    name: 'Monthly',
    price: '69',
    period: '/month',
    description: 'Flexible month-to-month access. Cancel anytime.',
    badge: null,
    highlighted: false,
    cta: 'Start Monthly',
    href: '/auth/sign-up?plan=monthly',
    features: [
      { text: 'AI-powered practice sessions', included: true },
      { text: '78 free RCGP-mapped cases', included: true },
      { text: 'Detailed performance feedback', included: true },
      { text: 'Progress tracking dashboard', included: true },
      { text: 'Full 250+ case catalog', included: false },
      { text: 'Practice cases with friends', included: false },
    ],
  },
  {
    name: '3 Months',
    price: '149',
    period: ' one-time',
    description: 'Best value — everything you need to pass the SCA.',
    badge: 'Most Popular',
    highlighted: true,
    cta: 'Choose Best Value',
    href: '/auth/sign-up?plan=quarterly',
    features: [
      { text: 'AI-powered practice sessions', included: true },
      { text: '78 free RCGP-mapped cases', included: true },
      { text: 'Detailed performance feedback', included: true },
      { text: 'Progress tracking dashboard', included: true },
      { text: 'Full 250+ case catalog', included: true },
      { text: 'Practice cases with friends', included: true },
    ],
  },
  {
    name: '12 Months',
    price: '399',
    period: ' one-time',
    description: 'Full year of unlimited access for long-term prep.',
    badge: null,
    highlighted: false,
    cta: 'Start Annual',
    href: '/auth/sign-up?plan=annual',
    features: [
      { text: 'AI-powered practice sessions', included: true },
      { text: '78 free RCGP-mapped cases', included: true },
      { text: 'Detailed performance feedback', included: true },
      { text: 'Progress tracking dashboard', included: true },
      { text: 'Full 250+ case catalog', included: true },
      { text: 'Practice cases with friends', included: true },
    ],
  },
];

const comparisonFeatures = [
  { label: 'AI practice sessions', monthly: true, quarterly: true, annual: true },
  { label: '78 RCGP-mapped cases', monthly: true, quarterly: true, annual: true },
  { label: 'Performance feedback', monthly: true, quarterly: true, annual: true },
  { label: 'Progress dashboard', monthly: true, quarterly: true, annual: true },
  { label: 'Full 250+ case catalog', monthly: false, quarterly: true, annual: true },
  { label: 'Practice with friends', monthly: false, quarterly: true, annual: true },
  { label: 'Cancel anytime', monthly: true, quarterly: false, annual: false },
  { label: 'Cost per month', monthly: '\u00A369', quarterly: '\u00A349.67', annual: '\u00A333.25' },
];

const faqs = [
  {
    q: 'Can I try before I pay?',
    a: 'Absolutely. We offer 78 completely free RCGP cases that you can practice with a friend. You can also try a free mock station with our AI to experience the full platform.',
  },
  {
    q: 'What happens after my 3-month plan ends?',
    a: 'Your access expires at the end of the 3-month period. You can renew at any time. Your progress and performance data are saved.',
  },
  {
    q: 'Can I cancel my monthly plan anytime?',
    a: 'Yes. The monthly plan is completely flexible \u2014 cancel anytime from your dashboard with no penalties.',
  },
  {
    q: 'What are the 250+ cases?',
    a: 'Beyond the 78 free cases, our expanded catalog includes 250+ practice scenarios covering rare presentations, complex multi-morbidity cases, and challenging communication scenarios.',
  },
  {
    q: 'Is this aligned with the RCGP curriculum?',
    a: 'Yes. All cases are mapped to the 26 RCGP clinical topic areas and assessed against the three SCA marking domains: Data Gathering, Clinical Management, and Interpersonal Skills.',
  },
];

function FAQItem({ faq, index }: { faq: { q: string; a: string }; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <motion.div
      className="border-b border-black/[0.06] last:border-b-0"
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.06 * index }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
        aria-expanded={open}
      >
        <h4 className="text-[14px] font-semibold text-heading pr-4">{faq.q}</h4>
        <motion.svg
          className="w-4 h-4 text-muted flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <p className="pb-4 text-[13px] text-muted leading-relaxed">{faq.a}</p>
      </div>
    </motion.div>
  );
}

export default function PricingPage() {
  return (
    <>
      <LandingNavbar user={null} />
      <main className="min-h-screen bg-surface pt-24 pb-16 font-sans">
        <div className="max-w-[1000px] mx-auto px-6">
          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          >
            <h1 className="text-[clamp(28px,4vw,44px)] font-bold text-heading tracking-[-0.02em] mb-3">
              Choose Your Plan
            </h1>
            <p className="text-[15px] text-muted max-w-lg mx-auto leading-relaxed">
              All plans include access to 78 free RCGP practice cases.
              Upgrade for AI-powered sessions and the full case catalog.
            </p>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-12 text-[12px] text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <span>Trusted by GP trainees across the UK</span>
            <span className="hidden sm:inline text-black/10">&middot;</span>
            <span>RCGP curriculum aligned</span>
          </motion.div>

          {/* Pricing tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={`relative rounded-2xl bg-surface-raised border p-7 ${
                  plan.highlighted
                    ? 'border-l-[3px] border-l-primary border-t-black/[0.06] border-r-black/[0.06] border-b-black/[0.06]'
                    : 'border-black/[0.06]'
                }`}
                style={{
                  boxShadow: plan.highlighted
                    ? '0 24px 64px rgba(180,83,9,0.08), 0 2px 4px rgba(0,0,0,0.04)'
                    : '0 2px 4px rgba(0,0,0,0.02)',
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <span
                    className="absolute -top-3 left-6 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
                  >
                    {plan.badge}
                  </span>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <h3 className={`text-[13px] font-semibold mb-2 ${plan.highlighted ? 'text-primary' : 'text-muted'}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[36px] font-bold text-heading">&pound;{plan.price}</span>
                    <span className="text-[13px] text-muted">{plan.period}</span>
                  </div>
                  {plan.name === '3 Months' && (
                    <p className="text-[12px] text-primary font-medium mt-1">&pound;49.67/month</p>
                  )}
                  <p className="text-[13px] text-muted mt-2 leading-relaxed">{plan.description}</p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature.text} className="flex items-start gap-2.5">
                      <svg
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${feature.included ? 'text-success' : 'text-black/15'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        {feature.included ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                        )}
                      </svg>
                      <span className={`text-[13px] ${feature.included ? 'text-body' : 'text-muted line-through'}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link href={plan.href}>
                  {plan.highlighted ? (
                    <PrimaryButton fullWidth>{plan.cta}</PrimaryButton>
                  ) : (
                    <SecondaryButton fullWidth>{plan.cta}</SecondaryButton>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="mb-16">
            <h2 className="text-[20px] font-bold text-heading text-center mb-6">Compare Plans</h2>
            <div className="border border-black/[0.06] rounded-2xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-4 border-b border-black/[0.06] bg-black/[0.01]">
                <div className="p-4 text-[12px] font-medium text-muted">Feature</div>
                <div className="p-4 text-[12px] font-medium text-muted text-center">Monthly</div>
                <div className="p-4 text-[12px] font-bold text-primary text-center" style={{ background: 'rgba(180,83,9,0.03)' }}>3 Months</div>
                <div className="p-4 text-[12px] font-medium text-muted text-center">12 Months</div>
              </div>

              {/* Data rows */}
              {comparisonFeatures.map((feat, i) => (
                <div
                  key={feat.label}
                  className={`grid grid-cols-4 border-b border-black/[0.04] last:border-b-0 ${i % 2 === 0 ? '' : 'bg-black/[0.01]'}`}
                >
                  <div className="p-4 text-[13px] text-body">{feat.label}</div>
                  {(['monthly', 'quarterly', 'annual'] as const).map((key, ci) => {
                    const val = feat[key];
                    return (
                      <div key={key} className={`p-4 text-center ${ci === 1 ? 'bg-primary/[0.02]' : ''}`}>
                        {typeof val === 'boolean' ? (
                          <svg
                            className={`w-4 h-4 mx-auto ${val ? 'text-success' : 'text-black/10'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            {val ? (
                              <polyline points="20 6 9 17 4 12" />
                            ) : (
                              <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                            )}
                          </svg>
                        ) : (
                          <span className={`text-[13px] font-semibold ${ci === 1 ? 'text-primary' : 'text-body'}`}>
                            {val}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Free cases banner */}
          <div
            className="mb-16 p-8 rounded-2xl text-center border border-black/[0.06]"
            style={{ background: 'rgba(22,163,74,0.03)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-success mb-2 inline-block">
              Always Free
            </span>
            <h3 className="text-[20px] font-bold text-heading mb-2">78 Cases &mdash; Free Forever</h3>
            <p className="text-[13px] text-muted max-w-md mx-auto mb-5 leading-relaxed">
              Not ready to subscribe? Practice with a friend using our complete library of 78 RCGP-mapped cases.
            </p>
            <Link href="/try" className="text-[13px] font-semibold text-primary hover:underline">
              Browse Free Cases &rarr;
            </Link>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto mb-8">
            <h2 className="text-[20px] font-bold text-heading text-center mb-6">
              Frequently Asked Questions
            </h2>
            <div>
              {faqs.map((faq, i) => (
                <FAQItem key={faq.q} faq={faq} index={i} />
              ))}
            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
