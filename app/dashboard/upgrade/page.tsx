import Link from 'next/link';
import { redirect } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Container from '@/components/ui/Container';
import UpgradeFlow from '@/components/commerce/UpgradeFlow';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { canUpgradeToComplete } from '@/lib/commerce/upgrade';
import { COMPLETE_UPGRADE_PRICE_LABEL, getPlan } from '@/lib/commerce/plans';

export const dynamic = 'force-dynamic';

/**
 * Self-Study -> Complete, inside the product.
 *
 * Deliberately NOT `/pricing`: sending an existing customer to the acquisition
 * page showed them the marketing nav, "Pre-order now" on the plan they already
 * own, and a £599 CTA for a £300 top-up. This page runs in app chrome (the
 * dashboard layout's AppNavbar), states which account the purchase attaches to,
 * and prices the difference.
 *
 * Rendered on the server so the gate and the copy agree: whoever cannot buy the
 * upgrade never sees a buy button for it. `/api/checkout` re-checks the same
 * entitlement — this page is the explanation, not the enforcement.
 */

/** What Complete adds, as rows between rules rather than a card grid. */
const COMPARISON: readonly { label: string; selfStudy: string; complete: string }[] = [
  { label: 'AI consultations', selfStudy: 'Unlimited · 200 stations', complete: 'Unlimited · 200 stations' },
  { label: 'On-demand lectures', selfStudy: '—', complete: 'The full course' },
  { label: 'Small-group coaching', selfStudy: '—', complete: 'One full day, 9am to 5pm · max class of 6' },
  { label: 'SCA Guarantee', selfStudy: 'Included', complete: 'Included' },
];

export default async function UpgradePage() {
  const { user, entitlement } = await getServerEntitlement();

  // Middleware already bounces anonymous visitors off /dashboard; this is the
  // belt-and-braces so the page can assume an email below.
  if (!user?.email) redirect('/auth/sign-in?redirect=/dashboard/upgrade');

  if (!canUpgradeToComplete(entitlement)) {
    const holdsComplete = entitlement.plan === 'complete' || entitlement.plan === 'intensive';
    const lapsed = entitlement.state === 'read_only';
    return (
      <div>
        <PageHeader
          title="Upgrade"
          subtitle={holdsComplete ? 'You already have everything Complete includes' : 'Your plan options'}
        />
        <Container>
          <p className="text-[14px] leading-[1.7] text-body">
            {holdsComplete
              ? 'Your plan already includes the lecture course and a coaching day — there is nothing to upgrade.'
              : lapsed
                ? 'Your access has ended, so there is no plan to upgrade. Renewing starts a fresh three months.'
                : 'The upgrade price is for Self-Study customers. Pick a plan to get started.'}
          </p>
          {!holdsComplete && (
            <Link
              href={lapsed ? '/pricing?renew=true' : '/pricing'}
              className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline"
            >
              {lapsed ? 'Renew your access' : 'See the plans'} &rarr;
            </Link>
          )}
          {holdsComplete && (
            <Link
              href="/dashboard/lectures"
              className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline"
            >
              Go to your lectures &rarr;
            </Link>
          )}
        </Container>
      </div>
    );
  }

  const fromName = getPlan(entitlement.plan ?? '')?.name ?? 'Self-Study';

  return (
    <div>
      <PageHeader
        title="Upgrade to Complete"
        subtitle={`${COMPLETE_UPGRADE_PRICE_LABEL} — the difference between ${fromName} and Complete`}
      />

      <Container className="mb-6">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-5">
          What changes
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 sm:gap-x-8">
          <div />
          <div className="pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {fromName}
          </div>
          <div className="pb-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
            Complete
          </div>
          {COMPARISON.map((row) => (
            <div key={row.label} className="contents">
              <div className="border-t border-black/[0.06] py-3 text-[13px] font-medium text-heading">
                {row.label}
              </div>
              <div className="border-t border-black/[0.06] py-3 text-right text-[13px] text-muted">
                {row.selfStudy}
              </div>
              <div className="border-t border-black/[0.06] py-3 text-right text-[13px] font-medium text-heading">
                {row.complete}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[12px] leading-[1.6] text-muted">
          Your existing access, consultations and feedback stay exactly as they are — the upgrade
          adds the lecture course and your coaching day.
        </p>
      </Container>

      <Container>
        <UpgradeFlow accountEmail={user.email} />
      </Container>
    </div>
  );
}
