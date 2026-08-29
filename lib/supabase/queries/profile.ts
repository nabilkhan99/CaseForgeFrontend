/**
 * Writes to the trainee's own profile.
 *
 * Small on purpose: the point of the module is that there is exactly one place
 * the exam date is written from.
 */

import { createClient } from '@/lib/supabase/client';

/**
 * Store the SCA date, with `profiles.exam_date` as the authority.
 *
 * The profiles row is what getUserStats reads for the dashboard countdown, so
 * that write alone decides success. Auth `user_metadata.exam_date` — what the
 * Settings form pre-fills from — is mirrored best-effort afterwards: the two
 * writes cannot be atomic, and failing the whole save over the mirror would
 * tell the user their countdown didn't stick when it did. A failed mirror only
 * costs Settings a stale pre-fill until the next successful save.
 *
 * An empty string clears the date — Settings allows that, so the profiles row
 * takes null rather than an empty string the countdown would try to parse.
 *
 * Returns false instead of throwing: supabase-js reports most failures in the
 * result, so a caller that merely awaited would show "Saved" over a failed
 * write — and the ones it throws for (network drop) must not escape either.
 */
export async function saveExamDate(userId: string, examDate: string): Promise<boolean> {
    const supabase = createClient();

    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({ id: userId, exam_date: examDate || null }, { onConflict: 'id' });
        if (error) {
            console.error('[profile] exam date write failed', error.message);
            return false;
        }
    } catch (error: unknown) {
        console.error('[profile] exam date write failed', error);
        return false;
    }

    try {
        const { error } = await supabase.auth.updateUser({ data: { exam_date: examDate } });
        if (error) console.error('[profile] exam date metadata mirror failed', error.message);
    } catch (error: unknown) {
        console.error('[profile] exam date metadata mirror failed', error);
    }

    return true;
}
