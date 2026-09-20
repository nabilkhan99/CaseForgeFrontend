import { Suspense } from 'react';
import type { Metadata } from 'next';
import AppNavbar from '@/components/ui/AppNavbar';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { AccessNotice, Faq, GuaranteeCard, NhsBanner } from '@/components/landing/v5';
import PricingTable from '@/components/landing/v5/PricingTable';
import { getPlan } from '@/lib/commerce/plans';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { canSwitchPlan } from '@/lib/commerce/upgrade';
import { pageMetadata } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

/**
 * Without this the page inherits the root layout's canonical, which names the
 * homepage — so /pricing told Google it was a duplicate of / and never ranked
 * on its own. `pageMetadata` writes a self-referencing canonical along with the
 * Open Graph and Twitter tags.
 */
export const metadata: Metadata = pageMetadata({
  title: 'Pricing',
  description:
    'AI practice on 200 stations, 8.5 hours of on-demand lectures and a 3 hour one to one coaching session. Fail your SCA after passing all 200 stations, and we pay you £500.',
  path: '/pricing',
});

/**
 * The plans page, for strangers and for customers.
 *
 * Server-rendered rather than client-fetched so a signed-in customer never sees
 * the logged-out marketing nav flash before their own: the nav, the "Your plan"
 * badge and the inert CTA all arrive with the HTML, decided by the same
 * entitlement the gate uses.
 */
export default async function PricingPage() {
  const { user, entitlement } = await getServerEntitlement();
  const signedIn = Boolean(user);
  // A customer who already bought is not "pre-ordering" — they're here to
  // extend, upgrade or renew. The acquisition header is for strangers.
  const customer = signedIn && Boolean(entitlement.plan);
  const planName = entitlement.plan ? getPlan(entitlement.plan)?.name ?? null : null;

  return (
    <div className="min-h-[100dvh] bg-[#F7F2E7] font-sans">
      {signedIn ? <AppNavbar /> : <LandingNavbar user={null} />}
      <main className="flex flex-col gap-14 pb-20 pt-32 sm:gap-20 sm:pt-40">
        <header className="px-5 text-center sm:px-8">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-xs">
            {customer ? `Your plan${planName ? ` · ${planName}` : ''}` : 'Start today'}
          </p>
          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-heading sm:text-5xl">
            AI Practice + On-demand Lectures + 1:1 Coaching Session.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-body sm:text-base">
            Pass all 200 mock AI SCA stations. Still fail your SCA? We pay you £500.
          </p>
          {customer ? (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-body sm:text-base">
              Upgrade, extend or renew below. Your consultations, history and feedback carry over whatever you choose.
            </p>
          ) : (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-body sm:text-base">
              AI practice and on-demand lectures start the moment you buy. Your coaching
              session runs on the date and time you choose.
            </p>
          )}
        </header>
        {/* Renders nothing without a ?renew/?upgrade param, so it costs the
            marketing page no vertical rhythm when nobody was redirected. */}
        <Suspense fallback={null}>
          <AccessNotice />
        </Suspense>
        <NhsBanner />
        <PricingTable
          ownedPlan={entitlement.plan ?? null}
          accountEmail={user?.email ?? null}
          canUpgrade={canSwitchPlan(entitlement)}
        />
        <GuaranteeCard />
        <Faq />
      </main>
      <LandingFooter />
    </div>
  );
}
