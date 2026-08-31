import { describe, expect, it } from 'vitest';
import { formatAttemptDate } from './attemptDate';

// Local time throughout: the strings are built from a user's own calendar day,
// so every fixture is constructed the same way the browser would read one.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('formatAttemptDate', () => {
    const now = at(2026, 8, 29, 18, 30);

    it('names today with a clock time', () => {
        expect(formatAttemptDate(at(2026, 8, 29, 14, 15).toISOString(), now)).toBe('Today, 2:15pm');
    });

    it('names yesterday with a clock time', () => {
        expect(formatAttemptDate(at(2026, 8, 28, 9, 4).toISOString(), now)).toBe('Yesterday, 9:04am');
    });

    it('falls back to a calendar date once it is older', () => {
        expect(formatAttemptDate(at(2026, 8, 26, 14, 15).toISOString(), now)).toBe('26 Aug');
    });

    it('adds the year only when it is not the current one', () => {
        expect(formatAttemptDate(at(2025, 8, 26, 14, 15).toISOString(), now)).toBe('26 Aug 2025');
    });

    it('treats yesterday as a calendar day, not 24 hours', () => {
        // 23:50 yesterday is under 24h before 18:30 today's reference... in fact
        // it is 18h40m ago, which a naive hour count would call "today".
        expect(formatAttemptDate(at(2026, 8, 28, 23, 50).toISOString(), now)).toBe(
            'Yesterday, 11:50pm',
        );
    });

    it('renders midnight and noon without a zero or a 12/0 mix-up', () => {
        expect(formatAttemptDate(at(2026, 8, 29, 0, 5).toISOString(), now)).toBe('Today, 12:05am');
        expect(formatAttemptDate(at(2026, 8, 29, 12, 0).toISOString(), now)).toBe('Today, 12:00pm');
    });

    it('gives a future timestamp its own calendar day rather than a "tomorrow"', () => {
        expect(formatAttemptDate(at(2026, 8, 31, 9, 0).toISOString(), now)).toBe('31 Aug');
    });

    it('returns nothing for a missing or unparseable timestamp', () => {
        expect(formatAttemptDate(null, now)).toBe('');
        expect(formatAttemptDate(undefined, now)).toBe('');
        expect(formatAttemptDate('', now)).toBe('');
        expect(formatAttemptDate('not a date', now)).toBe('');
    });
});
