/**
 * Per-user lecture playback progress.
 *
 * One row per (user, lecture) in `lecture_progress`, holding the furthest
 * position that user reached. RLS already restricts every statement to
 * `auth.uid() = user_id`; the explicit `user_id` filters here are for the
 * query planner and for readability, not for safety.
 *
 * There is no `updated_at` trigger on the table, so every write sets it —
 * without it the hero could never tell which half-watched lecture was the most
 * recent one.
 */

import { createClient } from '@/lib/supabase/client';
import type { LectureProgressEntry, LectureProgressMap } from '@/lib/lectures/progress';

interface LectureProgressRow {
  lecture_id: string;
  seconds_watched: number;
  updated_at: string;
}

function toEntry(row: LectureProgressRow): LectureProgressEntry {
  return {
    lectureId: row.lecture_id,
    secondsWatched: row.seconds_watched ?? 0,
    updatedAt: row.updated_at,
  };
}

/**
 * Every lecture this user has touched, keyed by lecture id.
 *
 * One query for the whole course rather than one per row: the table holds at
 * most a handful of rows per user, and the list page needs all of them before
 * it can pick a hero.
 */
export async function getLectureProgress(userId: string): Promise<LectureProgressMap> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('lecture_progress')
    .select('lecture_id, seconds_watched, updated_at')
    .eq('user_id', userId)
    .overrideTypes<LectureProgressRow[]>();

  if (error) {
    console.error('Error fetching lecture progress:', error.message);
    return {};
  }

  const map: LectureProgressMap = {};
  (data ?? []).forEach((row) => {
    map[row.lecture_id] = toEntry(row);
  });
  return map;
}

/** One lecture's progress, for the player. Null when it has never been opened. */
export async function getLectureProgressEntry(
  userId: string,
  lectureId: string,
): Promise<LectureProgressEntry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('lecture_progress')
    .select('lecture_id, seconds_watched, updated_at')
    .eq('user_id', userId)
    .eq('lecture_id', lectureId)
    .maybeSingle()
    .overrideTypes<LectureProgressRow>();

  if (error || !data) return null;
  return toEntry(data);
}

/**
 * Record how far through a lecture the user has got.
 *
 * `secondsWatched` must already be the furthest position reached — the caller
 * holds that high-water mark, because it is the only place that knows what the
 * <video> element has done since the row was read. Rejects on failure so the
 * caller can decide; the player deliberately swallows it rather than
 * interrupting playback over a progress write.
 */
export async function saveLectureProgress(
  userId: string,
  lectureId: string,
  secondsWatched: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('lecture_progress').upsert(
    {
      user_id: userId,
      lecture_id: lectureId,
      seconds_watched: Math.max(0, Math.floor(secondsWatched)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lecture_id' },
  );

  if (error) throw new Error(error.message);
}
