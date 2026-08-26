import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';
import { formatElapsedSince, formatMinutesShort } from '@/lib/utils';
import { TONE_COLOUR, passMarkCaption } from '@/lib/clinical-master/scoring';

interface SessionOutcomeProps {
  session: SessionHistoryItem;
  /** Pass a ticking value where "started 4 min ago" needs to stay true. */
  now?: number;
}

/**
 * The right-hand outcome of a session row.
 *
 * Shared by the dashboard's recent list and the history page, which had grown
 * two separate copies that disagreed: history said "Not marked" where the
 * dashboard still said "No feedback available", and both stamped FAIL on every
 * unsuccessful row.
 *
 * Passing is the notable event and gets a tick; not passing is simply its
 * absence, which spares the reader a column of red without hiding anything —
 * the verdict stays in the accessibility tree, and the tick carries the meaning
 * without depending on colour. Everything that is not a score shares one quiet
 * treatment so the column reads as a column.
 */
export default function SessionOutcome({ session, now }: SessionOutcomeProps) {
  if (session.outcome === 'scored') {
    return (
      <div
        className="flex items-baseline justify-end gap-1.5"
        title={`${session.verdict} · ${passMarkCaption(session.maxScore)}`}
      >
        {session.passed && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={TONE_COLOUR.pass}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="self-center"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span
          className={`font-mono text-[15px] font-semibold tabular-nums ${session.passed ? '' : 'text-heading'}`}
          style={session.passed ? { color: TONE_COLOUR.pass } : undefined}
        >
          {session.weightedScore.toFixed(1)}
        </span>
        <span className="font-mono text-[11px] text-muted">/{session.maxScore.toFixed(1)}</span>
        <span className="sr-only">{session.verdict}</span>
      </div>
    );
  }

  let label: string;
  let hint: string | null = null;

  if (session.outcome === 'marking') {
    const elapsed = formatElapsedSince(session.startedAt, now ?? Date.now());
    label = 'Marking…';
    hint = `Usually 1–2 minutes${elapsed ? ` · started ${elapsed}` : ''}`;
  } else if (session.outcome === 'stalled') {
    label = 'Marking stopped';
    hint = 'Open to try again';
  } else if (session.outcome === 'unfinished') {
    const elapsed = formatMinutesShort(session.elapsedMs);
    label = `Left early${elapsed ? ` · ${elapsed}` : ''}`;
  } else {
    label = 'Not marked';
  }

  return (
    <div className="text-right" title={hint ?? undefined}>
      <span
        className={`font-mono text-[13px] ${session.outcome === 'marking' ? 'text-primary' : 'text-muted'}`}
      >
        {label}
      </span>
      {hint && <span className="block text-[11px] text-muted">{hint}</span>}
    </div>
  );
}
