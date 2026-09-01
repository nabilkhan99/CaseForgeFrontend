/**
 * How one attempt dates itself in the library's history.
 *
 * The library carries the attempt history the History tab used to, so each line
 * has to say when it happened on its own. The old "#2" only said it was the
 * second of however many, which is the one fact the list's own order already
 * gives you.
 *
 * Today and yesterday keep a clock time, because two attempts at the same case
 * in one evening are the pair you most need to tell apart; anything older is a
 * calendar date, which is how you find a session you half-remember. The year
 * shows only when it isn't the current one — "26 Aug 2025" beside "26 Aug"
 * reads as a typo when both are this year.
 *
 * `now` is injectable so this is testable without freezing the clock.
 */

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const MS_PER_DAY = 86_400_000;

/** Local midnight, so "yesterday" is a calendar day and not 24 hours ago. */
function startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Built by hand rather than through toLocaleTimeString: the runtime locale
 * decides between "2:15 pm", "14:15" and "2:15 PM", and this string sits in a
 * fixed-width column beside three others.
 */
function clockTime(date: Date): string {
    const hours = date.getHours();
    const suffix = hours < 12 ? 'am' : 'pm';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${String(date.getMinutes()).padStart(2, '0')}${suffix}`;
}

/**
 * "Today, 2:15pm" · "Yesterday, 9:04am" · "26 Aug" · "26 Aug 2025".
 *
 * Returns an empty string for a missing or unparseable timestamp, so a bad row
 * renders a line with no date rather than "Invalid Date".
 */
export function formatAttemptDate(timestamp: string | null | undefined, now: Date = new Date()): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';

    const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / MS_PER_DAY);

    if (daysAgo === 0) return `Today, ${clockTime(date)}`;
    if (daysAgo === 1) return `Yesterday, ${clockTime(date)}`;

    const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
    // A future timestamp is clock skew, not a real date, but it is still that
    // calendar day — fall through rather than inventing a "tomorrow".
    return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
}
