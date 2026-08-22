import { describe, expect, it } from 'vitest';
import {
  BARE_FAIL_FLOOR,
  CLEAR_PASS_MARK,
  PASS_MARK,
  bareFailPercent,
  gradeTone,
  isPassingVerdict,
  passMargin,
  passMarkCaption,
  passMarkFor,
  passMarkPercent,
  passMarkSentence,
  scoreTone,
  toneForPercent,
  verdictForScore,
  verdictTone,
} from './scoring';

describe('verdictForScore — mirrors CaseForgeAzure app/utils/verdict.py', () => {
  it.each([
    [10.5, 'Pass'],
    [7.0, 'Pass'],
    [6.9, 'Bare Pass'],
    [6.0, 'Bare Pass'],
    [5.9, 'Bare Fail'],
    [5.5, 'Bare Fail'],
    [4.5, 'Bare Fail'],
    [4.4, 'Fail'],
    [0, 'Fail'],
  ])('scores %s as %s', (score, verdict) => {
    expect(verdictForScore(score)).toBe(verdict);
  });

  it('keeps the band boundaries in the documented order', () => {
    expect(BARE_FAIL_FLOOR).toBeLessThan(PASS_MARK);
    expect(PASS_MARK).toBeLessThan(CLEAR_PASS_MARK);
  });
});

describe('passMarkFor', () => {
  it('is 6.0 on the standard 10.5 scale', () => {
    expect(passMarkFor(10.5)).toBe(6);
    expect(passMarkFor()).toBe(6);
  });

  it('rescales proportionally for a non-standard maximum', () => {
    expect(passMarkFor(21)).toBe(12);
  });

  it('falls back to the standard mark for nonsense maxima', () => {
    expect(passMarkFor(0)).toBe(6);
    expect(passMarkFor(Number.NaN)).toBe(6);
  });
});

describe('percentages', () => {
  it('puts the pass mark at 57% and the clear-fail floor at 43%', () => {
    expect(passMarkPercent()).toBe(57);
    expect(bareFailPercent()).toBe(43);
  });
});

describe('passMargin / passMarkSentence', () => {
  it('reports a Bare Fail of 5.5 as 0.5 short', () => {
    expect(passMargin(5.5)).toEqual({ passed: false, margin: 0.5 });
    expect(passMarkSentence(5.5)).toBe('Pass mark 6.0 / 10.5 — you were 0.5 short.');
  });

  it('reports a Bare Pass of 6.5 as 0.5 clear', () => {
    expect(passMargin(6.5)).toEqual({ passed: true, margin: 0.5 });
    expect(passMarkSentence(6.5)).toBe('Pass mark 6.0 / 10.5 — you were 0.5 clear of it.');
  });

  it('handles landing exactly on the mark', () => {
    expect(passMargin(6)).toEqual({ passed: true, margin: 0 });
    expect(passMarkSentence(6)).toBe('Pass mark 6.0 / 10.5 — you finished exactly on it.');
  });

  it('avoids floating point noise in the margin', () => {
    expect(passMargin(4.5).margin).toBe(1.5);
    expect(passMargin(7.3).margin).toBe(1.3);
  });

  it('captions a score with the threshold', () => {
    expect(passMarkCaption()).toBe('6.0 / 10.5 to pass');
  });
});

describe('tones', () => {
  it('maps grades to pass / borderline / fail', () => {
    expect(gradeTone('CP')).toBe('pass');
    expect(gradeTone('P')).toBe('pass');
    expect(gradeTone('F')).toBe('borderline');
    expect(gradeTone('CF')).toBe('fail');
  });

  it('maps verdicts to the same three tones', () => {
    expect(verdictTone('Pass')).toBe('pass');
    expect(verdictTone('Bare Pass')).toBe('pass');
    expect(verdictTone('Bare Fail')).toBe('borderline');
    expect(verdictTone('Fail')).toBe('fail');
  });

  it('maps raw scores through the verdict bands', () => {
    expect(scoreTone(8)).toBe('pass');
    expect(scoreTone(6)).toBe('pass');
    expect(scoreTone(5.5)).toBe('borderline');
    expect(scoreTone(2)).toBe('fail');
  });

  it('treats 57% as a pass, not 70%', () => {
    expect(toneForPercent(57)).toBe('pass');
    expect(toneForPercent(60)).toBe('pass');
    expect(toneForPercent(50)).toBe('borderline');
    expect(toneForPercent(43)).toBe('borderline');
    expect(toneForPercent(20)).toBe('fail');
  });
});

describe('isPassingVerdict', () => {
  it('accepts raw strings from the database', () => {
    expect(isPassingVerdict('Bare Pass')).toBe(true);
    expect(isPassingVerdict('Bare Fail')).toBe(false);
    expect(isPassingVerdict(null)).toBe(false);
    expect(isPassingVerdict(undefined)).toBe(false);
    expect(isPassingVerdict('')).toBe(false);
  });
});
