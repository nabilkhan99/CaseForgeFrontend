import { describe, expect, it } from 'vitest';
import {
  ENVELOPE_ATTACK,
  ENVELOPE_RELEASE,
  HALO_MAX_OPACITY,
  HALO_MAX_SCALE,
  HALO_MIN_OPACITY,
  HALO_MIN_SCALE,
  LEVEL_CEILING_DB,
  LEVEL_FLOOR_DB,
  ORB_MAX_SCALE,
  ORB_MIN_SCALE,
  SHEEN_MAX_OPACITY,
  SHEEN_MIN_OPACITY,
  followEnvelope,
  haloOpacity,
  haloScale,
  normaliseLevel,
  orbScale,
  sheenOpacity,
  syntheticEnvelope,
} from './orbLevel';

/**
 * The maths, not the pixels. The orb is driven straight off a WebRTC audio
 * level sixty times a second with no React in the path, so a wrong curve here
 * shows up as a dead or strobing orb during a live consultation and there is no
 * cheap way to notice it after the fact — hence tests on every mapping.
 */

const dbToLinear = (db: number): number => Math.pow(10, db / 20);

describe('normaliseLevel', () => {
  it('treats silence and absent readings as rest', () => {
    expect(normaliseLevel(0)).toBe(0);
    expect(normaliseLevel(-0.5)).toBe(0);
    expect(normaliseLevel(Number.NaN)).toBe(0);
    expect(normaliseLevel(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('pins the window ends to 0 and 1', () => {
    expect(normaliseLevel(dbToLinear(LEVEL_FLOOR_DB))).toBeCloseTo(0, 6);
    expect(normaliseLevel(dbToLinear(LEVEL_CEILING_DB))).toBeCloseTo(1, 6);
  });

  it('clamps outside the window rather than overshooting', () => {
    expect(normaliseLevel(dbToLinear(LEVEL_FLOOR_DB - 20))).toBe(0);
    expect(normaliseLevel(1)).toBe(1);
  });

  it('puts the middle of the window in the middle of the travel', () => {
    const midDb = (LEVEL_FLOOR_DB + LEVEL_CEILING_DB) / 2;
    expect(normaliseLevel(dbToLinear(midDb))).toBeCloseTo(0.5, 6);
  });

  it('lifts ordinary speech clear of the floor', () => {
    // The whole point of the dB window: a linear 0.06 reading is a normal
    // spoken syllable, and a straight `scale(0.06)` would be invisible.
    expect(normaliseLevel(0.06)).toBeGreaterThan(0.35);
  });

  it('is monotonic across the window', () => {
    const samples = [0.01, 0.03, 0.06, 0.12, 0.25, 0.5];
    const mapped = samples.map((s) => normaliseLevel(s));
    for (let i = 1; i < mapped.length; i += 1) {
      expect(mapped[i]).toBeGreaterThanOrEqual(mapped[i - 1]);
    }
  });

  it('returns rest for an inverted window rather than dividing by a negative', () => {
    expect(normaliseLevel(0.1, -12, -45)).toBe(0);
  });
});

describe('followEnvelope', () => {
  it('rises faster than it falls', () => {
    const up = followEnvelope(0, 1);
    const down = 1 - followEnvelope(1, 0);
    expect(up).toBeCloseTo(ENVELOPE_ATTACK, 6);
    expect(down).toBeCloseTo(ENVELOPE_RELEASE, 6);
    expect(up).toBeGreaterThan(down);
  });

  it('converges on the target without overshooting it', () => {
    let value = 0;
    for (let i = 0; i < 30; i += 1) value = followEnvelope(value, 0.8);
    expect(value).toBeGreaterThan(0.79);
    expect(value).toBeLessThanOrEqual(0.8);
  });

  it('reaches most of a step within a few frames', () => {
    // ~30Hz, so four frames is ~130ms — fast enough that the orb reads as
    // reacting to the voice rather than trailing it.
    let value = 0;
    for (let i = 0; i < 4; i += 1) value = followEnvelope(value, 1);
    expect(value).toBeGreaterThan(0.85);
  });

  it('glides back to rest over roughly half a second', () => {
    let value = 1;
    for (let i = 0; i < 15; i += 1) value = followEnvelope(value, 0);
    expect(value).toBeLessThan(0.15);
    expect(value).toBeGreaterThan(0);
  });

  it('clamps the target and survives a corrupt current value', () => {
    expect(followEnvelope(0, 4)).toBeCloseTo(ENVELOPE_ATTACK, 6);
    expect(followEnvelope(Number.NaN, 1)).toBeCloseTo(ENVELOPE_ATTACK, 6);
    expect(followEnvelope(0.5, Number.NaN)).toBeLessThan(0.5);
  });

  it('stays inside 0..1 over a long noisy run', () => {
    let value = 0;
    for (let i = 0; i < 500; i += 1) {
      value = followEnvelope(value, i % 3 === 0 ? 1 : 0);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('syntheticEnvelope', () => {
  it('stays inside 0..1 for a full consultation', () => {
    for (let ms = 0; ms <= 720_000; ms += 37) {
      const value = syntheticEnvelope(ms);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('actually moves, and over the full range', () => {
    let min = 1;
    let max = 0;
    for (let ms = 0; ms < 20_000; ms += 33) {
      const value = syntheticEnvelope(ms);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    expect(min).toBeLessThan(0.15);
    expect(max).toBeGreaterThan(0.8);
  });

  it('does not repeat on a short period', () => {
    expect(syntheticEnvelope(0)).not.toBeCloseTo(syntheticEnvelope(1000), 2);
  });

  it('is safe with a nonsense clock', () => {
    expect(syntheticEnvelope(Number.NaN)).toBe(0);
  });
});

describe('envelope to visual mappings', () => {
  const cases = [
    ['orbScale', orbScale, ORB_MIN_SCALE, ORB_MAX_SCALE] as const,
    ['haloScale', haloScale, HALO_MIN_SCALE, HALO_MAX_SCALE] as const,
    ['haloOpacity', haloOpacity, HALO_MIN_OPACITY, HALO_MAX_OPACITY] as const,
    ['sheenOpacity', sheenOpacity, SHEEN_MIN_OPACITY, SHEEN_MAX_OPACITY] as const,
  ];

  for (const [name, fn, min, max] of cases) {
    it(`${name} spans its declared range and clamps outside 0..1`, () => {
      expect(fn(0)).toBeCloseTo(min, 6);
      expect(fn(1)).toBeCloseTo(max, 6);
      expect(fn(0.5)).toBeCloseTo((min + max) / 2, 6);
      expect(fn(-1)).toBeCloseTo(min, 6);
      expect(fn(5)).toBeCloseTo(max, 6);
      expect(fn(Number.NaN)).toBeCloseTo(min, 6);
    });
  }

  it('keeps the sphere close to its resting size so the initials stay crisp', () => {
    expect(ORB_MAX_SCALE).toBeLessThanOrEqual(1.2);
  });
});
