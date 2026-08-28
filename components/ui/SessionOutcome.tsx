import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';
import { formatElapsedSince, formatMinutesShort } from '@/lib/utils';
import { TONE_COLOUR, passMarkCaption } from '@/lib/clinical-master/scoring';
import OutcomeGlyph from '@/components/ui/OutcomeGlyph';

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
 * dashboard still said "No feedback available".
 *
 * OUTCOME MARKS — all three states carry one. This reverses an earlier call,
 * and the earlier reasoning is kept here because it is still half right.
 *
 * The first version stamped FAIL on every unsuccessful row and was removed for
 * turning the outcome column into a column of red. The version after it swung
 * the other way: a tick for a pass and nothing at all otherwise, on the
 * argument that not passing is simply the absence of passing.
 *
 * The product owner has asked for all three — passed, not passed, left early —
 * and that is the right call. A column where only one state is marked has to be
 * read twice, because an unmarked row could equally be a fail, an abandoned
 * consultation or a session still being marked; the absence of a mark was doing
 * three jobs. Someone scanning forty rows for the ones they walked out of had
 * nothing to scan for.
 *
 * The original complaint is answered by weight, not by omission. Only the pass
 * is solid and saturated; not-passed is a thin half-filled ring at reduced
 * opacity and left-early takes no tone colour at all (see
 * components/ui/OutcomeGlyph, where the family is drawn). A glance down the
 * column still finds the passes first, which was the point of removing FAIL.
 *
 * Two conventions carry over unchanged. Every glyph is aria-hidden with its
 * meaning in words beside it — an `sr-only` span where the visible text does
 * not already say it — so colour and shape are never the only channel. And
 * everything that is not a score keeps one quiet treatment, so the column reads
 * as a column.
 *
 * The glyphs take no tabindex and no handlers: the whole history row is a
 * single link, and a focusable mark inside it would add a tab stop leading
 * nowhere. No hooks and no client directive here either — this renders on the
 * server.
 */
export default function SessionOutcome({ session, now }: SessionOutcomeProps) {
  if (session.outcome === 'scored') {
    return (
      <div
        className="flex items-baseline justify-end gap-1.5"
        title={`${session.verdict} · ${passMarkCaption(session.maxScore)}`}
      >
        <OutcomeGlyph
          kind={session.passed ? 'pass' : 'partial'}
          className="self-center flex-shrink-0"
        />
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
    // Elapsed time is a fact we hold; how long marking will take is not. The
    // hint used to lead with "Usually 1–2 minutes", and because the history
    // page feeds this a ticking `now`, a stuck run rendered the claim and its
    // own refutation on one line: "Usually 1–2 minutes · started 47 min ago".
    const elapsed = formatElapsedSince(session.startedAt, now ?? Date.now());
    label = 'Marking…';
    hint = elapsed ? `Started ${elapsed}` : null;
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
    <div className="flex items-baseline justify-end gap-1.5" title={hint ?? undefined}>
      {/* No sr-only twin for this one: "Left early · 3 min" is already sitting
          next to it in visible text, and repeating it would have a screen
          reader say the words twice. */}
      {session.outcome === 'unfinished' && (
        <OutcomeGlyph kind="left-early" className="self-center flex-shrink-0" />
      )}
      <div className="text-right">
        <span
          className={`font-mono text-[13px] ${session.outcome === 'marking' ? 'text-primary' : 'text-muted'}`}
        >
          {label}
        </span>
        {hint && <span className="block text-[11px] text-muted">{hint}</span>}
      </div>
    </div>
  );
}
