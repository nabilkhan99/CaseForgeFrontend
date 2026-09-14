import type { TranscriptItem } from './types';

/**
 * How much the candidate actually said, measured from a stored transcript.
 *
 * The Azure marking guard refuses to mark a consultation that is too short
 * (fewer than MIN_CANDIDATE_TURNS candidate turns, or under 90 seconds between
 * the first and last one) and records only `clinical_sessions.status =
 * 'unmarkable'` — no `session_results` row, and no duration anywhere. The
 * frontend still has to be able to say "that was N seconds", so it derives the
 * same two numbers from the transcript it already has.
 *
 * Deliberately a re-derivation rather than a stored field: the transcript is
 * the thing both sides agree on, so the number the page shows can never drift
 * from the number the guard judged.
 */
export interface CandidateRun {
  /** Candidate turns carrying actual text. */
  turns: number;
  /**
   * Whole seconds between the first and last candidate turn. 0 when the
   * transcript carries no usable timestamps, or when there is only one turn.
   */
  seconds: number;
}

/** The trainee's turns, in both the spec shape and the legacy capture shape. */
function isCandidateTurn(item: TranscriptItem): boolean {
  if (item.speaker === 'candidate') return true;
  if (item.speaker === 'patient') return false;
  return item.role === 'user';
}

function textOf(item: TranscriptItem): string {
  const raw = item.text ?? item.content ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Transcripts carry two clocks: `start_ms` counts from the beginning of the
 * consultation, `timestamp` is an ISO wall-clock instant. Both are monotonic
 * within a session, so a span is the same on either — but they must never be
 * mixed, or the span becomes the gap between 1970 and today. Whichever clock
 * has at least two readings wins, `start_ms` first.
 */
function spanSeconds(startMs: number[], epochMs: number[]): number {
  const clock = startMs.length >= 2 ? startMs : epochMs;
  if (clock.length < 2) return 0;
  const span = Math.max(...clock) - Math.min(...clock);
  return Number.isFinite(span) && span > 0 ? Math.round(span / 1000) : 0;
}

/**
 * @param transcript Raw `clinical_sessions.transcript`, of unknown shape.
 */
export function candidateRun(transcript: unknown): CandidateRun {
  if (!Array.isArray(transcript)) return { turns: 0, seconds: 0 };

  const startMs: number[] = [];
  const epochMs: number[] = [];
  let turns = 0;

  for (const raw of transcript as TranscriptItem[]) {
    if (!raw || typeof raw !== 'object') continue;
    if (!isCandidateTurn(raw)) continue;
    if (!textOf(raw)) continue;

    turns += 1;

    if (typeof raw.start_ms === 'number' && Number.isFinite(raw.start_ms)) {
      startMs.push(raw.start_ms);
    }
    if (typeof raw.timestamp === 'string') {
      const parsed = Date.parse(raw.timestamp);
      if (Number.isFinite(parsed)) epochMs.push(parsed);
    }
  }

  return { turns, seconds: spanSeconds(startMs, epochMs) };
}
