import Link from 'next/link';
import { redirect } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Container from '@/components/ui/Container';
import CoachingDaySelect from '@/components/commerce/CoachingDaySelect';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';

export const dynamic = 'force-dynamic';

/**
 * Book the coaching day that came with Complete.
 *
 * Only reachable in one situation: the customer upgraded to Complete through
 * the Stripe Customer Portal, which cannot ask for a date, so the webhook
 * recorded a `complete` order with no coaching day. Everyone who bought
 * Complete at checkout already has one and is told so here.
 *
 * Rendered on the server so the page and the endpoint agree about who may book:
 * `/api/coaching-day/select` re-checks the same ownership, and this page is the
 * explanation rather than the enforcement.
 */
export default async function CoachingDayPage() {
  const { user, entitlement } = await getServerEntitlement();

  // Middleware already bounces anonymous visitors off /dashboard; this is the
  // belt-and-braces so the page can assume an email below.
  if (!user?.email) redirect('/auth/sign-in?redirect=/dashboard/coaching-day');

  const holdsComplete = entitlement.plan === 'complete' || entitlement.plan === 'intensive';

  if (!holdsComplete) {
    return (
      <div>
        <PageHeader title="Coaching day" subtitle="Included with Complete" />
        <Container>
          <p className="text-[15px] leading-[1.7] text-body">
            The full-day Small-Group Coaching session is part of Complete. Move up to Complete and
            you can pick your date here.
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
  // the endpoint refuses to move an existing one — so the worst case is a
  // clear 409, not a double booking.
  if (entitlement.coachingDay) {
    return (
      <div>
        <PageHeader title="Coaching day" subtitle="Your place is booked" />
        <Container>
          <p className="text-[15px] leading-[1.7] text-body">
            Your Small-Group Coaching day is booked. It runs 9am to 5pm, remote, with a maximum
            class of six, and we&rsquo;ll email the joining details nearer the time.
          </p>
          <p className="mt-4 text-[13px] text-muted">
            Need a different date? Email{' '}
            <a href="mailto:hello@fourteenfisherman.com" className="text-primary hover:underline">
              hello@fourteenfisherman.com
            </a>{' '}
            &mdash; places are capped at six, so we move people by hand.
          </p>
        </Container>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Choose your coaching day"
        subtitle="One full day of live Small-Group Coaching, included with Complete"
      />
      <Container>
        <CoachingDaySelect accountEmail={user.email} />
      </Container>
    </div>
  );
}
