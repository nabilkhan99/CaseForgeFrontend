import type { Metadata } from 'next';
import FreeStart from '@/components/free/FreeStart';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { startPrefill, type SearchParams } from '@/lib/trial/freeParams';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
  // No " | Fourteen Fisherman" suffix: the root layout's title template
  // (app/layout.tsx) already appends one, and pages that spell it out here end
  // up saying it twice in the tab. Several older pages do; this one does not.
  title: 'Create your free account',
  description:
    'Five SCA cases with an AI patient, unlimited attempts, five days, no card. Create your account and your first verdict is minutes away.',
  path: '/free/start',
});

/**
 * The one door into the free trial.
 *
 * From 7 September 2026 there is no guest lane: every free call to action lands
 * here, an account is made in one go, and the stations are sat inside the
 * dashboard like everything else. What that buys is the thing the guest lane
 * could never give — the work is on a board the next morning, the five days are
 * a real window rather than a promise, and the second station does not depend on
 * the browser that sat the first.
 *
 * Email, mobile and a password, then a 6-digit code by email. No SMS anywhere,
 * and no "check your inbox for a sign-in link" — verifying the code signs them
 * in on the same request (app/api/try/verify-code).
 *
 * `?station=` is carried through the whole flow so somebody who picked a case
 * lands on that case rather than on a dashboard they have to search. The title
 * is resolved here, server-side, purely so the form can name what they clicked.
 */
export default async function FreeStartPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { email, station } = startPrefill(await searchParams);

  return (
    <FreeStart
      initialEmail={email}
      station={station}
      stationTitle={station ? await stationTitle(station) : null}
    />
  );
}

/**
 * The title of the case they clicked, or null.
 *
 * Fail-soft twice: an unknown id and a database that will not answer both render
 * the page without the line, because the form is what this page is for and a
 * missing reassurance is not worth a 500 on the first screen of the funnel.
 */
async function stationTitle(stationId: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('stations')
      .select('title')
      .eq('id', stationId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    const title = (data as { title?: unknown } | null)?.title;
    return typeof title === 'string' && title.trim() !== '' ? title.trim() : null;
  } catch (error: unknown) {
    console.error('[free/start] could not name the station', error);
    return null;
  }
}
