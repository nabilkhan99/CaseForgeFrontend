import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInCalendarDays } from "date-fns";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * How many local calendar days ago something happened. null for no date.
 *
 * Calendar days, not elapsed 24-hour blocks. This used to be
 * `Math.floor((now - date) / 86400000)` inline in formatRelativeDate, which
 * gets last night wrong: a session at 23:00 yesterday is ~9 hours old at 08:00
 * this morning, so the elapsed formula returns 0 and the caption said "Today"
 * about something that happened on a different date. It is also wrong across a
 * spring DST boundary, where a calendar day is only 23 hours long.
 *
 * One function so every surface buckets identically — the history summary strip
 * and the row captions sitting an inch below it cannot disagree about which
 * sessions were "today".
 */
export function calendarDaysAgo(dateStr: string, now: Date | number = Date.now()): number | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (!Number.isFinite(date.getTime())) return null;
    return differenceInCalendarDays(now, date);
}

export function formatRelativeDate(dateStr: string, now: Date | number = Date.now()): string {
    const diffDays = calendarDaysAgo(dateStr, now);
    if (diffDays === null) return '';
    // <= 0 rather than === 0: a stamp a few seconds into the future (clock skew
    // between the browser and Postgres) should read "Today", not "0mo ago".
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

/**
 * A consultation length, said the way a person would: "3 min", "under a minute".
 *
 * Used for sessions the user walked out of, where the only thing worth saying
 * is how far they got before they left.
 */
export function formatMinutesShort(ms: number | null | undefined): string | null {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
    if (ms < 60_000) return 'under a minute';
    return `${Math.round(ms / 60_000)} min`;
}

/** "just now" / "4 min ago" / "2 hours ago" — for a wait that is still running. */
export function formatElapsedSince(iso: string, now: number = Date.now()): string | null {
    if (!iso) return null;
    const started = new Date(iso).getTime();
    if (!Number.isFinite(started)) return null;
    const elapsedMs = Math.max(0, now - started);
    const minutes = Math.floor(elapsedMs / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}
