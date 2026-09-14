import Link from 'next/link';
import { redirect } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Container from '@/components/ui/Container';
import CoachingSessionSelect from '@/components/commerce/CoachingSessionSelect';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import {
  coachingSessionLabel,
  formatCoachingDate,
  isCoachingSlotKey,
  isIsoDate,
} from '@/lib/commerce/coachingSlots';

export const dynamic = 'force-dynamic';

/**
 * Book the coaching session that came with Complete.
 *
 * Only reachable in one situation: the customer upgraded to Complete through
 * the Stripe Customer Portal, which cannot ask for a date, so the webhook
 * recorded a `complete` order with no coaching session. Everyone who bought
 * Complete at checkout already has one and is told so here.
 *
 * Rendered on the server so the page and the endpoint agree about who may book:
 * `/api/coaching-session/select` re-checks the same ownership, and this page is
 * the explanation rather than the enforcement.
 */
export default async function CoachingSessionPage() {
  const { user, entitlement } = await getServerEntitlement();

  // Middleware already bounces anonymous visitors off /dashboard; this is the
  // belt-and-braces so the page can assume an email below.
  if (!user?.email) redirect('/auth/sign-in?redirect=/dashboard/coaching-session');

  const holdsComplete = entitlement.plan === 'complete' || entitlement.plan === 'intensive';

  if (!holdsComplete) {
    return (
      <div>
        <PageHeader title="Coaching session" subtitle="Included with Complete" />
        <Container>
          <p className="text-[15px] leading-[1.7] text-body">
            The 3 hour one to one coaching session is part of Complete. Move up to Complete and you
            can pick your date and time here.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline"
          >
            See the plans &rarr;
          </Link>
        </Container>
      </div>
    );
  }

  // `coachingDay` is only populated on an active entitlement, so a pre-launch
  // Complete buyer sees the picker again. Their booking is on the order, and
  // the endpoint refuses to move an existing one, so the worst case is a
  // clear 409, not a double booking.
  if (entitlement.coachingDay) {
    // `coachingSlot` arrives on `Entitlement` with the backend half of the one
    // to one change. Read defensively so this compiles on either side of that
    // merge, and validated because a legacy booking has no slot at all (it
    // then shows the date without a time).
    const rawSlot = (entitlement as { coachingSlot?: string | null }).coachingSlot;
    const day = entitlement.coachingDay;
    const when = !isIsoDate(day)
      ? day
      : isCoachingSlotKey(rawSlot)
        ? coachingSessionLabel(day, rawSlot)
        : formatCoachingDate(day);

    return (
      <div>
        <PageHeader title="Coaching session" subtitle="Your session is booked" />
        <Container>
          <p className="text-[15px] leading-[1.7] text-body">
            Your one to one coaching session is booked for{' '}
            <span className="font-semibold text-heading">{when}</span>. 3 hours, remote, just you and
            your coach. We&rsquo;ll email your joining details nearer the time.
          </p>
          <p className="mt-4 text-[13px] text-muted">
            Need a different date? Email{' '}
            <a href="mailto:hello@fourteenfisherman.com" className="text-primary hover:underline">
              hello@fourteenfisherman.com
            </a>{' '}
            and we&rsquo;ll move your session by hand.
          </p>
        </Container>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Choose your coaching date"
        subtitle="A 3 hour one to one coaching session, included with Complete"
      />
      <Container>
        <CoachingSessionSelect accountEmail={user.email} />
      </Container>
    </div>
  );
}
