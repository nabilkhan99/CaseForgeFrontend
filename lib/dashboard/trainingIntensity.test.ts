import { describe, expect, it } from 'vitest';
import { buildIntensityCalendar, intensityWindowStart } from './trainingIntensity';

/**
 * Two families of behaviour get tested hard.
 *
 * Calendar placement, because a square in the wrong column is a lie the reader
 * cannot detect — and because week boundaries, month turnovers and the "today"
 * cut-off are all off-by-one traps.
 *
 * And the ledger's streaks, because they are the figures a trainee will check
 * against their own memory of the week. The current-streak rule in particular
 * (a run may end yesterday) exists to stop the number collapsing to 0 every
 * night at midnight, so it is pinned from both sides.
 */

/** Local wall clock, so the expectations hold in any timezone. */
function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

/** Wednesday 26 Aug 2026, 09:00 local. */
const WEDNESDAY = new Date(2026, 7, 26, 9, 0);

/** `n` timestamps on one local day. */
function onDay(year: number, month: number, day: number, n = 1): string[] {
  return Array.from({ length: n }, () => localIso(year, month, day));
}

describe('buildIntensityCalendar — the window', () => {
  it('draws 26 Monday-to-Sunday columns ending in the week containing today', () => {
    const calendar = buildIntensityCalendar([], WEDNESDAY);

    expect(calendar.weeks).toHaveLength(26);
    expect(calendar.weeks.every(week => week.days.length === 7)).toBe(true);
    // Last column starts Monday 24 Aug and ends Sunday 30 Aug.
    expect(calendar.weeks[25].days[0].date).toBe('2026-08-24');
    expect(calendar.weeks[25].days[6].date).toBe('2026-08-30');
    // First column is 25 weeks earlier, still a Monday.
    expect(calendar.weeks[0].days[0].date).toBe('2026-03-02');
  });

  it('starts the window where intensityWindowStart says it does', () => {
    const start = intensityWindowStart(WEDNESDAY);
    const calendar = buildIntensityCalendar([], WEDNESDAY);

    expect(calendar.weeks[0].days[0].date).toBe('2026-03-02');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(2);
  });

  it('treats a Sunday as the last day of its own week, not the first of the next', () => {
    const sunday = new Date(2026, 7, 30, 20, 0);
    const calendar = buildIntensityCalendar([], sunday);

    expect(calendar.weeks[25].days[6].date).toBe('2026-08-30');
    expect(calendar.weeks[25].days[6].isFuture).toBe(false);
  });

  it('marks the rest of the current week future and never counts it', () => {
    const calendar = buildIntensityCalendar(
      // A timestamp dated after today cannot land in a cell it would be counted in.
      onDay(2026, 8, 29),
      WEDNESDAY,
    );
    const thisWeek = calendar.weeks[25].days;

    expect(thisWeek.map(d => d.isFuture)).toEqual([false, false, false, true, true, true, true]);
    expect(thisWeek.every(d => !d.isFuture || (d.count === 0 && d.level === 0))).toBe(true);
    expect(calendar.ledger.total).toBe(0);
  });
});

describe('buildIntensityCalendar — cells', () => {
  it('groups timestamps into local calendar days', () => {
    const calendar = buildIntensityCalendar(
      [...onDay(2026, 8, 25, 2), localIso(2026, 8, 25, 23), localIso(2026, 8, 26, 0)],
      WEDNESDAY,
    );
    const [, tuesday, wednesday] = calendar.weeks[25].days;

    // 23:00 on Tuesday is Tuesday; 00:00 on Wednesday is Wednesday.
    expect(tuesday.count).toBe(3);
    expect(wednesday.count).toBe(1);
  });

  it('clamps the level at 4 while the count keeps its real value', () => {
    const calendar = buildIntensityCalendar(onDay(2026, 8, 25, 9), WEDNESDAY);
    const tuesday = calendar.weeks[25].days[1];

    expect(tuesday.count).toBe(9);
    expect(tuesday.level).toBe(4);
  });

  it('maps counts 0 to 4 straight onto levels below the cap', () => {
    const calendar = buildIntensityCalendar(
      [...onDay(2026, 8, 24, 1), ...onDay(2026, 8, 25, 4)],
      WEDNESDAY,
    );
    const [monday, tuesday, wednesday] = calendar.weeks[25].days;

    expect([monday.level, tuesday.level, wednesday.level]).toEqual([1, 4, 0]);
  });

  it('ignores timestamps it cannot parse rather than drawing a NaN day', () => {
    const calendar = buildIntensityCalendar(['not a date', ...onDay(2026, 8, 25)], WEDNESDAY);

    expect(calendar.ledger.total).toBe(1);
  });
});

describe('buildIntensityCalendar — month labels', () => {
  it('labels the first column and every column whose Monday opens a new month', () => {
    const calendar = buildIntensityCalendar([], WEDNESDAY);

    // 26 columns from Mon 2 Mar to Mon 24 Aug 2026.
    expect(calendar.months[0]).toBe('Mar');
    expect(calendar.months.filter(Boolean)).toEqual(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
  });

  it('leaves every other column blank so the row reads as a timeline', () => {
    const calendar = buildIntensityCalendar([], WEDNESDAY);

    expect(calendar.months).toHaveLength(26);
    expect(calendar.months.filter(label => label === '')).toHaveLength(20);
  });

  it('still labels the first column when it sits mid-month', () => {
    // Mon 6 Apr is not the first Monday of April in this window's first column.
    const calendar = buildIntensityCalendar([], new Date(2026, 3, 8, 9, 0), 2);

    expect(calendar.months[0]).not.toBe('');
  });
});

describe('buildIntensityCalendar — the ledger', () => {
  it('averages over elapsed days only, not the whole board', () => {
    // 3 sessions across a window that is 25 full weeks + 3 elapsed days = 178.
    const calendar = buildIntensityCalendar(onDay(2026, 8, 25, 3), WEDNESDAY);

    expect(calendar.ledger.total).toBe(3);
    expect(calendar.ledger.dailyAvg).toBe('0.0');
  });

  it('reports the longest run of consecutive active days', () => {
    const calendar = buildIntensityCalendar(
      [
        ...onDay(2026, 8, 10),
        ...onDay(2026, 8, 11),
        ...onDay(2026, 8, 12),
        ...onDay(2026, 8, 14),
        ...onDay(2026, 8, 25),
      ],
      WEDNESDAY,
    );

    expect(calendar.ledger.longest).toBe(3);
  });

  it('counts a current streak that runs up to today', () => {
    const calendar = buildIntensityCalendar(
      [...onDay(2026, 8, 24), ...onDay(2026, 8, 25), ...onDay(2026, 8, 26)],
      WEDNESDAY,
    );

    expect(calendar.ledger.current).toBe(3);
  });

  it('keeps a streak alive on a morning with no practice yet', () => {
    // Nothing today; the run ends yesterday and is still a run.
    const calendar = buildIntensityCalendar(
      [...onDay(2026, 8, 23), ...onDay(2026, 8, 24), ...onDay(2026, 8, 25)],
      WEDNESDAY,
    );

    expect(calendar.ledger.current).toBe(3);
  });

  it('breaks the streak once a whole empty day sits behind today', () => {
    const calendar = buildIntensityCalendar(
      [...onDay(2026, 8, 23), ...onDay(2026, 8, 24)],
      WEDNESDAY,
    );

    expect(calendar.ledger.current).toBe(0);
  });
});

describe('buildIntensityCalendar — the headline', () => {
  /** Fill enough days to clear the "underway" tier, ending before `stopDay`. */
  function busyHistory(): string[] {
    const stamps: string[] = [];
    // 30 active days through May and June, well clear of this week and last.
    for (let day = 1; day <= 30; day++) stamps.push(...onDay(2026, 5, day));
    return stamps;
  }

  it('says you are underway while the board is still nearly empty', () => {
    const calendar = buildIntensityCalendar(onDay(2026, 8, 24, 2), WEDNESDAY);

    expect(calendar.headline).toBe('2 consultations this week — you’re underway');
  });

  it('uses the singular for one consultation', () => {
    const calendar = buildIntensityCalendar(onDay(2026, 8, 24), WEDNESDAY);

    expect(calendar.headline).toBe('1 consultation this week — you’re underway');
  });

  it('calls a record week your most yet', () => {
    const calendar = buildIntensityCalendar(
      [...busyHistory(), ...onDay(2026, 8, 24, 6), ...onDay(2026, 8, 25, 6)],
      WEDNESDAY,
    );

    expect(calendar.headline).toBe('12 consultations this week — your most yet');
  });

  it('compares against last week when this week is not a record', () => {
    const calendar = buildIntensityCalendar(
      [
        ...busyHistory(),
        // A 5-session week in May sets the bar out of reach.
        ...onDay(2026, 6, 8, 5),
        ...onDay(2026, 8, 17, 1), // last week
        ...onDay(2026, 8, 24, 3), // this week
      ],
      WEDNESDAY,
    );

    expect(calendar.headline).toBe('3 consultations this week — up from 1 last week');
  });

  it('says nothing extra when this week is behind both marks', () => {
    const calendar = buildIntensityCalendar(
      [
        ...busyHistory(),
        ...onDay(2026, 6, 8, 5),
        ...onDay(2026, 8, 17, 4), // last week
        ...onDay(2026, 8, 24, 2), // this week
      ],
      WEDNESDAY,
    );

    expect(calendar.headline).toBe('2 consultations this week');
  });
});

describe('buildIntensityCalendar — no data at all', () => {
  it('renders a whole empty board rather than throwing', () => {
    const calendar = buildIntensityCalendar([], WEDNESDAY);

    expect(calendar.weeks.flatMap(w => w.days).every(d => d.count === 0 && d.level === 0)).toBe(true);
    expect(calendar.ledger).toEqual({
      total: 0,
      dailyAvg: '0.0',
      longest: 0,
      current: 0,
    });
    expect(calendar.headline).toBe('0 consultations this week — you’re underway');
  });
});
