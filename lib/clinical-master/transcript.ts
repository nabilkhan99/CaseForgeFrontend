/**
 * Normalise a stored consultation transcript for display.
 *
 * `clinical_sessions.transcript` carries two shapes at once: the spec shape
 * (`speaker` / `text` / `start_ms`) and the legacy capture shape
 * (`role` / `content` / `timestamp`). Rows written by the current realtime
 * session hold both; older rows hold only the legacy keys. Everything that
 * renders a transcript reads it through here so neither surface has to know.
 */
import type { TranscriptItem } from './types';

export interface TranscriptLine {
  /** Stable key for React — the stored id when there is one, else the index. */
  key: string;
  speaker: 'candidate' | 'patient';
  /** How the speaker is labelled in the report. */
  label: string;
  text: string;
  /** Milliseconds from the start of the consultation, when known. */
  timestampMs: number | null;
}

function speakerOf(item: TranscriptItem): 'candidate' | 'patient' {
  if (item.speaker === 'candidate' || item.speaker === 'patient') return item.speaker;
  // Legacy rows: the trainee is the 'user' turn, the AI patient the 'assistant'.
  return item.role === 'user' ? 'candidate' : 'patient';
}

function textOf(item: TranscriptItem): string {
  const raw = item.text ?? item.content ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * @param items Raw transcript array straight from the API.
 * @param patientLabel Name to show for the patient turns, when known.
 */
export function normaliseTranscript(
  items: unknown,
  patientLabel = 'Patient'
): TranscriptLine[] {
  if (!Array.isArray(items)) return [];

  return (items as TranscriptItem[])
    .map((item, index): TranscriptLine | null => {
      if (!item || typeof item !== 'object') return null;
      const text = textOf(item);
      if (!text) return null;
      const speaker = speakerOf(item);
      return {
        key: typeof item.id === 'string' && item.id ? item.id : `line-${index}`,
        speaker,
        label: speaker === 'candidate' ? 'You' : patientLabel,
        text,
        timestampMs: typeof item.start_ms === 'number' && Number.isFinite(item.start_ms)
          ? item.start_ms
          : null,
      };
    })
    .filter((line): line is TranscriptLine => line !== null);
}

/** `mm:ss` from milliseconds, for transcript and evidence timestamps. */
export function formatTimestamp(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * The same instant said out loud, for the label on a control that jumps to it.
 * "04:12" read by a screen reader is "zero four colon one two", which tells
 * nobody where they are about to land.
 */
export function spokenTimestamp(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '';
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** DOM id for one rendered transcript turn, namespaced so two reports can share a page. */
export function transcriptTurnId(prefix: string, key: string): string {
  return `${prefix}-turn-${key}`;
}

/**
 * How far an evidence timestamp may sit from a turn's start before we refuse to
 * call it a match.
 *
 * Measured against production rows: across 105 timestamped evidence items in
 * four marked sessions, the distance from the quoted moment to the nearest
 * turn's `start_ms` averaged ~0.6s and never exceeded 5.9s — the marker reads
 * the same transcript we render, and only rounds to the second. 15s is
 * therefore generous headroom rather than a guess, while still refusing a
 * timestamp that lands nowhere near a turn (a quote at 09:00 of a consultation
 * whose transcript stops at 02:00 gets no chip instead of a wrong one).
 */
export const EVIDENCE_MATCH_TOLERANCE_MS = 15_000;

/** Nearest timed turn by absolute distance; ties keep the earlier turn. */
function nearestTurn(lines: TranscriptLine[], timestampMs: number): TranscriptLine | null {
  let best: TranscriptLine | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.timestampMs == null) continue;
    const gap = Math.abs(line.timestampMs - timestampMs);
    // Strictly less-than, so an exact tie keeps whichever turn came first.
    if (gap < bestGap) {
      best = line;
      bestGap = gap;
    }
  }
  return best !== null && bestGap <= EVIDENCE_MATCH_TOLERANCE_MS ? best : null;
}

/**
 * The transcript turn an evidence timestamp points at, or null when nothing
 * lines up.
 *
 * `TranscriptLine.timestampMs` is a turn's `start_ms` and an evidence
 * `timestamp_ms` is the marker's reading of when the quote was said, so the two
 * almost never match exactly and this has to be a nearest-turn lookup rather
 * than a key match.
 *
 * `speaker` breaks the one case nearest-by-distance gets wrong: a quote landing
 * in the seam between two turns, where the closest start belongs to the other
 * speaker. Preferring turns by the same speaker fixed 1 of 33 sampled items and
 * changed none of the rest. It is a preference, not a filter — if no turn by
 * that speaker is close enough, the unrestricted nearest still applies, because
 * a mislabelled speaker on an otherwise good timestamp should not cost the
 * reader their jump.
 */
export function findTranscriptAnchor(
  lines: TranscriptLine[],
  timestampMs: number | null | undefined,
  speaker?: 'candidate' | 'patient' | null
): TranscriptLine | null {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return null;

  const sameSpeaker = speaker
    ? lines.filter((line) => line.speaker === speaker)
    : [];
  return nearestTurn(sameSpeaker, timestampMs) ?? nearestTurn(lines, timestampMs);
}
