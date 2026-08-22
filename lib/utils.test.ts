import { describe, expect, it } from 'vitest';
import { formatElapsedSince, formatMinutesShort } from './utils';

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
