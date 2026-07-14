import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return _stripe;
}

export const PLAN_CONFIG = {
  sprint: {
    priceId: process.env.STRIPE_PRICE_SPRINT!,
    name: 'The Sprint',
    price: 7900,
    durationDays: 30,
    tagline: 'Quick familiarisation',
    description: '30 days of unlimited practice',
  },
  standard: {
    priceId: process.env.STRIPE_PRICE_STANDARD!,
    name: 'The Standard',
    price: 14900,
    durationDays: 90,
    tagline: 'Comprehensive prep',
    description: '90 days — the sweet spot for SCA prep',
  },
  mastery: {
    priceId: process.env.STRIPE_PRICE_MASTERY!,
    name: 'The Mastery',
    price: 29900,
    durationDays: 180,
    tagline: 'Ultimate confidence',
    description: '180 days of deep, comprehensive preparation',
  },
} as const;

export type PlanSlug = keyof typeof PLAN_CONFIG;

export function isValidPlan(plan: string): plan is PlanSlug {
  return plan in PLAN_CONFIG;
}
