import { describe, expect, it } from 'vitest';
import { calendarDaysAgo, formatElapsedSince, formatMinutesShort, formatRelativeDate } from './utils';

/**
 * An ISO stamp for a local wall-clock moment.
 *
 * Every date case below is expressed in local time so the expectations hold in
 * whatever timezone the suite happens to run in — CI, a laptop in London, a
 * laptop anywhere else. Writing them as `Z` stamps would make half of them
 * flip a day west of Greenwich.
 */
function localIso(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

describe('calendarDaysAgo — local calendar days, never elapsed 24-hour blocks', () => {
  it('is 0 anywhere inside the same calendar day', () => {
    const now = new Date(2026, 7, 26, 8, 0);
    expect(calendarDaysAgo(localIso(2026, 8, 26, 0, 5), now)).toBe(0);
    expect(calendarDaysAgo(localIso(2026, 8, 26, 7, 59), now)).toBe(0);
  });

  it('calls 23:00 last night yesterday, not today', () => {
    // The bug this replaced: 23:00 -> 08:00 is 9 elapsed hours, so
    // Math.floor(diff / 86_400_000) was 0 and the caption read "Today" about a
    // session from a different date.
    const now = new Date(2026, 7, 26, 8, 0);
    expect(calendarDaysAgo(localIso(2026, 8, 25, 23, 0), now)).toBe(1);
  });

  it('crosses a month boundary on half an hour', () => {
    const now = new Date(2026, 8, 1, 0, 30);
    expect(calendarDaysAgo(localIso(2026, 8, 31, 23, 30), now)).toBe(1);
  });

  it('crosses a year boundary', () => {
    const now = new Date(2027, 0, 1, 9, 0);
    expect(calendarDaysAgo(localIso(2026, 12, 31, 22, 0), now)).toBe(1);
    expect(calendarDaysAgo(localIso(2026, 12, 25, 22, 0), now)).toBe(7);
  });

  it('survives a spring-forward day that is only 23 hours long', () => {
    // 29 Mar 2026 is the UK clock change. In London the gap below is 8 elapsed
    // hours, not 9, and an elapsed-milliseconds bucket is a rounding accident
    // away from the wrong answer. A calendar difference is 1 in every timezone.
    const now = new Date(2026, 2, 29, 8, 0);
    expect(calendarDaysAgo(localIso(2026, 3, 28, 23, 0), now)).toBe(1);
  });

  it('goes negative for a stamp in the future', () => {
    const now = new Date(2026, 7, 26, 8, 0);
    expect(calendarDaysAgo(localIso(2026, 8, 27, 1, 0), now)).toBe(-1);
  });

  it('is null without a usable date', () => {
    expect(calendarDaysAgo('')).toBeNull();
    expect(calendarDaysAgo('not a date')).toBeNull();
  });
});

describe('formatRelativeDate', () => {
  const now = new Date(2026, 7, 26, 8, 0);

  it('names the two days people have words for', () => {
    expect(formatRelativeDate(localIso(2026, 8, 26, 0, 5), now)).toBe('Today');
    expect(formatRelativeDate(localIso(2026, 8, 25, 23, 0), now)).toBe('Yesterday');
  });

  it('counts days, then weeks, then months', () => {
    expect(formatRelativeDate(localIso(2026, 8, 23), now)).toBe('3d ago');
    expect(formatRelativeDate(localIso(2026, 8, 12), now)).toBe('2w ago');
    expect(formatRelativeDate(localIso(2026, 6, 20), now)).toBe('2mo ago');
  });

  it('reads a future stamp as today rather than a negative age', () => {
    expect(formatRelativeDate(localIso(2026, 8, 27), now)).toBe('Today');
  });

  it('is empty without a date', () => {
    expect(formatRelativeDate('', now)).toBe('');
    expect(formatRelativeDate('not a date', now)).toBe('');
  });
});

describe('formatMinutesShort', () => {
  it('rounds to whole minutes', () => {
    expect(formatMinutesShort(184_000)).toBe('3 min');
    expect(formatMinutesShort(694_900)).toBe('12 min');
  });

  it('never says "0 min"', () => {
    expect(formatMinutesShort(16_561)).toBe('under a minute');
    expect(formatMinutesShort(0)).toBe('under a minute');
  });

  it('is null when nothing was captured', () => {
    expect(formatMinutesShort(null)).toBeNull();
    expect(formatMinutesShort(undefined)).toBeNull();
    expect(formatMinutesShort(Number.NaN)).toBeNull();
  });
});

describe('formatElapsedSince', () => {
  const now = new Date('2026-08-22T12:00:00Z').getTime();

  it('describes a wait that has only just started', () => {
    expect(formatElapsedSince('2026-08-22T11:59:40Z', now)).toBe('just now');
  });

  it('counts minutes, then hours', () => {
    expect(formatElapsedSince('2026-08-22T11:56:00Z', now)).toBe('4 min ago');
    expect(formatElapsedSince('2026-08-22T11:00:00Z', now)).toBe('1 hour ago');
    expect(formatElapsedSince('2026-08-22T09:00:00Z', now)).toBe('3 hours ago');
  });

  it('is null without a date', () => {
    expect(formatElapsedSince('', now)).toBeNull();
    expect(formatElapsedSince('not a date', now)).toBeNull();
  });
});
