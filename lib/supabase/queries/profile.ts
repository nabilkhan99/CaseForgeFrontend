/**
 * Writes to the trainee's own profile.
 *
 * Small on purpose: the point of the module is that there is exactly one place
 * the exam date is written from.
 */

import { createClient } from '@/lib/supabase/client';

/**
 * Store the SCA date in both places that hold it.
 *
 * `profiles.exam_date` is what getUserStats reads for the dashboard countdown;
 * auth `user_metadata.exam_date` is what Settings reads back into its form. A
 * write that landed in one and not the other left the two surfaces disagreeing
 * about when the exam is, which is why both live behind one function rather
 * than being repeated at each call site.
 *
 * An empty string clears the date — Settings allows that, so the profiles row
 * takes null rather than an empty string the countdown would try to parse.
 *
 * Returns false instead of throwing: supabase-js reports failures in the
 * result, so a caller that merely awaited would show "Saved" over a failed write.
 */
export async function saveExamDate(userId: string, examDate: string): Promise<boolean> {
    const supabase = createClient();

    const { error: authError } = await supabase.auth.updateUser({
        data: { exam_date: examDate },
    });

    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: userId, exam_date: examDate || null }, { onConflict: 'id' });

    return !authError && !profileError;
}
