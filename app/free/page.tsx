import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FreePicker from '@/components/free/FreePicker';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { guestNotice, openDashboardHref, type SearchParams } from '@/lib/trial/freeParams';
import { listFreeStations, type PickerStation } from '@/lib/trial/freeStationPicks';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
  title: 'Five free SCA stations, marked | Fourteen Fisherman',
  description:
    'Pick a case and talk to an AI patient for 12 minutes, then read your report against the three SCA domains. Five free stations, and your first verdict before we ask for anything.',
  path: '/free',
});

/**
 * The deliberate door, rebuilt as a case picker.
 *
 * Value before identity: the consultation is the call to action here and
 * everywhere, and the address is asked for at the reveal after the first
 * station — where the trainee is looking at their own verdict rather than at a
 * promise. The email-and-code form that used to occupy this page still exists,
 * one quiet link away at /free/open, for somebody coming back to an account.
 *
 * SERVER-RENDERED, and that is the point: the five titles are the page's whole
 * argument, so they are in the HTML rather than fetched after paint. It is
 * dynamic (it reads `searchParams`) but the query costs one round trip against
 * five rows.
 */
export default async function FreePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // The portfolio tool's banner sends the code itself and hands the person
  // over with `?email=…&code=sent`, expecting the code step to be waiting. It
  // is — at /free/open now, so the handoff travels one hop further rather than
  // dead-ending on a page with no form.
  const handoff = openDashboardHref(params);
  if (handoff) redirect(handoff);

  let stations: PickerStation[] = [];
  try {
    stations = await listFreeStations(getSupabaseAdmin());
  } catch (error) {
    // `getSupabaseAdmin` throws when the service key is missing. The picker
    // renders its own empty state and the one-click door still works, which is
    // a great deal better than a 500 on the most-linked page on the site.
    console.error('[free] could not list the free stations', error);
  }

  return <FreePicker stations={stations} notice={guestNotice(params)} />;
}
