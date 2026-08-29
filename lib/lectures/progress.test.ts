import { describe, expect, it } from 'vitest'
import {
  RESUME_REWIND_SECONDS,
  WATCHED_THRESHOLD,
  describeWatchedOffset,
  lectureWatchStatus,
  minutesLeft,
  pickLectureHero,
  resumeTarget,
  watchedFraction,
  type LectureProgressMap,
} from './progress'

const HOUR = 3600

function entry(lectureId: string, secondsWatched: number, updatedAt: string) {
  return { lectureId, secondsWatched, updatedAt }
}

function lecture(id: string, durationSeconds: number | null = HOUR) {
  return { id, durationSeconds }
}

describe('lectureWatchStatus', () => {
  it('treats no row and a zero row identically', () => {
    expect(lectureWatchStatus(HOUR, undefined)).toBe('not-started')
    expect(lectureWatchStatus(HOUR, 0)).toBe('not-started')
  })

  it('ticks off exactly at the 90% threshold, not a second before', () => {
    const threshold = HOUR * WATCHED_THRESHOLD
    expect(lectureWatchStatus(HOUR, threshold - 1)).toBe('in-progress')
    expect(lectureWatchStatus(HOUR, threshold)).toBe('watched')
    expect(lectureWatchStatus(HOUR, HOUR)).toBe('watched')
  })

  it('never claims watched without a duration to measure against', () => {
    expect(lectureWatchStatus(null, 10_000)).toBe('in-progress')
    expect(lectureWatchStatus(0, 10_000)).toBe('in-progress')
  })
})

describe('watchedFraction and minutesLeft', () => {
  it('clamps a run past the end to a full bar', () => {
    expect(watchedFraction(HOUR, HOUR * 2)).toBe(1)
    expect(watchedFraction(HOUR, 900)).toBeCloseTo(0.25)
  })

  it('has nothing to say without a duration', () => {
    expect(watchedFraction(null, 900)).toBe(0)
    expect(minutesLeft(null, 900)).toBeNull()
  })

  it('rounds up off zero so a playing lecture never says 0 min left', () => {
    expect(minutesLeft(HOUR, HOUR - 20)).toBe(1)
    expect(minutesLeft(HOUR, 0)).toBe(60)
    expect(minutesLeft(HOUR, HOUR)).toBe(0)
  })
})

describe('describeWatchedOffset', () => {
  it('phrases sub-minute progress rather than reporting zero minutes', () => {
    expect(describeWatchedOffset(0)).toBe('less than a minute in')
    expect(describeWatchedOffset(59)).toBe('less than a minute in')
  })

  it('singularises one minute', () => {
    expect(describeWatchedOffset(90)).toBe('1 minute in')
    expect(describeWatchedOffset(13 * 60 + 4)).toBe('13 minutes in')
  })
})

describe('resumeTarget', () => {
  it('rewinds a few seconds off the stored position', () => {
    expect(resumeTarget(600, 0, HOUR)).toBe(600 - RESUME_REWIND_SECONDS)
  })

  it('starts a finished lecture from the top rather than from the credits', () => {
    expect(resumeTarget(HOUR * 0.95, 0, HOUR)).toBeNull()
  })

  it('never returns a negative time', () => {
    expect(resumeTarget(2, 0, HOUR)).toBe(0)
  })

  it('restores this visit’s position on a re-sign, past 90% included', () => {
    // The signed URL aged out at 58 minutes of an hour: dropping them back at
    // zero because they are "finished" would be the worst possible answer.
    expect(resumeTarget(0, 3480, HOUR)).toBe(3480 - RESUME_REWIND_SECONDS)
  })

  it('has nowhere to seek to when nothing is known', () => {
    expect(resumeTarget(0, 0, HOUR)).toBeNull()
    expect(resumeTarget(600, 0, Number.NaN)).toBeNull()
  })
})

describe('pickLectureHero', () => {
  const lectures = [lecture('a'), lecture('b'), lecture('c')]

  it('has nothing to offer for an empty course', () => {
    expect(pickLectureHero([], {})).toBeNull()
  })

  it('offers the top of the course, not a "next", to someone with no history', () => {
    expect(pickLectureHero(lectures, {})).toEqual({
      lecture: lectures[0],
      position: 1,
      mode: 'start-here',
    })
  })

  it('resumes the most recently touched half-watched lecture', () => {
    const progress: LectureProgressMap = {
      a: entry('a', 600, '2026-08-01T10:00:00+00:00'),
      c: entry('c', 300, '2026-08-20T10:00:00+00:00'),
    }
    expect(pickLectureHero(lectures, progress)).toEqual({
      lecture: lectures[2],
      position: 3,
      mode: 'resume',
    })
  })

  it('prefers resuming over the first unwatched lecture', () => {
    const progress: LectureProgressMap = {
      b: entry('b', 300, '2026-08-20T10:00:00+00:00'),
    }
    // 'a' is untouched and earlier in the running order, but the lecture they
    // were actually in the middle of wins.
    expect(pickLectureHero(lectures, progress)?.mode).toBe('resume')
    expect(pickLectureHero(lectures, progress)?.lecture.id).toBe('b')
  })

  it('falls to the first unfinished lecture once nothing is mid-flight', () => {
    const progress: LectureProgressMap = {
      a: entry('a', HOUR, '2026-08-20T10:00:00+00:00'),
    }
    expect(pickLectureHero(lectures, progress)).toEqual({
      lecture: lectures[1],
      position: 2,
      mode: 'next-up',
    })
  })

  it('offers the last one finished when the whole course is watched', () => {
    const progress: LectureProgressMap = {
      a: entry('a', HOUR, '2026-08-20T10:00:00+00:00'),
      b: entry('b', HOUR, '2026-08-25T10:00:00+00:00'),
      c: entry('c', HOUR, '2026-08-22T10:00:00+00:00'),
    }
    expect(pickLectureHero(lectures, progress)).toEqual({
      lecture: lectures[1],
      position: 2,
      mode: 'watch-again',
    })
  })

  it('reads positions off the running order, not off the map', () => {
    const withoutDuration = [lecture('a'), lecture('b', null)]
    const progress: LectureProgressMap = {
      b: entry('b', 120, '2026-08-25T10:00:00+00:00'),
    }
    // A durationless lecture can only ever be 'in-progress', so it resumes.
    expect(pickLectureHero(withoutDuration, progress)?.position).toBe(2)
  })
})
