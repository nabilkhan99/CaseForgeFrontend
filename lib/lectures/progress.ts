/**
 * What "watched" means for a lecture, and which lecture the hero should offer.
 *
 * Progress is stored as the FURTHEST position the viewer reached, never as
 * cumulative watch time — so scrubbing back, rewatching a section or leaving
 * the tab parked never inflates it, and one number serves as both the resume
 * point and the completion measure.
 *
 * Everything here is pure. The list page and the player own the fetching and
 * the writing; this owns the arithmetic and the ordering rules, so the tick on
 * a row and the seek in the player can never disagree about the same lecture.
 */

/**
 * A lecture counts as watched at 90%. The last tenth is sign-off, and holding
 * out for 100% leaves ticks permanently unearned for anyone who clicks away
 * the moment the teaching stops.
 */
export const WATCHED_THRESHOLD = 0.9

/** How far to rewind on resume, so they land back inside the sentence they left on. */
export const RESUME_REWIND_SECONDS = 5

export type LectureWatchStatus = 'watched' | 'in-progress' | 'not-started'

export interface LectureProgressEntry {
  lectureId: string
  /** Furthest playback position reached, in whole seconds. */
  secondsWatched: number
  updatedAt: string
}

/** Progress keyed by lecture id. Absent key means the lecture was never opened. */
export type LectureProgressMap = Record<string, LectureProgressEntry>

/** Position a lecture must reach to count as watched, or null when its duration is unknown. */
export function watchedThresholdSeconds(durationSeconds: number | null | undefined): number | null {
  if (!durationSeconds || durationSeconds <= 0) return null
  return durationSeconds * WATCHED_THRESHOLD
}

/**
 * A lecture with no duration can never be called watched: without a
 * denominator 90% is unknowable, and a tick that might be wrong is worse than
 * no tick at all. Such a lecture stays "in progress" for ever, which is at
 * least true.
 */
export function lectureWatchStatus(
  durationSeconds: number | null | undefined,
  secondsWatched: number | null | undefined,
): LectureWatchStatus {
  const watched = secondsWatched ?? 0
  if (watched <= 0) return 'not-started'
  const threshold = watchedThresholdSeconds(durationSeconds)
  if (threshold !== null && watched >= threshold) return 'watched'
  return 'in-progress'
}

/** How far through, 0–1, for the progress bars. Zero when the duration is unknown. */
export function watchedFraction(
  durationSeconds: number | null | undefined,
  secondsWatched: number | null | undefined,
): number {
  if (!durationSeconds || durationSeconds <= 0) return 0
  const watched = secondsWatched ?? 0
  if (watched <= 0) return 0
  return Math.min(1, watched / durationSeconds)
}

/**
 * Whole minutes still to watch. Rounds up off zero, because "0 min left" on a
 * lecture that is still playing reads as a bug.
 */
export function minutesLeft(
  durationSeconds: number | null | undefined,
  secondsWatched: number | null | undefined,
): number | null {
  if (!durationSeconds || durationSeconds <= 0) return null
  const remaining = durationSeconds - (secondsWatched ?? 0)
  if (remaining <= 0) return 0
  return Math.max(1, Math.round(remaining / 60))
}

/** How far in they got, for the resume line. Sub-minute gets a phrase, not "0 minutes in". */
export function describeWatchedOffset(secondsWatched: number): string {
  const mins = Math.floor(Math.max(0, secondsWatched) / 60)
  if (mins < 1) return 'less than a minute in'
  return `${mins} minute${mins === 1 ? '' : 's'} in`
}

/**
 * Where to drop the viewer when a <video> element mounts, or null to leave it
 * at the start.
 *
 * Two different cases share one answer. `furthest` is this visit's own high
 * water mark and is only non-zero when the element is remounting mid-watch —
 * a signed URL that aged out and was re-signed — where the only right answer
 * is "put me back where I was", however near the end that is. `stored` is the
 * cold-start case, and there the 90% rule applies: someone who finished a
 * lecture last week wants it from the top, not from the closing thank-you.
 */
export function resumeTarget(
  stored: number,
  furthest: number,
  durationSeconds: number,
): number | null {
  if (furthest > 0) return Math.max(0, furthest - RESUME_REWIND_SECONDS)
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
  if (stored > 0 && stored < durationSeconds * WATCHED_THRESHOLD) {
    return Math.max(0, stored - RESUME_REWIND_SECONDS)
  }
  return null
}

export type LectureHeroMode = 'resume' | 'next-up' | 'watch-again' | 'start-here'

export interface LectureHeroPick<T> {
  lecture: T
  /** 1-based position in the running order, so the hero's number matches the row's. */
  position: number
  mode: LectureHeroMode
}

/** The only fields the picker needs; the pages pass their own richer types through. */
interface HeroCandidate {
  id: string
  durationSeconds: number | null
}

function updatedAtMs(entry: LectureProgressEntry | undefined): number {
  if (!entry) return 0
  const ms = Date.parse(entry.updatedAt)
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * The one lecture worth putting at full size, given where the viewer is.
 *
 * Order of preference: what they were in the middle of, then the first thing
 * they have not finished, then — for someone who has watched the lot — the one
 * they finished most recently. `lectures` is assumed to already be in running
 * order; positions are read off it rather than off sort_order, which is an
 * arbitrary int.
 */
export function pickLectureHero<T extends HeroCandidate>(
  lectures: readonly T[],
  progress: LectureProgressMap,
): LectureHeroPick<T> | null {
  if (lectures.length === 0) return null

  const statuses = lectures.map((lecture) =>
    lectureWatchStatus(lecture.durationSeconds, progress[lecture.id]?.secondsWatched),
  )

  let resumeIndex = -1
  let resumeAt = -1
  lectures.forEach((lecture, index) => {
    if (statuses[index] !== 'in-progress') return
    const at = updatedAtMs(progress[lecture.id])
    if (at > resumeAt) {
      resumeIndex = index
      resumeAt = at
    }
  })
  if (resumeIndex !== -1) {
    return { lecture: lectures[resumeIndex], position: resumeIndex + 1, mode: 'resume' }
  }

  const nextIndex = statuses.findIndex((status) => status !== 'watched')
  if (nextIndex !== -1) {
    // Someone with nothing tracked at all is not being handed their "next" —
    // they are being shown the top of the course, which is what START HERE
    // already says and what a signed-out or brand-new visitor sees.
    const untouched = lectures.every((lecture) => !progress[lecture.id])
    return {
      lecture: lectures[nextIndex],
      position: nextIndex + 1,
      mode: untouched && nextIndex === 0 ? 'start-here' : 'next-up',
    }
  }

  let againIndex = 0
  let againAt = updatedAtMs(progress[lectures[0].id])
  lectures.forEach((lecture, index) => {
    const at = updatedAtMs(progress[lecture.id])
    if (at > againAt) {
      againIndex = index
      againAt = at
    }
  })
  return { lecture: lectures[againIndex], position: againIndex + 1, mode: 'watch-again' }
}
