'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import type { User } from '@supabase/supabase-js';

const PLANS = [
  {
    slug: 'sprint' as const,
    name: 'The Sprint',
    price: 79,
    duration: '30 days',
    tagline: 'Quick familiarisation',
    highlighted: false,
    badge: null,
    features: [
      { text: 'Unlimited AI consultations', included: true },
      { text: 'Full 250+ case catalog', included: true },
      { text: 'Detailed performance feedback', included: true },
      { text: 'Progress tracking dashboard', included: true },
      { text: 'Priority feedback', included: false },
      { text: 'Detailed analytics', included: false },
    ],
  },
  {
    slug: 'standard' as const,
    name: 'The Standard',
    price: 149,
    duration: '90 days',
    tagline: 'Comprehensive prep',
    highlighted: true,
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited AI consultations', included: true },
      { text: 'Full 250+ case catalog', included: true },
      { text: 'Detailed performance feedback', included: true },
      { text: 'Progress tracking dashboard', included: true },
      { text: 'Priority feedback', included: true },
      { text: 'Detailed analytics', included: false },
    ],
  },
  {
    slug: 'mastery' as const,
    name: 'The Mastery',
    price: 299,
    duration: '180 days',
    tagline: 'Ultimate confidence',
    highlighted: false,
    badge: null,
    features: [
      { text: 'Unlimited AI consultations', included: true },
      { text: 'Full 250+ case catalog', included: true },
      { text: 'Detailed performance feedback', included: true },
      { text: 'Progress tracking dashboard', included: true },
      { text: 'Priority feedback', included: true },
      { text: 'Detailed analytics', included: true },
    ],
  },
];

const faqs = [
  {
    q: 'Can I try before I pay?',
    a: 'Yes — try 1 free AI consultation with no signup required. Experience the full platform before committing.',
  },
  {
    q: 'What happens when my plan expires?',
    a: 'Your access pauses but your progress and performance data are saved. Purchase a new plan at any time to pick up where you left off.',
  },
  {
    q: 'Can I extend my plan?',
    a: 'Absolutely. Buy another plan at any time to get a fresh block of access. Your progress carries over.',
  },
  {
    q: 'What are the 250+ cases?',
    a: 'Our full catalog includes 250+ practice scenarios covering rare presentations, complex multi-morbidity cases, and challenging communication scenarios — all mapped to RCGP curriculum areas.',
  },
  {
    q: 'Is this aligned with the RCGP curriculum?',
    a: 'Yes. All cases are mapped to the 26 RCGP clinical topic areas and assessed against the three SCA marking domains: Data Gathering, Clinical Management, and Interpersonal Skills.',
  },
];

function FAQItem({ faq, index }: { faq: { q: string; a: string }; index: number }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="border-b border-black/[0.06] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 min-h-[44px] text-left cursor-pointer"
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
    </div>
  );
}

function PricingContent() {
  const searchParams = useSearchParams();
  const showUpgradeBanner = searchParams.get('upgrade') === 'true';

  const [user, setUser] = useState<User | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
      if (user) {
        fetch('/api/subscription')
          .then((r) => r.json())
          .then((data) => {
            if (data.subscription) {
              setCurrentPlan(data.subscription.plan);
            }
          });
      }
    });
  }, []);

  const handleCheckout = async (plan: string) => {
    if (!user) {
      window.location.href = `/auth/sign-up?redirect=/pricing`;
      return;
    }

    setCheckoutLoading(plan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.redirect) {
        window.location.href = data.redirect;
      }
    } catch {
      setCheckoutLoading(null);
    }
  };

  return (
    <>
      <LandingNavbar user={user ? { id: user.id } : null} />
      <main className="min-h-[100dvh] bg-surface pt-24 pb-16 font-sans">
        <div className="max-w-[1000px] mx-auto px-6">
          {/* Upgrade banner */}
          {showUpgradeBanner && (
            <motion.div
              className="mb-8 p-4 rounded-xl text-center border border-primary/20"
              style={{ background: 'rgba(180,83,9,0.04)' }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[14px] text-heading font-medium">
                You need an active plan to access AI consultations.
              </p>
            </motion.div>
          )}

          {/* Header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary mb-3">
              Simple Pricing
            </div>
            <h1 className="text-[clamp(28px,4vw,44px)] font-bold text-heading tracking-[-0.02em] mb-3">
              One Payment, Full Access
            </h1>
            <p className="text-[15px] text-muted max-w-lg mx-auto leading-relaxed">
              Choose the depth of preparation that suits your timeline. All plans include unlimited AI consultations and the full case catalog.
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
            {PLANS.map((plan, i) => {
              const isCurrentPlan = currentPlan === plan.slug;
              const isLoading = checkoutLoading === plan.slug;

              return (
                <motion.div
                  key={plan.slug}
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
                      <span className="text-[13px] text-muted">/ one-off</span>
                    </div>
                    <p className="text-[12px] text-primary font-medium mt-1">{plan.duration} access</p>
                    <p className="text-[13px] text-muted mt-2 leading-relaxed">{plan.tagline}</p>
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
                  {isCurrentPlan ? (
                    <div className="w-full py-3 text-center text-[14px] font-semibold text-muted bg-black/[0.03] rounded-xl">
                      Current Plan
                    </div>
                  ) : plan.highlighted ? (
                    <PrimaryButton
                      fullWidth
                      onClick={() => handleCheckout(plan.slug)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Redirecting...' : `Get ${plan.name}`}
                    </PrimaryButton>
                  ) : (
                    <SecondaryButton
                      fullWidth
                      onClick={() => handleCheckout(plan.slug)}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Redirecting...' : `Get ${plan.name}`}
                    </SecondaryButton>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Free trial banner */}
          <div
            className="mb-16 p-6 sm:p-8 rounded-2xl text-center border border-black/[0.06]"
            style={{ background: 'rgba(22,163,74,0.03)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-success mb-2 inline-block">
              Try Free
            </span>
            <h3 className="text-[20px] font-bold text-heading mb-2">Try 1 Case Free</h3>
            <p className="text-[13px] text-muted max-w-md mx-auto mb-5 leading-relaxed">
              Experience a full AI consultation with no signup required. See how it works before you commit.
            </p>
            <Link href="/try" className="text-[13px] font-semibold text-primary hover:underline">
              Start Free Consultation &rarr;
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

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
