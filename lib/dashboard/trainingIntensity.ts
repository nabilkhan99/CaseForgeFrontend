/**
 * The daily-activity board on the dashboard home, and the ledger underneath it.
 *
 * Kept out of the component for the same reason the history summary is: the
 * markup is 26 columns of squares, and everything that can actually be wrong is
 * calendar arithmetic — which day a 23:00 consultation belongs to, whether a
 * streak survives a morning you have not practised yet, and what "this week"
 * means on a Monday.
 *
 * Every figure the ledger and the headline report is derived from the cells that
 * were built, never from the raw timestamps a second time. The picture and the
 * numbers beside it are then two readings of one array and cannot disagree —
 * which is the whole reason a board like this is trusted.
 *
 * Bucketing is by LOCAL calendar day throughout. A trainee who finishes at
 * 23:30 has practised today, whatever UTC thinks.
 */

/** Columns the board draws, i.e. how far back it remembers. */
export const INTENSITY_WEEKS = 26;

/** Cap on the colour ramp: five squares' worth of intensity, 0 through 4. */
const MAX_LEVEL = 4;

const DAYS_PER_WEEK = 7;

/**
 * Active days below which no week can be "your most yet".
 *
 * Under three weeks of scattered practice every new week is trivially a record,
 * and a board that congratulates you on your second-ever consultation is a
 * board nobody believes by week ten. Until then the suffix just says you have
 * started.
 */
const UNDERWAY_ACTIVE_DAYS = 20;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export interface IntensityDay {
  /** Local calendar day as `YYYY-MM-DD`. Never a UTC instant. */
  date: string;
  /** Consultations completed that day. */
  count: number;
  /** `count` clamped to the ramp the board can draw. */
  level: number;
  /** A day inside the last column that has not happened yet. */
  isFuture: boolean;
}

export interface IntensityWeek {
  /** Monday through Sunday, always seven. */
  days: IntensityDay[];
}

export interface IntensityLedger {
  /** Consultations across the whole window. */
  total: number;
  /**
   * Consultations per elapsed day, to one decimal, as a string.
   *
   * A string because it is a display figure and rounding it once here stops two
   * callers formatting the same number two ways.
   */
  dailyAvg: string;
  /** Share of elapsed days with at least one consultation, as a whole percent. */
  daysPct: number;
  /** Longest run of consecutive active days in the window. */
  longest: number;
  /** Run of active days ending today — or ending yesterday, see below. */
  current: number;
}

export interface IntensityCalendar {
  /** Oldest column first; the last one contains `today`. */
  weeks: IntensityWeek[];
  /** One label per column: a month name where the month turns over, else ''. */
  months: string[];
  ledger: IntensityLedger;
  /** The sentence above the board, e.g. "4 consultations this week — up from 2 last week". */
  headline: string;
}

/** Local midnight on the Monday of the week containing `date`. */
function startOfWeek(date: Date): Date {
  // getDay() is Sunday-first; the board is Monday-first.
  const shift = (date.getDay() + 6) % DAYS_PER_WEEK;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - shift);
}

/**
 * Calendar-day arithmetic that survives clock changes.
 *
 * `new Date(y, m, d + n)` normalises through month and year ends and lands on
 * local midnight either way, where adding 86_400_000ms to a timestamp drifts an
 * hour twice a year and eventually lands on the wrong day.
 */
function addDays(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}

function dayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * The first day the board shows: the Monday `weeks - 1` weeks before this one.
 *
 * Exported because the query that fetches the timestamps has to ask for exactly
 * this window — deriving the cut-off anywhere else is how a board ends up drawn
 * from a different range than it was filled from.
 */
export function intensityWindowStart(
  today: Date = new Date(),
  weeks: number = INTENSITY_WEEKS,
): Date {
  return addDays(startOfWeek(today), -(weeks - 1) * DAYS_PER_WEEK);
}

/** Consultations per local day, keyed as `YYYY-MM-DD`. */
function countByDay(timestamps: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const timestamp of timestamps) {
    const when = new Date(timestamp);
    if (Number.isNaN(when.getTime())) continue;
    const key = dayKey(when);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function round1(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/**
 * Build the whole board — cells, month labels, ledger and headline — from a
 * list of completion timestamps.
 *
 * `today` is injected rather than read from the clock so the window, the
 * streaks and "this week" are all testable, and so one render cannot straddle
 * midnight and produce a board that disagrees with its own ledger.
 */
export function buildIntensityCalendar(
  timestamps: readonly string[],
  today: Date = new Date(),
  weeks: number = INTENSITY_WEEKS,
): IntensityCalendar {
  const counts = countByDay(timestamps);
  const start = intensityWindowStart(today, weeks);
  // Today's own index in the flattened window; everything after it is a day
  // that has not happened, not a day with no practice.
  const todayIndex = (weeks - 1) * DAYS_PER_WEEK + ((today.getDay() + 6) % DAYS_PER_WEEK);

  const days: IntensityDay[] = [];
  for (let i = 0; i < weeks * DAYS_PER_WEEK; i++) {
    const date = dayKey(addDays(start, i));
    const isFuture = i > todayIndex;
    const count = isFuture ? 0 : (counts.get(date) ?? 0);
    days.push({ date, count, level: Math.min(MAX_LEVEL, count), isFuture });
  }

  const calendarWeeks: IntensityWeek[] = [];
  const months: string[] = [];
  let previousMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const monday = addDays(start, w * DAYS_PER_WEEK);
    const month = monday.getMonth();
    // The first column is always labelled — the reader needs one anchor even
    // when the board opens mid-month.
    months.push(w === 0 || month !== previousMonth ? MONTH_NAMES[month] : '');
    previousMonth = month;
    calendarWeeks.push({ days: days.slice(w * DAYS_PER_WEEK, (w + 1) * DAYS_PER_WEEK) });
  }

  const elapsed = days.slice(0, todayIndex + 1);
  const total = elapsed.reduce((sum, day) => sum + day.count, 0);
  const activeDays = elapsed.filter(day => day.count > 0).length;

  let longest = 0;
  let run = 0;
  for (const day of elapsed) {
    run = day.count > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }

  // A streak is not broken by a morning you have not practised yet, so when
  // today is still empty the run is counted from yesterday. Anything stricter
  // would zero the figure every night at midnight and read as a punishment for
  // opening the dashboard before work.
  let current = 0;
  let cursor = elapsed.length - 1;
  if (elapsed[cursor].count === 0) cursor--;
  for (; cursor >= 0 && elapsed[cursor].count > 0; cursor--) current++;

  const weekTotals = calendarWeeks.map(week =>
    week.days.reduce((sum, day) => sum + day.count, 0),
  );
  const thisWeek = weekTotals[weeks - 1];
  const lastWeek = weeks > 1 ? weekTotals[weeks - 2] : 0;
  const bestPriorWeek = Math.max(0, ...weekTotals.slice(0, weeks - 1));

  const suffix =
    activeDays <= UNDERWAY_ACTIVE_DAYS
      ? ' — you’re underway'
      : thisWeek >= bestPriorWeek
        ? ' — your most yet'
        : thisWeek > lastWeek
          ? ` — up from ${lastWeek} last week`
          : '';

  return {
    weeks: calendarWeeks,
    months,
    ledger: {
      total,
      dailyAvg: round1(total / elapsed.length),
      daysPct: Math.round((activeDays / elapsed.length) * 100),
      longest,
      current,
    },
    headline: `${thisWeek} consultation${thisWeek === 1 ? '' : 's'} this week${suffix}`,
  };
}
