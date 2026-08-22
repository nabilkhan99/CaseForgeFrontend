import { describe, expect, it } from 'vitest';
import { formatTimestamp, normaliseTranscript } from './transcript';

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
