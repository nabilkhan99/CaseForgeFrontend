/**
 * A consultation that is never going to be marked, told apart from one that is
 * still being marked.
 *
 * /try/feedback opens on the promise "marking takes about a minute", and backs
 * it with a poll that waits five (100 × 3s). That is right for a consultation
 * that ended: the transcript save moves the row to `processing` and a result
 * lands 80–90 seconds later. It is badly wrong for a row still sitting in
 * `live` or `reading`, which is what a closed tab, a killed browser or a dead
 * connection leaves behind — nothing ever saved a transcript, nothing ever
 * asked Azure for a mark, and no result is coming. The page spent five minutes
 * telling those people their consultation was being marked, and then went
 * quiet.
 *
 * The row cannot say "abandoned" on its own — nobody was there to say it — so
 * it is inferred from the clock. A consultation is over when its own duration
 * has elapsed; past that, plus a couple of minutes for the save and the mark,
 * a row that never left `live` never will.
 *
 * Deliberately a pure function in its own module: the decision is a piece of
 * product judgement with three inputs and one bit of output, and the route that
 * uses it is a place where that is hard to see and impossible to test at the
 * edges.
 */

/**
 * Slack between "the consultation's clock ran out" and "no mark is coming".
 *
 * Covers the final transcript save and the mark itself, both of which happen
 * after the last word: marking runs 80–90 seconds on a full station. It is
 * generous on purpose — the cost of being early is telling somebody their
 * finished consultation was abandoned, which is a worse lie than the one being
 * fixed.
 */
export const UNFINISHED_GRACE_SECONDS = 120

/** What an SCA station runs for when the row does not say. */
export const DEFAULT_CONSULTATION_SECONDS = 12 * 60

/** The two states a consultation sits in while it is (or should be) running. */
const RUNNING_STATES = new Set(['live', 'reading'])

export interface UnfinishedRunInput {
  /** `clinical_sessions.status`. */
  status: string | null | undefined
  /** `clinical_sessions.started_at`, an ISO string. */
  startedAt: string | null | undefined
  /** The station's `consultation_duration_seconds`, however it arrives. */
  durationSeconds?: unknown
  /** How many turns the transcript holds. Zero means nothing was ever captured. */
  transcriptTurns?: number
  nowMs: number
}

/** Whole seconds, or the SCA's twelve minutes when the row is silent or junk. */
export function consultationSeconds(value: unknown): number {
  const seconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_CONSULTATION_SECONDS
  return Math.round(seconds)
}

export function isUnfinishedRun({
  status,
  startedAt,
  durationSeconds,
  transcriptTurns = 0,
  nowMs,
}: UnfinishedRunInput): boolean {
  // Every other status is somebody's answer: `processing` is being marked,
  // `completed` and `unmarkable` have been answered, `abandoned` was said out
  // loud. Only a row still claiming to be running can be stale.
  if (!RUNNING_STATES.has(String(status ?? ''))) return false

  const openedMs = startedAt ? Date.parse(startedAt) : NaN
  // No readable start is no evidence of age. Keep waiting rather than call a
  // consultation abandoned on a field we could not parse.
  if (!Number.isFinite(openedMs)) return false

  const ageSeconds = (nowMs - openedMs) / 1000
  const duration = consultationSeconds(durationSeconds)

  // Nothing was ever said, so there is no transcript for the mark to have been
  // waiting on: the consultation's own clock running out is enough.
  if (transcriptTurns <= 0) return ageSeconds > duration

  return ageSeconds > duration + UNFINISHED_GRACE_SECONDS
}
