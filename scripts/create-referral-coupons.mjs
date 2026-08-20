/**
 * Creates (or verifies) the two Stripe Coupons behind the referee half of the
 * two-sided referral, then prints the env lines to paste into Vercel.
 *
 *   node scripts/create-referral-coupons.mjs           # live/test key from .env.local
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/create-referral-coupons.mjs
 *
 * Idempotent: coupon ids are fixed, so a second run reports "exists" rather than
 * minting duplicates. Amounts are read from lib/commerce/referrals.ts so the
 * coupon can never drift from the engine — if they disagree, this script fails
 * loudly rather than quietly discounting the wrong amount.
 */
import Stripe from 'stripe';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY is not set (checked env and .env.local)');
  process.exit(1);
}

// Parse the amounts straight out of the TS source — no build step, no drift.
const source = readFileSync('lib/commerce/referrals.ts', 'utf8');
const block = source.match(/REFEREE_DISCOUNT_BY_PLAN = \{([^}]*)\}/)?.[1];
if (!block) {
  console.error('Could not find REFEREE_DISCOUNT_BY_PLAN in lib/commerce/referrals.ts');
  process.exit(1);
}
const amounts = Object.fromEntries(
  [...block.matchAll(/(\w+):\s*(\d+)/g)].map(([, plan, pence]) => [plan, Number(pence)]),
);

const COUPONS = [
  { plan: 'complete', id: 'ff-referred-complete', env: 'STRIPE_COUPON_REFERRED_COMPLETE' },
  { plan: 'self_study', id: 'ff-referred-self-study', env: 'STRIPE_COUPON_REFERRED_SELF_STUDY' },
];

const stripe = new Stripe(key);
const mode = key.startsWith('sk_live') ? 'LIVE' : 'TEST';
console.log(`Stripe mode: ${mode}\n`);

const envLines = [];

for (const { plan, id, env } of COUPONS) {
  const amountOff = amounts[plan];
  if (!amountOff) {
    console.error(`No discount configured for plan "${plan}" — skipping`);
    continue;
  }

  let coupon;
  try {
    coupon = await stripe.coupons.retrieve(id);
    if (coupon.amount_off !== amountOff || coupon.currency !== 'gbp') {
      // Stripe coupons are immutable in amount: a mismatch needs a NEW id, not
      // an update, so fail rather than silently discounting the wrong number.
      console.error(
        `MISMATCH ${id}: Stripe has ${coupon.currency} ${coupon.amount_off}, ` +
          `code expects gbp ${amountOff}. Create a new coupon id and update the env var.`,
      );
      process.exitCode = 1;
      continue;
    }
    console.log(`exists  ${id}  £${amountOff / 100} off (${plan})`);
  } catch (err) {
    if (err?.code !== 'resource_missing') throw err;
    coupon = await stripe.coupons.create({
      id,
      amount_off: amountOff,
      currency: 'gbp',
      duration: 'once',
      name: `Referred — £${amountOff / 100} off`,
      metadata: { plan, purpose: 'two_sided_referral' },
    });
    console.log(`created ${id}  £${amountOff / 100} off (${plan})`);
  }

  envLines.push(`${env}=${coupon.id}`);
}

console.log(`\nSet these in Vercel (${mode.toLowerCase()} environment) and .env.local:\n`);
console.log(envLines.join('\n'));
