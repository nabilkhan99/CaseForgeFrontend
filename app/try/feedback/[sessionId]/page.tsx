import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import SignUpWhileMarking from '@/components/try/SignUpWhileMarking';
import GatedTrialReport from '@/components/try/GatedTrialReport';
import { GUEST_COOKIE, cookieOwnsSession, readGuestCookie } from '@/lib/trial/guestSession';

/**
 * What a /try/feedback link opens depends on whose consultation it is.
 *
 * ## The browser that ran it: sign up while it is marked (contract C4)
 *
 * The signed `ff_guest` cookie carries this session id, so this is the guest
 * who has just finished. Marking takes about a minute and so does the account,
 * so they run at the same time and the report is read inside the dashboard,
 * on an account that owns it. Once the session has an owner the dashboard's
 * report is the real one and the browser is sent there.
 *
 * ## Anybody else: the report link as main had it
 *
 * No cookie for this session means a link from before the cookie existed, one
 * forwarded or opened on another device, or the one in a founder's lead alert.
 * Those behave exactly as they did on main (owner decision, Sept 2026): a lead
 * that has verified its address sees the full report straight away, and
 * anybody else gets the email gate and then the report. No account is made on
 * that path (see /api/try/verify-code), because a link is not proof of whose
 * consultation it was.
 *
 * One exception: a consultation that already belongs to an account but has no
 * verified lead of its own (a returning trainee's second case, claimed by id)
 * has no gate that could open it, so it goes to the dashboard's report, which
 * checks ownership itself.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

async function browserRanIt(sessionId: string): Promise<boolean> {
  const jar = await cookies();
  return cookieOwnsSession(readGuestCookie(jar.get(GUEST_COOKIE)?.value), sessionId);
}

// Absolute: the site template ("%s | Fourteen Fisherman") would make the tab
// longer than the instruction it is giving.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    title: {
      absolute: (await browserRanIt(sessionId)) ? 'Set up your free account' : 'Your feedback report',
    },
  };
}

export default async function TryFeedbackPage({ params }: PageProps) {
  const { sessionId } = await params;
  const proven = await browserRanIt(sessionId);
  const admin = getSupabaseAdmin();

  const { data: session } = await admin
    .from('clinical_sessions')
    .select('id, user_id, station_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-[20px] font-semibold text-heading">
            That consultation has gone
          </h1>
          <p className="mb-6 text-[14px] leading-relaxed text-muted">
            The link may be old, or the consultation may never have started. Any of the
            five free cases takes one click.
          </p>
          <Link
            href="/free"
            className="inline-flex min-h-[44px] items-center rounded-xl px-6 py-3 text-[14px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
          >
            Try 5 free cases
          </Link>
        </div>
      </div>
    );
  }

  if (proven) {
    // Already claimed, by this person's own sign-up in another tab. The
    // dashboard's report checks ownership itself.
    if (session.user_id) redirect(`/clinical-master/feedback/${sessionId}`);
    // The station travels with it so "run it properly" can point back at THIS
    // case rather than at the five in general.
    return <SignUpWhileMarking sessionId={sessionId} stationId={session.station_id ?? null} />;
  }

  const { data: lead } = await admin
    .from('trial_leads')
    .select('email_verified_at')
    .eq('session_id', sessionId)
    .maybeSingle();
  const verified = Boolean(lead?.email_verified_at);

  if (session.user_id && !verified) redirect(`/clinical-master/feedback/${sessionId}`);

  return <GatedTrialReport sessionId={sessionId} verified={verified} />;
}
