import { createClient } from '@/lib/supabase/client';
import { visibleStationStates } from '@/lib/stations/visibility';

/**
 * The recommended "Start here" cases, in order.
 *
 * Ids only. The library board has already loaded every station it needs with
 * `getStationIndex` — including each one's attempt history and pass state — so
 * fetching the rows again to sort five of them would be a second copy of the
 * same data that could disagree with the first. This answers only "which, and
 * in what order"; the caller looks each one up in the array it already has.
 *
 * WHY THIS IS NOT PART OF `getStationIndex`. That query is the shared shape
 * every library surface reads, on the hottest page in the product, and
 * `free_trial_order` is wanted by exactly one section of one page. Widening the
 * shared select to carry it would put the column on two hundred rows to sort
 * five.
 *
 * FAILS SOFT, and that matters more than usual here: `free_trial_order` does
 * not exist until 20260906_trial_grants.sql is applied, and PostgREST answers a
 * select naming a missing column with an error. An empty list simply means no
 * "Start here" section — the board underneath is untouched — where a throw
 * would take the whole library down between the deploy and the migration.
 */
export async function getRecommendedStationIds(): Promise<string[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('stations')
      .select('id, free_trial_order')
      .eq('is_free_trial', true)
      .in('is_active', visibleStationStates())
      // Nulls last, so a flagged station that nobody has ordered yet still
      // appears — after the ordered ones — rather than jumping the queue or
      // vanishing. Until Ishaq picks the five as pairs, that is every one of
      // them, and the section has to work in the meantime.
      .order('free_trial_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true });

    if (error) throw error;
    return (data ?? []).map((row) => (row as { id: string }).id);
  } catch (error: unknown) {
    console.error('[library] recommended stations lookup failed', error);
    return [];
  }
}
