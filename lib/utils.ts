import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatRelativeDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
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
