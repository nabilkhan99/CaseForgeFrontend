import { describe, it, expect } from 'vitest';
import { deadlineFrom, remainingSeconds, remainingFraction, formatCountdown } from './countdown';

const T0 = 1_700_000_000_000;

describe('deadlineFrom', () => {
  it('adds the duration in milliseconds', () => {
    expect(deadlineFrom(T0, 720)).toBe(T0 + 720_000);
  });

  it('treats a negative duration as zero', () => {
    expect(deadlineFrom(T0, -30)).toBe(T0);
  });
});

describe('remainingSeconds', () => {
  it('shows the full duration at the moment of start', () => {
    expect(remainingSeconds(deadlineFrom(T0, 720), T0)).toBe(720);
  });

  it('counts down in real time, not in ticks', () => {
    const deadline = deadlineFrom(T0, 720);
    // The regression this exists for: a backgrounded tab may not tick for two
    // minutes, and must come back showing two minutes gone.
    expect(remainingSeconds(deadline, T0 + 120_000)).toBe(600);
  });

  it('never goes negative once the deadline has passed', () => {
    expect(remainingSeconds(deadlineFrom(T0, 180), T0 + 600_000)).toBe(0);
  });

  it('reaches zero exactly at the deadline', () => {
    expect(remainingSeconds(deadlineFrom(T0, 180), T0 + 180_000)).toBe(0);
    expect(remainingSeconds(deadlineFrom(T0, 180), T0 + 179_999)).toBe(1);
  });
});

describe('remainingFraction', () => {
  it('is a full ring before the clock starts and an empty one at the deadline', () => {
    expect(remainingFraction(720, 720)).toBe(1);
    expect(remainingFraction(0, 720)).toBe(0);
  });

  it('halves at the halfway mark', () => {
    expect(remainingFraction(360, 720)).toBe(0.5);
  });

  it('clamps rather than drawing an over- or under-full ring', () => {
    expect(remainingFraction(900, 720)).toBe(1);
    expect(remainingFraction(-30, 720)).toBe(0);
  });

  it('never emits NaN into an SVG attribute', () => {
    expect(remainingFraction(720, 0)).toBe(0);
    expect(remainingFraction(720, -1)).toBe(0);
    expect(remainingFraction(Number.NaN, 720)).toBe(0);
    expect(remainingFraction(720, Number.NaN)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('zero-pads minutes and seconds', () => {
    expect(formatCountdown(720)).toBe('12:00');
    expect(formatCountdown(59)).toBe('00:59');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(605)).toBe('10:05');
  });

  it('clamps below zero', () => {
    expect(formatCountdown(-5)).toBe('00:00');
  });
});
