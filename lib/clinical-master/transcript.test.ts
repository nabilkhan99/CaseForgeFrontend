import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_MATCH_TOLERANCE_MS,
  findTranscriptAnchor,
  formatTimestamp,
  normaliseTranscript,
  spokenTimestamp,
  transcriptTurnId,
  type TranscriptLine,
} from './transcript';

describe('normaliseTranscript', () => {
  it('reads the current dual-shape rows the realtime session writes', () => {
    // Shape copied from a production clinical_sessions.transcript row.
    const lines = normaliseTranscript(
      [
        {
          id: 'rt-1783200920678-0',
          role: 'assistant',
          text: 'Hi, doctor',
          content: 'Hi, doctor',
          speaker: 'patient',
          start_ms: 670,
          timestamp: '2026-07-04T21:35:20.678Z',
        },
        {
          id: 'rt-1783200920678-1',
          role: 'user',
          text: 'Hello, come in.',
          content: 'Hello, come in.',
          speaker: 'candidate',
          start_ms: 4200,
        },
      ],
      'Sophie'
    );

    expect(lines).toEqual([
      { key: 'rt-1783200920678-0', speaker: 'patient', label: 'Sophie', text: 'Hi, doctor', timestampMs: 670 },
      { key: 'rt-1783200920678-1', speaker: 'candidate', label: 'You', text: 'Hello, come in.', timestampMs: 4200 },
    ]);
  });

  it('falls back to the legacy role/content shape', () => {
    const lines = normaliseTranscript([
      { role: 'user', content: 'What brings you in?', timestamp: '2026-01-01T00:00:00Z' },
      { role: 'assistant', content: 'My chest hurts.' },
    ]);

    expect(lines.map((l) => [l.speaker, l.label, l.text, l.timestampMs])).toEqual([
      ['candidate', 'You', 'What brings you in?', null],
      ['patient', 'Patient', 'My chest hurts.', null],
    ]);
    expect(lines[0].key).toBe('line-0');
  });

  it('drops blank and malformed turns', () => {
    expect(
      normaliseTranscript([
        { role: 'user', content: '   ' },
        null,
        'nonsense',
        { role: 'assistant', text: 'Still here.' },
      ])
    ).toHaveLength(1);
  });

  it('returns nothing for a missing or non-array transcript', () => {
    expect(normaliseTranscript(undefined)).toEqual([]);
    expect(normaliseTranscript(null)).toEqual([]);
    expect(normaliseTranscript({})).toEqual([]);
  });
});

describe('formatTimestamp', () => {
  it('formats milliseconds as mm:ss', () => {
    expect(formatTimestamp(0)).toBe('00:00');
    expect(formatTimestamp(694900)).toBe('11:34');
    expect(formatTimestamp(65000)).toBe('01:05');
  });

  it('is empty for unknown timestamps', () => {
    expect(formatTimestamp(null)).toBe('');
    expect(formatTimestamp(undefined)).toBe('');
  });
});

describe('spokenTimestamp', () => {
  it('says the time in words, so a jump control can announce where it lands', () => {
    expect(spokenTimestamp(252000)).toBe('4 minutes 12 seconds');
    expect(spokenTimestamp(60000)).toBe('1 minute');
    expect(spokenTimestamp(61000)).toBe('1 minute 1 second');
    expect(spokenTimestamp(45000)).toBe('45 seconds');
  });

  it('says "0 seconds" rather than nothing at the very start', () => {
    expect(spokenTimestamp(0)).toBe('0 seconds');
  });

  it('is empty for unknown timestamps', () => {
    expect(spokenTimestamp(null)).toBe('');
    expect(spokenTimestamp(undefined)).toBe('');
  });
});

describe('transcriptTurnId', () => {
  it('namespaces the turn so two reports on one page cannot collide', () => {
    expect(transcriptTurnId('r1', 'rt-1783200920678-0')).toBe('r1-turn-rt-1783200920678-0');
  });
});

describe('findTranscriptAnchor', () => {
  // Shaped like a real consultation: turn starts are precise, evidence
  // timestamps are the marker's second-rounded reading of the same moments.
  const lines: TranscriptLine[] = [
    { key: 'a', speaker: 'patient', label: 'Sophie', text: 'Hi doctor', timestampMs: 670 },
    { key: 'b', speaker: 'candidate', label: 'You', text: 'Come in.', timestampMs: 4200 },
    { key: 'c', speaker: 'patient', label: 'Sophie', text: 'My chest hurts.', timestampMs: 112340 },
    { key: 'd', speaker: 'candidate', label: 'You', text: 'Tell me more.', timestampMs: 118900 },
  ];

  it('matches the turn nearest the quoted moment', () => {
    expect(findTranscriptAnchor(lines, 115000)?.key).toBe('c');
    expect(findTranscriptAnchor(lines, 4000)?.key).toBe('b');
  });

  it('prefers a turn by the evidence speaker when the seam is ambiguous', () => {
    // 118000 is 900ms from the candidate turn and 5.6s from the patient one, so
    // distance alone would answer 'd'. Attributed to the patient, it is 'c'.
    expect(findTranscriptAnchor(lines, 118000)?.key).toBe('d');
    expect(findTranscriptAnchor(lines, 118000, 'patient')?.key).toBe('c');
  });

  it('falls back to the nearest turn when no same-speaker turn is close enough', () => {
    // Attributed to the candidate, but the only candidate turn is minutes away
    // — a mislabelled speaker should not cost the reader the jump.
    const monologue: TranscriptLine[] = [
      { key: 'open', speaker: 'candidate', label: 'You', text: 'Come in.', timestampMs: 4200 },
      { key: 'story', speaker: 'patient', label: 'Sophie', text: 'It started…', timestampMs: 299000 },
    ];
    expect(findTranscriptAnchor(monologue, 300000, 'candidate')?.key).toBe('story');
  });

  it('refuses a match that is nowhere near a turn', () => {
    expect(findTranscriptAnchor(lines, 600000)).toBeNull();
    expect(
      findTranscriptAnchor(lines, 118900 + EVIDENCE_MATCH_TOLERANCE_MS + 1)
    ).toBeNull();
  });

  it('matches right on the tolerance boundary', () => {
    expect(findTranscriptAnchor(lines, 118900 + EVIDENCE_MATCH_TOLERANCE_MS)?.key).toBe('d');
  });

  it('keeps the earlier turn when two are equally close', () => {
    const tied: TranscriptLine[] = [
      { key: 'first', speaker: 'candidate', label: 'You', text: 'One', timestampMs: 9000 },
      { key: 'second', speaker: 'candidate', label: 'You', text: 'Two', timestampMs: 11000 },
    ];
    expect(findTranscriptAnchor(tied, 10000)?.key).toBe('first');
  });

  it('has nothing to match for an absent or unusable timestamp', () => {
    expect(findTranscriptAnchor(lines, null)).toBeNull();
    expect(findTranscriptAnchor(lines, undefined)).toBeNull();
    expect(findTranscriptAnchor(lines, Number.NaN)).toBeNull();
  });

  it('has nothing to match against in an untimed or empty transcript', () => {
    expect(findTranscriptAnchor([], 5000)).toBeNull();
    expect(
      findTranscriptAnchor(
        [{ key: 'x', speaker: 'candidate', label: 'You', text: 'No clock', timestampMs: null }],
        5000
      )
    ).toBeNull();
  });
});
