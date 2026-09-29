import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { exactEmailPattern } from './emailFilter'
import { joinDetailsFromRow, NO_JOIN_DETAILS, type CoachingJoinDetails } from './coachingJoin'

/**
 * The joining details of the signed-in student's booked coaching session.
 *
 * Its own read, deliberately NOT a column added to the entitlement select: the
 * entitlement runs on every gated navigation and fails OPEN when its query
 * breaks, so a missing column there (this migration not yet applied) would
 * wave everyone through. Here the same failure degrades to "not set yet".
 *
 * RLS-scoped cookie client, the way serverEntitlement reads purchases: the
 * policy "read own purchases by email" already scopes the select, and the
 * explicit email filter is belt and braces on top of it.
 */
export async function loadCoachingJoinDetails(
  email: string,
  coachingDay: string,
): Promise<CoachingJoinDetails> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('preorders')
      .select('coaching_meeting_url, coaching_coach_name')
      .ilike('email', exactEmailPattern(email))
      .eq('coaching_day', coachingDay)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return joinDetailsFromRow(data)
  } catch (error: unknown) {
    console.error('[coaching-details] lookup failed', error)
    return NO_JOIN_DETAILS
  }
}
