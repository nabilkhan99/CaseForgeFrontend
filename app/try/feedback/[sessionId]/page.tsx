import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import SignUpWhileMarking from '@/components/try/SignUpWhileMarking';
import { GUEST_COOKIE, cookieOwnsSession, readGuestCookie } from '@/lib/trial/guestSession';

/**
 * The minute after a guest consultation ends. Contract C4.
 *
 * It used to be the reveal gate: a nine-step questionnaire and an SMS step
 * standing between a finished consultation and the report it had earned, with
 * the whole report, the pricing table and the guarantee rendered underneath
 * once it opened. About a quarter of finishers left at that gate.
 *
 * It is now the sign-up, and the report has moved. Marking takes about a
 * minute; the account takes about a minute; so they run at the same time, and
 * the report is read where it belongs — inside the dashboard, on an account
 * that owns it, next to the other four cases. Nothing marked is rendered on
 * this page any more; only the trainee's own verdict summary, which
 * `/api/try/gate-status` has always been allowed to show.
 *
 * ## A server component for three questions
 *
 * Whether the session already has an owner, which case it was on, and whether
 * this browser is the one that ran it. If it is owned, the report belongs in
 * the dashboard and there is no account to make, so the browser is sent there
 * before anything paints rather than after two client fetches. Everything else
 * on the page is client work — the poll, the form, the code.
 *
 * ## Why the cookie is read HERE
 *
 * The signed `ff_guest` cookie is contract C3's proof, and `verify-code` will
 * only honour a password behind it. The form could not see that — it is
 * httpOnly — so a legacy report link (no cookie, opened on a phone, forwarded
 * from an email) showed a password field whose value the server was always
 * going to discard, over a line promising a report in a dashboard those people
 * do not get sent to. The page knows, so it tells the form.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function TryFeedbackPage({ params }: PageProps) {
  const { sessionId } = await params;

  // Contract C3's proof, asked exactly as /api/try/verify-code asks it: this
  // browser opened this consultation, so the password it types will be honoured.
  const jar = await cookies();
  const proven = cookieOwnsSession(readGuestCookie(jar.get(GUEST_COOKIE)?.value), sessionId);

  const { data: session } = await getSupabaseAdmin()
    .from('clinical_sessions')
    .select('id, user_id, station_id')
    .eq('id', sessionId)
    .maybeSingle();

  // Already claimed — by this person's own sign-up in another tab, or by an
  // account they made later. The dashboard's report is the real one, and it
  // checks ownership itself, so this hands the question over rather than
  // answering it here.
  if (session?.user_id) redirect(`/clinical-master/feedback/${sessionId}`);

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

  // The station travels with it so "run it properly" can point back at THIS
  // case rather than at the five in general.
  return (
    <SignUpWhileMarking
      sessionId={sessionId}
      stationId={session.station_id ?? null}
      proven={proven}
    />
  );
}
