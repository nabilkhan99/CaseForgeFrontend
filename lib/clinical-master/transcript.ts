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
