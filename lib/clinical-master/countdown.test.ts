import { describe, it, expect } from 'vitest';
import { deadlineFrom, remainingSeconds, formatCountdown } from './countdown';

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
